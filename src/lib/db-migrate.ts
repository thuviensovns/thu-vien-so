import { getDbPool } from './db-pool'

/** Ensure additional tables/columns exist. Idempotent via IF NOT EXISTS. */
export async function ensureTablesExist(): Promise<{ executed: string[]; errors: string[] }> {
  const results: { executed: string[]; errors: string[] } = { executed: [], errors: [] }

  const pool = getDbPool()

  const queries = [
    {
      label: 'Create coupons table',
      q: `CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code VARCHAR UNIQUE,
        type VARCHAR DEFAULT 'percent',
        value NUMERIC,
        min_order NUMERIC DEFAULT 0,
        max_uses NUMERIC DEFAULT 0,
        used_count NUMERIC DEFAULT 0,
        active BOOLEAN DEFAULT true,
        expires_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      label: 'Create activity_logs table',
      q: `CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        type VARCHAR,
        action VARCHAR,
        detail VARCHAR,
        admin_email VARCHAR,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      label: 'Add orders.download_token',
      q: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS download_token VARCHAR`,
    },
    {
      label: 'Add orders.download_expires_at',
      q: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS download_expires_at TIMESTAMPTZ`,
    },
    {
      label: 'Create unique index orders.download_token',
      q: `CREATE UNIQUE INDEX IF NOT EXISTS orders_download_token_idx ON orders(download_token)`,
    },
    {
      label: 'Add balance to enum_orders_payment_method',
      q: `ALTER TYPE enum_orders_payment_method ADD VALUE IF NOT EXISTS 'balance'`,
    },
    {
      label: 'Add processing to enum_orders_status',
      q: `ALTER TYPE enum_orders_status ADD VALUE IF NOT EXISTS 'processing'`,
    },
  ]

  for (const { label, q } of queries) {
    try {
      await pool.query(q)
      results.executed.push(label)
    } catch (err) {
      results.errors.push(`${label}: ${(err as Error).message}`)
    }
  }

  return results
}
