import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'img.vietqr.io' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
  },
  serverExternalPackages: ['youtubei.js', 'youtube-po-token-generator'],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      'sonner',
    ],
    // Next.js 15 middleware caps the client body it inspects at 1MB by default
    // and silently truncates larger uploads — which makes req.formData() in the
    // downstream route handler hang on MP3/MP4 admin uploads. Raise it to 50MB.
    // (proxyClientMaxBodySize was added in 15.5; this repo is still on 15.4.)
    middlewareClientMaxBodySize: '50mb',
  },
  poweredByHeader: false,
  compress: true,
}

export default withPayload(nextConfig)
