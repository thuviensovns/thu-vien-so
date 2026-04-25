import { getDbPool } from './db-pool'
import { categoryMeta } from './config'
import { ALL_PERMISSIONS } from './permissions'

/** Process-local guard so repeat callers reuse the first run's promise.
 *  Previously this function was awaited on every login attempt (via
 *  isIpBlocked / recordFailedAttempt / clearFailedAttempts), firing 35+ DDL
 *  + seed queries per login and causing the UI to hang on new machines. */
let _ensurePromise: Promise<{ executed: string[]; errors: string[] }> | null = null

/** Ensure additional tables/columns exist. Idempotent via IF NOT EXISTS.
 *  Only runs the actual migration once per process — subsequent callers get
 *  the memoized promise. On failure the promise resets so the next call
 *  retries (e.g. transient connection errors). */
export async function ensureTablesExist(): Promise<{ executed: string[]; errors: string[] }> {
  if (_ensurePromise) return _ensurePromise
  _ensurePromise = _runEnsureTablesExist().catch((err) => {
    _ensurePromise = null
    throw err
  })
  return _ensurePromise
}

async function _runEnsureTablesExist(): Promise<{ executed: string[]; errors: string[] }> {
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
    {
      // Tracks commissions that were auto-credited straight into users.balance
      // (the new default). Legacy rows stay in available_balance until the user
      // submits a manual withdrawal request.
      label: 'Add affiliate_accounts.auto_credited column',
      q: `ALTER TABLE affiliate_accounts ADD COLUMN IF NOT EXISTS auto_credited NUMERIC DEFAULT 0`,
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
    // === Orders + topups perf indexes (Phase 9) ===
    // Composite indexes for the hot "WHERE <col> ORDER BY created_at DESC" pattern used by:
    //  - /api/user/orders (user_id + created_at)
    //  - /api/notifications admin polling (status + created_at, every 15s)
    //  - /api/admin/topups per-user views
    {
      label: 'Create index orders.user_id_created_at',
      q: `CREATE INDEX IF NOT EXISTS orders_user_created_at_idx ON orders(user_id, created_at DESC)`,
    },
    {
      label: 'Create index orders.status_created_at',
      q: `CREATE INDEX IF NOT EXISTS orders_status_created_at_idx ON orders(status, created_at DESC)`,
    },
    {
      label: 'Create index topups.user_id_created_at',
      q: `CREATE INDEX IF NOT EXISTS topups_user_created_at_idx ON topups(user_id, created_at DESC)`,
    },
    {
      label: 'Create index topups.status_created_at',
      q: `CREATE INDEX IF NOT EXISTS topups_status_created_at_idx ON topups(status, created_at DESC)`,
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
    // Users.banned (commit 5fd91a7) — push:false means Payload won't auto-create
    // the column; without it every login fails because Payload's SELECT includes it.
    {
      label: 'Add users.banned',
      q: `ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false`,
    },
    // === Product video demo (MP4 upload / external URL) ===
    // Payload "video" group field — same push:false constraint means we must
    // create the columns manually so Payload's SELECT includes them.
    {
      label: 'Add products.video_url',
      q: `ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url VARCHAR`,
    },
    {
      label: 'Add products.video_r2_key',
      q: `ALTER TABLE products ADD COLUMN IF NOT EXISTS video_r2_key VARCHAR`,
    },
    {
      label: 'Add products.video_file_name',
      q: `ALTER TABLE products ADD COLUMN IF NOT EXISTS video_file_name VARCHAR`,
    },
    {
      label: 'Add products.video_file_size',
      q: `ALTER TABLE products ADD COLUMN IF NOT EXISTS video_file_size NUMERIC`,
    },
    {
      label: 'Add products.video_mime_type',
      q: `ALTER TABLE products ADD COLUMN IF NOT EXISTS video_mime_type VARCHAR`,
    },
    // === Product audio demo (direct upload mirroring video pattern) ===
    // Payload "preview" group gained audioUrl + audioR2Key + audio metadata
    // — push:false means these columns must be created manually so Payload's
    // SELECT includes them (otherwise every product query 500s).
    {
      label: 'Add products.preview_audio_url',
      q: `ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_audio_url VARCHAR`,
    },
    {
      label: 'Add products.preview_audio_r2_key',
      q: `ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_audio_r2_key VARCHAR`,
    },
    {
      label: 'Add products.preview_audio_file_name',
      q: `ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_audio_file_name VARCHAR`,
    },
    {
      label: 'Add products.preview_audio_file_size',
      q: `ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_audio_file_size NUMERIC`,
    },
    {
      label: 'Add products.preview_audio_mime_type',
      q: `ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_audio_mime_type VARCHAR`,
    },
    // === Out-of-stock flag — admin can mark a product as "Hết hàng" to hide
    // purchase actions and show a badge to customers. Not a stock counter;
    // just a binary switch because files are digital, not inventoried. ===
    {
      label: 'Add products.out_of_stock',
      q: `ALTER TABLE products ADD COLUMN IF NOT EXISTS out_of_stock BOOLEAN NOT NULL DEFAULT false`,
    },
    // === Web2M auto-polling fields on bank_config global ===
    {
      label: 'Add bank_config.web2m_enabled',
      q: `ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_enabled BOOLEAN DEFAULT false`,
    },
    {
      label: 'Add bank_config.web2m_api_type',
      q: `ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_api_type VARCHAR DEFAULT 'openapi'`,
    },
    {
      label: 'Add bank_config.web2m_bank',
      q: `ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_bank VARCHAR`,
    },
    {
      label: 'Add bank_config.web2m_api_version',
      q: `ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_api_version VARCHAR`,
    },
    {
      label: 'Add bank_config.web2m_account_number',
      q: `ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_account_number VARCHAR`,
    },
    {
      label: 'Add bank_config.web2m_password',
      q: `ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_password VARCHAR`,
    },
    {
      label: 'Add bank_config.web2m_token',
      q: `ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_token VARCHAR`,
    },
    {
      label: 'Add bank_config.web2m_api_url',
      q: `ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_api_url VARCHAR`,
    },
    {
      label: 'Add bank_config.web2m_last_poll_at',
      q: `ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_last_poll_at TIMESTAMPTZ`,
    },
    {
      label: 'Add bank_config.web2m_last_status',
      q: `ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_last_status VARCHAR`,
    },
    {
      label: 'Add topups.credited_at',
      q: `ALTER TABLE topups ADD COLUMN IF NOT EXISTS credited_at TIMESTAMPTZ`,
    },
    {
      label: 'Add bank_config.web2m_loop_lease_until',
      q: `ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_loop_lease_until TIMESTAMPTZ`,
    },
    {
      // Pre-fix, the deduct endpoint stored DEDUCT* topups with POSITIVE
      // `amount` (Payload's min:1000 validator blocked negative). Every SUM-
      // based aggregation (leaderboard, revenue, dashboard) read these as
      // top-ups and inflated the totals. Flip them to negative so SUMs net
      // out naturally. Idempotent via `amount > 0` guard.
      label: 'Backfill: flip DEDUCT* topup amounts to negative',
      q: `UPDATE topups SET amount = -amount
          WHERE transfer_code LIKE 'DEDUCT%' AND amount > 0`,
    },
    // ── Reverse affiliate commissions wrongly accrued from ADMIN* manual
    //    top-ups. Order matters: A→B→C must run BEFORE D (D flips status,
    //    which is the filter used by A/B/C). All idempotent via
    //    `status='credited'` filter — once D marks rows 'reversed', subsequent
    //    runs find nothing and no-op.
    {
      label: 'Reverse ADMIN-derived affiliate commissions (A: balances)',
      q: `UPDATE users u
          SET balance = COALESCE(u.balance, 0) - sub.total
          FROM (
            SELECT referrer_user_id, SUM(commission_amount)::bigint AS total
            FROM affiliate_commissions
            WHERE source_id LIKE 'ADMIN%' AND status = 'credited'
            GROUP BY referrer_user_id
          ) sub
          WHERE u.id = sub.referrer_user_id`,
    },
    {
      label: 'Reverse ADMIN-derived affiliate commissions (B: account counters)',
      q: `UPDATE affiliate_accounts aa
          SET total_earned = GREATEST(0, COALESCE(aa.total_earned, 0) - sub.total),
              auto_credited = GREATEST(0, COALESCE(aa.auto_credited, 0) - sub.total)
          FROM (
            SELECT referrer_user_id, SUM(commission_amount)::bigint AS total
            FROM affiliate_commissions
            WHERE source_id LIKE 'ADMIN%' AND status = 'credited'
            GROUP BY referrer_user_id
          ) sub
          WHERE aa.user_id = sub.referrer_user_id`,
    },
    {
      label: 'Reverse ADMIN-derived affiliate commissions (C: delete COMM audit topups)',
      q: `DELETE FROM topups
          WHERE id IN (
            SELECT t.id FROM topups t
            JOIN affiliate_commissions ac
              ON ac.referrer_user_id = t.user_id
              AND t.bank_description LIKE '%topup#' || ac.source_id || '%'
            WHERE t.transfer_code LIKE 'COMM%'
              AND ac.source_id LIKE 'ADMIN%'
              AND ac.status = 'credited'
          )`,
    },
    {
      label: 'Reverse ADMIN-derived affiliate commissions (D: mark reversed)',
      q: `UPDATE affiliate_commissions
          SET status = 'reversed',
              note = COALESCE(note, '') || ' [REVERSED: source admin manual top-up — not real revenue]'
          WHERE source_id LIKE 'ADMIN%' AND status = 'credited'`,
    },
    {
      // Defensive clamp for any drift introduced by past partial cleanups.
      label: 'Clamp negative affiliate counters to zero',
      q: `UPDATE affiliate_accounts
          SET total_earned = GREATEST(0, total_earned),
              auto_credited = GREATEST(0, COALESCE(auto_credited, 0))
          WHERE total_earned < 0 OR auto_credited < 0`,
    },
    {
      // Link DEDUCT* rows back to the topup they correct so per-day revenue
      // buckets attribute the negative to the original credit's date instead
      // of the day the admin clicked "trừ". Nullable: legacy/orphan DEDUCTs
      // fall back to their own date.
      label: 'Add topups.original_topup_id',
      q: `ALTER TABLE topups ADD COLUMN IF NOT EXISTS original_topup_id INT`,
    },
    {
      label: 'Index topups.original_topup_id (for revenue JOIN)',
      q: `CREATE INDEX IF NOT EXISTS topups_original_topup_id_idx ON topups(original_topup_id) WHERE original_topup_id IS NOT NULL`,
    },
    {
      // Backfill: link unlinked DEDUCT rows to the topup they correct.
      //  - Priority 1: same user, EXACT |amount| match, most recent before
      //    the DEDUCT (the typical "cộng X rồi trừ X" flow).
      //  - Priority 2: same user, LARGEST positive credit before the DEDUCT
      //    (best-guess for partial / bulk-undo: trừ 10.6M when there's a
      //    10M + 500K + 100K spread → attribute to the 10M day).
      //  Excludes DEDUCT* (other deducts) and COMM* (affiliate internal).
      //  Idempotent via `original_topup_id IS NULL` guard.
      label: 'Backfill: link DEDUCT rows to their original topup',
      q: `UPDATE topups d
          SET original_topup_id = COALESCE(
            (SELECT t.id FROM topups t
             WHERE t.user_id = d.user_id
               AND t.amount = ABS(d.amount)
               AND t.status = 'completed'
               AND t.id != d.id
               AND (t.transfer_code IS NULL
                 OR (t.transfer_code NOT LIKE 'DEDUCT%' AND t.transfer_code NOT LIKE 'COMM%'))
               AND t.created_at <= d.created_at
             ORDER BY t.created_at DESC LIMIT 1),
            (SELECT t.id FROM topups t
             WHERE t.user_id = d.user_id
               AND t.amount > 0
               AND t.status = 'completed'
               AND t.id != d.id
               AND (t.transfer_code IS NULL
                 OR (t.transfer_code NOT LIKE 'DEDUCT%' AND t.transfer_code NOT LIKE 'COMM%'))
               AND t.created_at <= d.created_at
             ORDER BY t.amount DESC, t.created_at DESC LIMIT 1)
          )
          WHERE d.transfer_code LIKE 'DEDUCT%'
            AND d.original_topup_id IS NULL`,
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

  // One-time backfill: give every existing user an affiliate_accounts row with
  // an email-derived ref_code (e.g. "john@gmail.com" → "JOHN"). Idempotent —
  // the WHERE NOT EXISTS filter + ON CONFLICT skip handles re-runs.
  // PL/pgSQL loop with per-row collision handling: if "JOHN" already exists
  // we fall back to "JOHN<user_id>" so every user gets a code.
  try {
    await pool.query(`
      DO $backfill$
      DECLARE
        u RECORD;
        base_code TEXT;
        final_code TEXT;
      BEGIN
        FOR u IN
          SELECT id, email FROM users
          WHERE NOT EXISTS (SELECT 1 FROM affiliate_accounts a WHERE a.user_id = users.id)
        LOOP
          base_code := UPPER(REGEXP_REPLACE(SPLIT_PART(u.email, '@', 1), '[^A-Za-z0-9]', '', 'g'));
          base_code := LEFT(base_code, 20);
          IF base_code = '' THEN
            base_code := 'U' || u.id::text;
          END IF;
          IF EXISTS (SELECT 1 FROM affiliate_accounts WHERE ref_code = base_code) THEN
            final_code := base_code || u.id::text;
          ELSE
            final_code := base_code;
          END IF;
          BEGIN
            INSERT INTO affiliate_accounts (user_id, ref_code) VALUES (u.id, final_code);
          EXCEPTION WHEN unique_violation THEN
            -- final_code collided too (extremely rare) — append a short hash
            INSERT INTO affiliate_accounts (user_id, ref_code)
            VALUES (u.id, base_code || u.id::text || SUBSTR(MD5(random()::text), 1, 4))
            ON CONFLICT DO NOTHING;
          END;
        END LOOP;
      END
      $backfill$;
    `)
    results.executed.push('Backfilled affiliate_accounts for existing users')
  } catch (err) {
    results.errors.push(`Affiliate backfill: ${(err as Error).message}`)
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
