// @ts-expect-error pg has no type declarations in this project
import pg from 'pg'

let pool: InstanceType<typeof pg.Pool> | null = null

/** Get a shared pg Pool instance for raw SQL queries */
export function getDbPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    })
  }
  return pool
}
