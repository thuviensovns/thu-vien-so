import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='orders' ORDER BY ordinal_position`)
console.log('orders columns:', cols.rows.map(x=>x.column_name).join(', '))
const items = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'orders%' OR table_name LIKE '%items%' ORDER BY table_name`)
console.log('order/items tables:', items.rows.map(x=>x.table_name).join(', '))
const itemCols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='orders_items' ORDER BY ordinal_position`)
console.log('orders_items columns:', itemCols.rows.map(x=>x.column_name).join(', '))
await c.end()
