import { NextRequest, NextResponse } from 'next/server'
import { getFormatUrl } from '@/lib/youtube'

const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/

export async function POST(req: NextRequest) {
  try {
    const { url, formatId } = await req.json()

    if (!url || typeof url !== 'string' || !YOUTUBE_URL_REGEX.test(url)) {
      return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
    }

    if (!formatId || typeof formatId !== 'string' || !/^[\w.+-]{1,50}$/.test(formatId)) {
      return NextResponse.json({ error: 'Thiếu thông tin định dạng' }, { status: 400 })
    }

    const downloadUrl = await getFormatUrl(url, formatId)

    if (!downloadUrl) {
      return NextResponse.json({ error: 'Không thể tạo link tải' }, { status: 500 })
    }

    return NextResponse.json({ url: downloadUrl })
  } catch (err) {
    console.error('[YouTube Download]', err)
    return NextResponse.json(
      { error: 'Không thể tạo link tải. Vui lòng thử lại.' },
      { status: 500 }
    )
  }
}
