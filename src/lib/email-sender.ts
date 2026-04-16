import { getDbPool } from './db-pool'
import { ensureTablesExist } from './db-migrate'

/** Check if SMTP is configured via env vars. */
function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

/** Process pending items in email_queue, joining with email_campaigns for subject/body.
 *  Returns counts. Throws on SMTP misconfiguration so cron reports it clearly. */
export async function processEmailQueue(batchSize = 100): Promise<{ sent: number; failed: number }> {
  if (!smtpConfigured()) {
    throw new Error('SMTP chưa cấu hình (SMTP_HOST, SMTP_USER, SMTP_PASS)')
  }

  await ensureTablesExist()
  const pool = getDbPool()

  // Recovery: rows stuck in 'sending' for >10 minutes (crashed worker) → reset to 'pending'.
  await pool.query(
    `UPDATE email_queue SET status = 'pending'
     WHERE status = 'sending' AND attempted_at < NOW() - INTERVAL '10 minutes'`,
  )

  const { rows } = await pool.query(
    `SELECT q.id AS qid, q.recipient_email, q.campaign_id, q.source_key,
            c.subject, c.html_content, c.id AS cid
     FROM email_queue q
     LEFT JOIN email_campaigns c ON c.id = q.campaign_id
     WHERE q.status = 'pending'
     ORDER BY q.created_at ASC
     LIMIT $1`,
    [batchSize],
  )

  if (rows.length === 0) return { sent: 0, failed: 0 }

  // Lazy-load nodemailer so the module isn't required unless SMTP path triggers.
  // Untyped on purpose — optional runtime dep; add to package.json to enable.
  type Transport = { sendMail: (o: Record<string, unknown>) => Promise<unknown> }
  type CreateTransport = (opts: Record<string, unknown>) => Transport
  let createTransport: CreateTransport | null = null
  try {
    const mod = (await import(/* webpackIgnore: true */ 'nodemailer' as string)) as {
      createTransport?: CreateTransport
      default?: { createTransport?: CreateTransport }
    }
    createTransport = mod.createTransport || mod.default?.createTransport || null
  } catch {
    throw new Error('Chưa cài gói nodemailer')
  }
  if (!createTransport) throw new Error('nodemailer.createTransport không khả dụng')

  const transporter = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER

  let sent = 0
  let failed = 0
  for (const row of rows) {
    // Atomically claim the row so concurrent workers don't double-send.
    const claim = await pool.query(
      `UPDATE email_queue SET status = 'sending', attempted_at = NOW()
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [row.qid],
    )
    if ((claim.rowCount ?? 0) === 0) continue // another worker already claimed it

    try {
      let subject = row.subject as string | null
      let html = row.html_content as string | null
      // Fallback template for system notifications (campaign_id = NULL).
      if (!subject || !html) {
        if (typeof row.source_key === 'string' && row.source_key.startsWith('reminder_order_')) {
          subject = 'Đơn hàng của bạn đang chờ thanh toán'
          html = '<p>Xin chào,</p><p>Đơn hàng của bạn trên Thư Viện Số vẫn đang chờ thanh toán. Vui lòng hoàn tất thanh toán để chúng tôi xử lý đơn hàng.</p><p>Cảm ơn bạn đã sử dụng dịch vụ!</p>'
        } else {
          throw new Error('Campaign thiếu subject/nội dung')
        }
      }
      await transporter.sendMail({
        from: fromAddr,
        to: row.recipient_email,
        subject,
        html,
      })
      await pool.query(
        `UPDATE email_queue SET status = 'sent', attempted_at = NOW() WHERE id = $1`,
        [row.qid],
      )
      if (row.cid) {
        await pool.query(
          `UPDATE email_campaigns SET sent_count = COALESCE(sent_count, 0) + 1 WHERE id = $1`,
          [row.cid],
        )
      }
      sent++
    } catch (err) {
      await pool.query(
        `UPDATE email_queue SET status = 'failed', error = $1, attempted_at = NOW() WHERE id = $2`,
        [((err as Error).message || 'Error').slice(0, 1000), row.qid],
      )
      if (row.cid) {
        await pool.query(
          `UPDATE email_campaigns SET failed_count = COALESCE(failed_count, 0) + 1 WHERE id = $1`,
          [row.cid],
        )
      }
      failed++
    }
  }

  // Mark campaigns as completed when queue drained
  await pool.query(
    `UPDATE email_campaigns c
     SET status = 'completed', completed_at = NOW()
     WHERE c.status = 'sending'
       AND NOT EXISTS (
         SELECT 1 FROM email_queue q
         WHERE q.campaign_id = c.id AND q.status = 'pending'
       )`,
  )

  return { sent, failed }
}
