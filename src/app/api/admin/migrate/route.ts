import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { categoryMeta } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * GET/POST: Run database migrations for new collections.
 * Uses PAYLOAD_SECRET for auth (bypasses Payload which may be broken without these migrations).
 *
 * Usage: Just visit /api/admin/migrate?secret=YOUR_PAYLOAD_SECRET in browser
 */
export async function GET(req: NextRequest) {
  return runMigration(req)
}

export async function POST(req: NextRequest) {
  return runMigration(req)
}

async function runMigration(req: NextRequest) {
  try {
    const secret = process.env.REVALIDATE_SECRET || process.env.PAYLOAD_SECRET
    const provided = req.nextUrl.searchParams.get('secret') || req.headers.get('x-secret')

    if (!secret || provided !== secret) {
      return NextResponse.json({ error: 'Forbidden - provide ?secret=YOUR_PAYLOAD_SECRET' }, { status: 403 })
    }

    const results = await ensureTablesExist()

    // Also run topups columns migration
    const pool = getDbPool()
    const extra = [
      { label: 'Add bank_description to topups', q: `ALTER TABLE topups ADD COLUMN IF NOT EXISTS bank_description VARCHAR` },
      { label: 'Add read_by_admin to topups', q: `ALTER TABLE topups ADD COLUMN IF NOT EXISTS read_by_admin BOOLEAN DEFAULT false` },
    ]
    for (const { label, q } of extra) {
      try {
        await pool.query(q)
        results.executed.push(label)
      } catch (err) {
        results.errors.push(`${label}: ${(err as Error).message}`)
      }
    }

    // Auto-create missing categories from categoryMeta
    for (const cat of categoryMeta) {
      try {
        const exists = await pool.query('SELECT id FROM categories WHERE slug = $1', [cat.slug])
        if (exists.rows.length === 0) {
          await pool.query(
            `INSERT INTO categories (name, slug, type, description, "order", updated_at, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [cat.name, cat.slug, cat.slug, cat.description, 0],
          )
          results.executed.push(`Created category: ${cat.name}`)
        }
      } catch (catErr) {
        results.errors.push(`Category ${cat.slug}: ${(catErr as Error).message}`)
      }
    }

    return NextResponse.json({ success: true, ...results }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[Admin migrate] Error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
