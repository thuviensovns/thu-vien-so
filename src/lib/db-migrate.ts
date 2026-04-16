import { getDbPool } from './db-pool'
import { categoryMeta } from './config'
import { ALL_PERMISSIONS } from './permissions'

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
    {
      label: 'Add cai-dat-phan-mem to enum_categories_type',
      q: `ALTER TYPE enum_categories_type ADD VALUE IF NOT EXISTS 'cai-dat-phan-mem'`,
    },
    // === Roles & Permissions (Phase 1) ===
    {
      label: 'Create admin_roles table',
      q: `CREATE TABLE IF NOT EXISTS admin_roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description VARCHAR(500),
        permissions TEXT[] NOT NULL DEFAULT '{}',
        is_system BOOLEAN DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      label: 'Create user_role_assignments table',
      q: `CREATE TABLE IF NOT EXISTS user_role_assignments (
        user_id INT PRIMARY KEY,
        role_id INT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
        assigned_by VARCHAR(255),
        assigned_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    // === Enhanced admin activity logs (Phase 2) ===
    {
      label: 'Add admin_logs.ip column',
      q: `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip VARCHAR(45)`,
    },
    {
      label: 'Add admin_logs.user_agent column',
      q: `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500)`,
    },
    {
      label: 'Create index activity_logs.admin_email',
      q: `CREATE INDEX IF NOT EXISTS activity_logs_admin_email_idx ON activity_logs(admin_email)`,
    },
    {
      label: 'Create index activity_logs.created_at',
      q: `CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs(created_at DESC)`,
    },
    // === Failed login + IP block (Phase 3) ===
    {
      label: 'Create failed_login_attempts table',
      q: `CREATE TABLE IF NOT EXISTS failed_login_attempts (
        id SERIAL PRIMARY KEY,
        ip VARCHAR(45) NOT NULL,
        email VARCHAR(255),
        type VARCHAR(32) NOT NULL DEFAULT 'login',
        reason VARCHAR(255),
        user_agent VARCHAR(500),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      label: 'Create index failed_login_attempts.ip',
      q: `CREATE INDEX IF NOT EXISTS failed_login_attempts_ip_idx ON failed_login_attempts(ip, created_at DESC)`,
    },
    {
      label: 'Create blocked_ips table',
      q: `CREATE TABLE IF NOT EXISTS blocked_ips (
        id SERIAL PRIMARY KEY,
        ip VARCHAR(45) UNIQUE NOT NULL,
        reason VARCHAR(500),
        attempts_count INT DEFAULT 0,
        blocked_until TIMESTAMPTZ,
        is_permanent BOOLEAN DEFAULT false,
        blocked_by VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    // === Cron jobs registry (Phase 4) ===
    {
      label: 'Create cron_jobs table',
      q: `CREATE TABLE IF NOT EXISTS cron_jobs (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description VARCHAR(500),
        recommended_interval VARCHAR(32),
        last_run_at TIMESTAMPTZ,
        last_status VARCHAR(32),
        last_duration_ms INT,
        last_error VARCHAR(1000),
        run_count INT DEFAULT 0,
        enabled BOOLEAN DEFAULT true,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    // === Affiliate (Phase 5) ===
    {
      label: 'Create affiliate_accounts table',
      q: `CREATE TABLE IF NOT EXISTS affiliate_accounts (
        user_id INT PRIMARY KEY,
        ref_code VARCHAR(32) UNIQUE NOT NULL,
        total_earned NUMERIC DEFAULT 0,
        available_balance NUMERIC DEFAULT 0,
        withdrawn NUMERIC DEFAULT 0,
        referral_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      label: 'Create affiliate_referrals table',
      q: `CREATE TABLE IF NOT EXISTS affiliate_referrals (
        id SERIAL PRIMARY KEY,
        referrer_user_id INT NOT NULL,
        referred_user_id INT UNIQUE NOT NULL,
        ref_code VARCHAR(32) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      label: 'Create affiliate_commissions table',
      q: `CREATE TABLE IF NOT EXISTS affiliate_commissions (
        id SERIAL PRIMARY KEY,
        referrer_user_id INT NOT NULL,
        referred_user_id INT NOT NULL,
        source_type VARCHAR(32) NOT NULL,
        source_id VARCHAR(64),
        base_amount NUMERIC NOT NULL,
        commission_amount NUMERIC NOT NULL,
        commission_percent NUMERIC NOT NULL,
        status VARCHAR(32) DEFAULT 'pending',
        note VARCHAR(500),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      label: 'Create affiliate_withdrawals table',
      q: `CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        amount NUMERIC NOT NULL,
        bank_name VARCHAR(255),
        bank_account_number VARCHAR(64),
        bank_account_holder VARCHAR(255),
        status VARCHAR(32) DEFAULT 'pending',
        admin_note VARCHAR(500),
        processed_by VARCHAR(255),
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      label: 'Create index affiliate_commissions.referrer',
      q: `CREATE INDEX IF NOT EXISTS affiliate_commissions_referrer_idx ON affiliate_commissions(referrer_user_id, created_at DESC)`,
    },
    {
      label: 'Create unique index affiliate_commissions.source (idempotency guard)',
      q: `CREATE UNIQUE INDEX IF NOT EXISTS affiliate_commissions_source_unique_idx
          ON affiliate_commissions(source_type, source_id)
          WHERE source_id IS NOT NULL`,
    },
    // === Email campaigns (Phase 6) ===
    {
      label: 'Create email_campaigns table',
      q: `CREATE TABLE IF NOT EXISTS email_campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        html_content TEXT NOT NULL,
        recipient_mode VARCHAR(32) NOT NULL DEFAULT 'all',
        recipient_ids TEXT,
        status VARCHAR(32) DEFAULT 'draft',
        total_recipients INT DEFAULT 0,
        sent_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        created_by VARCHAR(255),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      label: 'Create email_queue table',
      q: `CREATE TABLE IF NOT EXISTS email_queue (
        id SERIAL PRIMARY KEY,
        campaign_id INT REFERENCES email_campaigns(id) ON DELETE CASCADE,
        user_id INT,
        recipient_email VARCHAR(255) NOT NULL,
        status VARCHAR(32) DEFAULT 'pending',
        error VARCHAR(1000),
        attempted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      label: 'Create index email_queue.campaign_status',
      q: `CREATE INDEX IF NOT EXISTS email_queue_campaign_status_idx ON email_queue(campaign_id, status)`,
    },
    {
      label: 'Create unique index email_queue.campaign_user (dedupe recipients)',
      q: `CREATE UNIQUE INDEX IF NOT EXISTS email_queue_campaign_user_unique_idx
          ON email_queue(campaign_id, user_id)
          WHERE user_id IS NOT NULL`,
    },
    {
      label: 'Add email_queue.source_key column (for system notifications without a campaign)',
      q: `ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS source_key VARCHAR(128)`,
    },
    {
      label: 'Create unique index email_queue.source_key (dedupe system notifications)',
      q: `CREATE UNIQUE INDEX IF NOT EXISTS email_queue_source_key_unique_idx
          ON email_queue(source_key)
          WHERE source_key IS NOT NULL`,
    },
    // === Downloads perf index (Phase 8) ===
    {
      label: 'Create index downloads.user_id_created_at',
      q: `CREATE INDEX IF NOT EXISTS downloads_user_created_at_idx ON downloads(user_id, created_at DESC)`,
    },
    // === Automations (Phase 7) ===
    {
      label: 'Create automations table',
      q: `CREATE TABLE IF NOT EXISTS automations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(64) NOT NULL,
        config JSONB DEFAULT '{}',
        enabled BOOLEAN DEFAULT true,
        last_run_at TIMESTAMPTZ,
        last_status VARCHAR(32),
        last_affected_count INT,
        last_error VARCHAR(1000),
        run_count INT DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    // === Site settings generic KV (used by affiliate config, email SMTP, etc.) ===
    {
      label: 'Create admin_settings table',
      q: `CREATE TABLE IF NOT EXISTS admin_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_by VARCHAR(255),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
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

  // Seed default system roles (super_admin + moderator)
  try {
    const allPerms = [...ALL_PERMISSIONS]
    const moderatorPerms = allPerms.filter(
      (p) =>
        p.endsWith('.view') ||
        p === 'messages.reply' ||
        p === 'orders.edit' ||
        p === 'topups.approve',
    )
    await pool.query(
      `INSERT INTO admin_roles (name, description, permissions, is_system)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (name) DO UPDATE SET permissions = $3, updated_at = NOW()`,
      ['super_admin', 'Toàn quyền hệ thống (system)', allPerms],
    )
    await pool.query(
      `INSERT INTO admin_roles (name, description, permissions, is_system)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (name) DO NOTHING`,
      ['moderator', 'Chỉ xem + trả lời tin nhắn + duyệt đơn/nạp tiền', moderatorPerms],
    )
    results.executed.push('Seeded system roles')
  } catch (err) {
    results.errors.push(`Seed roles: ${(err as Error).message}`)
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
    } catch (err) {
      results.errors.push(`Category ${cat.slug}: ${(err as Error).message}`)
    }
  }

  return results
}
