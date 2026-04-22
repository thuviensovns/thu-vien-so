import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

const id = process.argv[2] || '284'
const r = await client.query(`SELECT id, user_id, amount, status, transfer_code, credited_at, confirmed_at, created_at, updated_at FROM topups WHERE id = $1`, [id])
console.log(JSON.stringify(r.rows[0], null, 2))

await client.end()
