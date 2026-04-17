import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'

// When R2 env vars are missing (typical for local dev), uploads/downloads/deletes
// fall back to the local filesystem under public/uploads. Production always
// configures R2, so this branch never runs there.
function isR2Configured(): boolean {
  return !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  )
}

function getR2Client() {
  const endpoint = process.env.R2_ENDPOINT
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 is not configured. Missing R2_ENDPOINT, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY.')
  }
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME
  if (!bucket) throw new Error('R2 is not configured. Missing R2_BUCKET_NAME.')
  return bucket
}

function getLocalPath(r2Key: string): string {
  // Sanitize: prevent path traversal (../) escapes from public/uploads/
  const safe = r2Key.replace(/\\/g, '/').split('/').filter(p => p && p !== '..' && p !== '.').join('/')
  return path.join(process.cwd(), 'public', 'uploads', safe)
}

function getLocalPublicUrl(r2Key: string): string {
  const safe = r2Key.replace(/\\/g, '/').split('/').filter(p => p && p !== '..' && p !== '.').join('/')
  return `/uploads/${safe}`
}

/**
 * Generate a signed download URL for a file in R2
 * @param r2Key - Object key in R2 bucket
 * @param expiresIn - Expiry in seconds (default: 48 hours)
 */
export async function generateDownloadUrl(
  r2Key: string,
  expiresIn = 172800,
): Promise<string> {
  if (!isR2Configured()) {
    return getLocalPublicUrl(r2Key)
  }
  const client = getR2Client()
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: r2Key,
  })
  return getSignedUrl(client, command, { expiresIn })
}

/**
 * Upload a file to R2
 * @param r2Key - Object key (path) in R2 bucket
 * @param body - File content as Buffer
 * @param contentType - MIME type of the file
 */
export async function uploadToR2(
  r2Key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (!isR2Configured()) {
    const target = getLocalPath(r2Key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, body)
    console.log(`[Storage] R2 not configured — wrote ${(body.length / 1024 / 1024).toFixed(1)}MB to local: ${target}`)
    return
  }
  const client = getR2Client()
  await client.send(new PutObjectCommand({
    Bucket: getBucketName(),
    Key: r2Key,
    Body: body,
    ContentType: contentType,
  }))
}

/**
 * Delete a file from R2
 * @param r2Key - Object key to delete
 */
export async function deleteFromR2(r2Key: string): Promise<void> {
  if (!isR2Configured()) {
    try {
      await unlink(getLocalPath(r2Key))
    } catch (e: unknown) {
      // Ignore "file not found" — idempotent delete
      if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') throw e
    }
    return
  }
  const client = getR2Client()
  await client.send(new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: r2Key,
  }))
}
