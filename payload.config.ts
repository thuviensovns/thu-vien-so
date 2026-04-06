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
    pool: {
      connectionString: process.env.DATABASE_URL!,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    },
  }),
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET!,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'src/types/payload-types.ts'),
  },
})
