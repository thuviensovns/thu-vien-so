import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { requirePermission } from '@/lib/authz'

/** GET /api/admin/users/search?q=<keyword>&limit=100
 *
 *  Cross-table search. Matches keyword against:
 *    - users.email / users.display_name / users.id
 *    - topups.transfer_code / bank_description / bank_transaction_id
 *    - orders.order_number / transfer_code / customer_email / customer_name
 *      / customer_phone / note
 *
 *  Returns each matched user with up to 5 topup + 5 order snippets that show
 *  WHY the user matched, so admins can verify the hit context inline.
 */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'users.view')
  if (guard instanceof NextResponse) return guard

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') || '').trim()
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 100, 1), 500)

  if (q.length < 2) {
    return NextResponse.json({ docs: [], total: 0, q })
  }

  const pattern = `%${q}%`
  const idMatch = /^\d+$/.test(q) ? Number(q) : null

  try {
    const pool = getDbPool()
    const { rows } = await pool.query(
      `WITH
       topup_matches AS (
         SELECT t.user_id,
                jsonb_agg(jsonb_build_object(
                  'id', t.id,
                  'transferCode', t.transfer_code,
                  'bankDescription', t.bank_description,
                  'bankTransactionId', t.bank_transaction_id,
                  'amount', t.amount,
                  'status', t.status,
                  'createdAt', t.created_at
                ) ORDER BY t.created_at DESC) AS items
         FROM (
           SELECT id, user_id, transfer_code, bank_description, bank_transaction_id,
                  amount, status, created_at,
                  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
           FROM topups
           WHERE user_id IS NOT NULL AND (
             transfer_code ILIKE $1
             OR bank_description ILIKE $1
             OR bank_transaction_id ILIKE $1
           )
         ) t
         WHERE t.rn <= 5
         GROUP BY t.user_id
       ),
       order_matches AS (
         SELECT o.user_id,
                jsonb_agg(jsonb_build_object(
                  'id', o.id,
                  'orderNumber', o.order_number,
                  'transferCode', o.transfer_code,
                  'customerEmail', o.customer_email,
                  'customerName', o.customer_name,
                  'customerPhone', o.customer_phone,
                  'note', o.note,
                  'total', o.total,
                  'status', o.status,
                  'createdAt', o.created_at
                ) ORDER BY o.created_at DESC) AS items
         FROM (
           SELECT id, user_id, order_number, transfer_code, customer_email,
                  customer_name, customer_phone, note, total, status, created_at,
                  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
           FROM orders
           WHERE user_id IS NOT NULL AND (
             order_number ILIKE $1
             OR transfer_code ILIKE $1
             OR note ILIKE $1
             OR customer_email ILIKE $1
             OR customer_name ILIKE $1
             OR customer_phone ILIKE $1
           )
         ) o
         WHERE o.rn <= 5
         GROUP BY o.user_id
       ),
       user_matches AS (
         SELECT id FROM users
         WHERE email ILIKE $1
            OR display_name ILIKE $1
            OR ($2::int IS NOT NULL AND id = $2::int)
       )
       SELECT u.id, u.email, u.display_name, u.balance, u.role, u.created_at,
              COALESCE(tm.items, '[]'::jsonb) AS topup_matches,
              COALESCE(om.items, '[]'::jsonb) AS order_matches,
              (u.id IN (SELECT id FROM user_matches)) AS matched_user_field
       FROM users u
       LEFT JOIN topup_matches tm ON tm.user_id = u.id
       LEFT JOIN order_matches  om ON om.user_id = u.id
       WHERE u.id IN (SELECT id FROM user_matches)
          OR tm.user_id IS NOT NULL
          OR om.user_id IS NOT NULL
       ORDER BY u.created_at DESC
       LIMIT $3`,
      [pattern, idMatch, limit],
    )

    interface Row {
      id: number
      email: string
      display_name: string | null
      balance: number | string | null
      role: string | null
      created_at: string
      matched_user_field: boolean
      topup_matches: unknown[]
      order_matches: unknown[]
    }
    return NextResponse.json({
      q,
      total: rows.length,
      docs: (rows as Row[]).map((r) => ({
        id: String(r.id),
        email: r.email,
        displayName: r.display_name || '',
        balance: Number(r.balance || 0),
        role: r.role || 'customer',
        createdAt: r.created_at,
        matchedUserField: !!r.matched_user_field,
        topupMatches: r.topup_matches || [],
        orderMatches: r.order_matches || [],
      })),
    })
  } catch (error) {
    console.error('[admin/users/search] error:', error)
    return NextResponse.json(
      { docs: [], total: 0, q, error: (error as Error).message },
      { status: 500 },
    )
  }
}
