import type { Metadata } from 'next'
import { YoutubeDownloader } from '@/components/youtube/YoutubeDownloader'

export const metadata: Metadata = {
  title: 'Tải Video YouTube MP3/MP4',
  description: 'Tải nhạc MP3 và video MP4 từ YouTube miễn phí, nhanh chóng. Hỗ trợ nhiều chất lượng từ 128kbps đến 320kbps (MP3) và 360p đến 1080p (MP4).',
}

export default function TaiYoutubePage() {
  return (
    <main className="container max-w-4xl mx-auto py-8 px-4">
      <YoutubeDownloader />
    </main>
  )
}
