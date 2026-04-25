import { NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'

/** GET: Top deposit leaderboard for current month */
export async function GET() {
  try {
    const pool = getDbPool()
    // Leaderboard đồng bộ với /api/admin/topups/revenue: SUM(amount) tất cả
    // completed topups, chỉ loại COMM (hoa hồng affiliate, nội bộ). ADMIN cộng
    // tay tính là nạp thật cho khách; DEDUCT lưu âm tự nét ra correction
    // pairs. HAVING SUM > 0 ensures users với cộng nhầm + trừ nhầm net 0
    // không xuất hiện trên bảng top.
    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.display_name,
        u.email,
        SUM(t.amount)::bigint AS total_amount
      FROM topups t
      JOIN users u ON u.id = t.user_id
      WHERE t.status = 'completed'
        AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
        AND u.role = 'customer'
        AND u.email NOT LIKE 'test-%'
        AND u.email NOT LIKE '%test@%'
        AND u.email NOT LIKE '%@example.com'
        AND t.created_at >= date_trunc('month', CURRENT_DATE)
        AND t.created_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY u.id, u.display_name, u.email
      HAVING SUM(t.amount) > 0
      ORDER BY total_amount DESC
      LIMIT 10
    `)

    const res = NextResponse.json({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      leaderboard: rows.map((r: Record<string, unknown>, i: number) => ({
        rank: i + 1,
        displayName: maskName(String(r.display_name || r.email || 'Ẩn danh')),
        totalAmount: Number(r.total_amount),
      })),
    })
    // No cache — always sync with DB when new deposits come in
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res
  } catch (error) {
    console.error('[Topup leaderboard] Error:', error)
    return NextResponse.json({ leaderboard: [], month: new Date().getMonth() + 1, year: new Date().getFullYear() })
  }
}

/** Mask user name for privacy: "NguyenVanA" → "***yenVa**" */
function maskName(name: string): string {
  if (name.length <= 3) return '***'
  const atIdx = name.indexOf('@')
  if (atIdx > 0) name = name.slice(0, atIdx) // strip email domain
  if (name.length <= 3) return '***'
  const start = Math.min(3, Math.floor(name.length * 0.3))
  const end = Math.min(2, Math.floor(name.length * 0.2))
  return '***' + name.slice(start, name.length - end) + '**'
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
