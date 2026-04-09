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
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Floating musical notes background */}
        <div style={{ position: 'absolute', top: 40, left: 80, fontSize: 60, color: 'rgba(0,217,255,0.06)', display: 'flex' }}>♪</div>
        <div style={{ position: 'absolute', top: 120, right: 120, fontSize: 80, color: 'rgba(217,70,239,0.06)', display: 'flex' }}>♫</div>
        <div style={{ position: 'absolute', bottom: 80, left: 200, fontSize: 70, color: 'rgba(0,217,255,0.05)', display: 'flex' }}>♬</div>
        <div style={{ position: 'absolute', bottom: 40, right: 80, fontSize: 50, color: 'rgba(217,70,239,0.05)', display: 'flex' }}>♪</div>
        <div style={{ position: 'absolute', top: 60, left: 400, fontSize: 40, color: 'rgba(0,217,255,0.04)', display: 'flex' }}>♫</div>
        <div style={{ position: 'absolute', bottom: 150, right: 350, fontSize: 45, color: 'rgba(217,70,239,0.04)', display: 'flex' }}>♪</div>

        {/* Center glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,217,255,0.12) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(0,217,255,0.15), rgba(124,58,237,0.15))',
              border: '2px solid rgba(0,217,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 38,
              color: '#00d9ff',
            }}
          >
            ♫
          </div>
          <span style={{ fontSize: 52, fontWeight: 800, color: '#f0f6fc', letterSpacing: -1 }}>
            Thư Viện{' '}
            <span style={{ color: '#00d9ff' }}>Số</span>
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

        {/* Tags with musical icons */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 36,
          }}
        >
          {[
            { icon: '♪', label: 'Sample Pack' },
            { icon: '♬', label: 'FLP Project' },
            { icon: '⚡', label: 'VST Plugin' },
            { icon: '♫', label: 'Preset' },
            { icon: '🎧', label: 'EDM' },
          ].map((tag) => (
            <div
              key={tag.label}
              style={{
                padding: '10px 22px',
                borderRadius: 9999,
                background: 'rgba(0,217,255,0.08)',
                border: '1px solid rgba(0,217,255,0.2)',
                color: '#00d9ff',
                fontSize: 16,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{tag.icon}</span>
              {tag.label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
