import { ImageResponse } from 'next/og'

export const alt = 'Thư Viện Số - Tài Nguyên Cho Producer'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Glow effect */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,217,255,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: 'rgba(0,217,255,0.1)',
              border: '2px solid rgba(0,217,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 700,
              color: '#00d9ff',
            }}
          >
            T
          </div>
          <span style={{ fontSize: 48, fontWeight: 700, color: '#f0f6fc' }}>
            Thư Viện <span style={{ color: '#00d9ff' }}>Số</span>
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: 24,
            color: '#8b949e',
            textAlign: 'center',
            maxWidth: 700,
            lineHeight: 1.5,
          }}
        >
          Download Sample Pack, FLP Project, VST Plugin & Preset cho Producer Việt Nam
        </p>

        {/* Tags */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 32,
          }}
        >
          {['Sample Pack', 'FLP Project', 'VST Plugin', 'Preset', 'EDM'].map((tag) => (
            <div
              key={tag}
              style={{
                padding: '8px 20px',
                borderRadius: 9999,
                background: 'rgba(0,217,255,0.08)',
                border: '1px solid rgba(0,217,255,0.2)',
                color: '#00d9ff',
                fontSize: 16,
                fontWeight: 500,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
