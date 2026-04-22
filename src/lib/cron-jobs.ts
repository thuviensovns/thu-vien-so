import { getDbPool } from './db-pool'
import { registerCron } from './cron-registry'
import { AUTO_BLOCK_DURATION_HOURS } from './ip-security'

/** Registry of all server-side cron jobs.
 *  Each registration attaches a handler and metadata; the /api/admin/cron/run
 *  endpoint actually executes them. */

// Cleanup old failed login attempts (retain 30 days)
registerCron({
  key: 'cleanup_failed_attempts',
  name: 'Dọn lịch sử đăng nhập thất bại',
  description: 'Xóa các bản ghi cũ hơn 30 ngày từ failed_login_attempts',
  recommendedInterval: '24h',
  handler: async () => {
    const pool = getDbPool()
    const res = await pool.query(
      `DELETE FROM failed_login_attempts WHERE created_at < NOW() - INTERVAL '30 days'`,
    )
    return { message: `Xóa ${res.rowCount} bản ghi cũ` }
  },
})

// Cleanup expired auto-blocks
registerCron({
  key: 'cleanup_expired_blocks',
  name: 'Xóa IP chặn hết hạn',
  description: `Xóa các blocked_ips đã hết hạn, không áp dụng cho chặn vĩnh viễn`,
  recommendedInterval: '1h',
  handler: async () => {
    const pool = getDbPool()
    const res = await pool.query(
      `DELETE FROM blocked_ips WHERE is_permanent = false AND blocked_until IS NOT NULL AND blocked_until <= NOW()`,
    )
    return { message: `Xóa ${res.rowCount} IP hết hạn (auto-block ${AUTO_BLOCK_DURATION_HOURS}h)` }
  },
})

// Cleanup old activity logs (retain 180 days)
registerCron({
  key: 'cleanup_activity_logs',
  name: 'Dọn nhật ký hoạt động cũ',
  description: 'Xóa activity_logs cũ hơn 180 ngày',
  recommendedInterval: '24h',
  handler: async () => {
    const pool = getDbPool()
    const res = await pool.query(
      `DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '180 days'`,
    )
    return { message: `Xóa ${res.rowCount} log cũ` }
  },
})

// Email queue sender (placeholder — implemented fully in Phase 6)
registerCron({
  key: 'send_email_queue',
  name: 'Gửi hàng đợi email',
  description: 'Gửi các email đang pending trong email_queue (cần cấu hình SMTP)',
  recommendedInterval: '5m',
  handler: async () => {
    try {
      const { processEmailQueue } = await import('./email-sender')
      const result = await processEmailQueue()
      return { message: `Gửi ${result.sent}, lỗi ${result.failed}` }
    } catch {
      return { message: 'Email sender chưa được cấu hình' }
    }
  },
})

// Web2M bank polling — fetch transaction history and auto-credit users
registerCron({
  key: 'poll_web2m',
  name: 'Tự động cộng tiền qua Web2M',
  description: 'Gọi api.web2m.com, lọc giao dịch CRDT, khớp mã NAP/MUS rồi cộng tiền cho khách',
  recommendedInterval: '2m',
  handler: async () => {
    const { pollWeb2m } = await import('./web2m-poll')
    const result = await pollWeb2m()
    return { message: result.message }
  },
})

// Automations runner (placeholder — implemented fully in Phase 7)
registerCron({
  key: 'run_automations',
  name: 'Chạy automation rules',
  description: 'Thực thi các rule active trong bảng automations',
  recommendedInterval: '5m',
  handler: async () => {
    try {
      const { runAutomations } = await import('./automations-runner')
      const result = await runAutomations()
      return { message: `Chạy ${result.executed} rule` }
    } catch {
      return { message: 'Automations runner chưa được cấu hình' }
    }
  },
})
