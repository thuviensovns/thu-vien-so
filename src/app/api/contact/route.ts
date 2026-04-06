import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

export async function POST(req: NextRequest) {
  try {
    let body: { name?: string; email?: string; subject?: string; message?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ họ tên, email và nội dung.' },
        { status: 400 },
      )
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email không hợp lệ.' }, { status: 400 })
    }

    // Length limits
    if (name.length > 200 || email.length > 254 || subject.length > 500 || message.length > 5000) {
      return NextResponse.json({ error: 'Nội dung vượt quá giới hạn cho phép.' }, { status: 400 })
    }

    if (message.length < 10) {
      return NextResponse.json({ error: 'Nội dung tin nhắn quá ngắn (tối thiểu 10 ký tự).' }, { status: 400 })
    }

    const payload = await getPayloadForApi()

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'

    await payload.create({
      collection: 'contact-messages',
      overrideAccess: true,
      data: {
        name,
        email,
        subject: subject || 'Không có tiêu đề',
        message,
        status: 'new',
        ipAddress: ip,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact form error:', error)
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'timeout' || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Hệ thống đang bận, vui lòng thử lại sau.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại.' }, { status: 500 })
  }
}
