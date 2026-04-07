import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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

/**
 * Generate a signed download URL for a file in R2
 * @param r2Key - Object key in R2 bucket
 * @param expiresIn - Expiry in seconds (default: 48 hours)
 */
export async function generateDownloadUrl(
  r2Key: string,
  expiresIn = 172800,
): Promise<string> {
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
  const client = getR2Client()
  await client.send(new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: r2Key,
  }))
}
