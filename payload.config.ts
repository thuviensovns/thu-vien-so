import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from '@/collections/Users'
import { Media } from '@/collections/Media'
import { Products } from '@/collections/Products'
import { Categories } from '@/collections/Categories'
import { Orders } from '@/collections/Orders'
import { Downloads } from '@/collections/Downloads'
import { BlogPosts } from '@/collections/BlogPosts'
import { ContactMessages } from '@/collections/ContactMessages'
import { TopUps } from '@/collections/TopUps'
// Coupons and ActivityLogs use raw SQL (not Payload collections) to avoid
// payload_locked_documents_rels column sync issues on Vercel serverless
import { BankConfig } from '@/globals/BankConfig'
import { SiteContent } from '@/globals/SiteContent'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users',
    meta: {
      titleSuffix: '| Thư Viện Số',
      description: 'Hệ thống quản trị Thư Viện Số',
    },
    dateFormat: 'dd/MM/yyyy HH:mm',
  },
  collections: [Users, Media, Products, Categories, Orders, Downloads, TopUps, BlogPosts, ContactMessages],
  globals: [BankConfig, SiteContent],
  db: postgresAdapter({
    // Disable schema auto-push: current schema has orphan tables (activity_logs
    // with live data, _status column on products) that Payload would delete on
    // every startup. Preserve them until a proper migration is authored.
    push: false,
    pool: {
      connectionString: process.env.DATABASE_URL!,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    },
  }),
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET!,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'src/types/payload-types.ts'),
  },
})
