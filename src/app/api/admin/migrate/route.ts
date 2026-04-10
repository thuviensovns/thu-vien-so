import { NextRequest, NextResponse } from 'next/server'
// @ts-expect-error pg has no type declarations in this project
import pg from 'pg'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * GET/POST: Run database migrations for new collections.
 * Uses PAYLOAD_SECRET for auth (bypasses Payload which is broken without these migrations).
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
    // Auth via secret (can't use Payload auth since it's broken without these migrations)
    const secret = process.env.REVALIDATE_SECRET || process.env.PAYLOAD_SECRET
    const provided = req.nextUrl.searchParams.get('secret') || req.headers.get('x-secret')

    if (!secret || provided !== secret) {
      return NextResponse.json({ error: 'Forbidden - provide ?secret=YOUR_PAYLOAD_SECRET' }, { status: 403 })
    }

    const results: { executed: string[]; errors: string[] } = { executed: [], errors: [] }

    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })

    const queries = [
      // New collection tables
      { label: 'Create coupons table', q: `CREATE TABLE IF NOT EXISTS coupons (id SERIAL PRIMARY KEY, code VARCHAR UNIQUE, type VARCHAR DEFAULT 'percent', value NUMERIC, min_order NUMERIC DEFAULT 0, max_uses NUMERIC DEFAULT 0, used_count NUMERIC DEFAULT 0, active BOOLEAN DEFAULT true, expires_at TIMESTAMPTZ, updated_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW())` },
      { label: 'Create activity_logs table', q: `CREATE TABLE IF NOT EXISTS activity_logs (id SERIAL PRIMARY KEY, type VARCHAR, action VARCHAR, detail VARCHAR, admin_email VARCHAR, updated_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW())` },

      // Critical: payload_locked_documents_rels needs columns for ALL collections
      { label: 'Add coupons_id to payload_locked_documents_rels', q: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS coupons_id INTEGER` },
      { label: 'Add activity_logs_id to payload_locked_documents_rels', q: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS activity_logs_id INTEGER` },

      // TopUps optional columns
      { label: 'Add bank_description to topups', q: `ALTER TABLE topups ADD COLUMN IF NOT EXISTS bank_description VARCHAR` },
      { label: 'Add read_by_admin to topups', q: `ALTER TABLE topups ADD COLUMN IF NOT EXISTS read_by_admin BOOLEAN DEFAULT false` },
    ]

    for (const { label, q } of queries) {
      try {
        await pool.query(q)
        results.executed.push(label)
      } catch (err) {
        results.errors.push(`${label}: ${(err as Error).message}`)
      }
    }

    await pool.end()

    return NextResponse.json({ success: true, ...results }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[Admin migrate] Error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
