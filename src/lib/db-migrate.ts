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
      label: 'Add orders.transfer_code',
      q: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS transfer_code VARCHAR`,
    },
    {
      label: 'Create index orders.transfer_code',
      q: `CREATE INDEX IF NOT EXISTS orders_transfer_code_idx ON orders(transfer_code)`,
    },
    {
      label: 'Add orders.customer_name',
      q: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR`,
    },
    {
      label: 'Add orders.customer_email',
      q: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR`,
    },
    {
      label: 'Add orders.customer_phone',
      q: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR`,
    },
    {
      label: 'Add orders.read_by_admin',
      q: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS read_by_admin BOOLEAN DEFAULT false`,
    },
    {
      label: 'Add orders.note',
      q: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS note VARCHAR`,
    },
    {
      label: 'Add balance to enum_orders_payment_method',
      q: `ALTER TYPE enum_orders_payment_method ADD VALUE IF NOT EXISTS 'balance'`,
    },
    {
      label: 'Add processing to enum_orders_status',
      q: `ALTER TYPE enum_orders_status ADD VALUE IF NOT EXISTS 'processing'`,
    },
    {
      label: 'Add cai-dat-phan-mem to enum_products_type',
      q: `ALTER TYPE enum_products_type ADD VALUE IF NOT EXISTS 'cai-dat-phan-mem'`,
    },
    {
      label: 'Add momo to enum_orders_payment_method',
      q: `ALTER TYPE enum_orders_payment_method ADD VALUE IF NOT EXISTS 'momo'`,
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
