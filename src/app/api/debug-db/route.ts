import { NextResponse } from 'next/server'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || 'NOT SET'
  // Mask the password
  const masked = dbUrl.replace(/:([^@]+)@/, ':***@')

  try {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })

    // Try a simple query
    const result = await payload.find({ collection: 'users', limit: 1 })

    return NextResponse.json({
      dbUrl: masked,
      status: 'connected',
      userCount: result.totalDocs,
    })
  } catch (error: any) {
    return NextResponse.json({
      dbUrl: masked,
      status: 'error',
      error: error?.message,
    })
  }
}

export const maxDuration = 60
