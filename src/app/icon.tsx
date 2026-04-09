import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: 'linear-gradient(135deg, #0d1117, #161b22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(0,217,255,0.1), rgba(124,58,237,0.1))',
            display: 'flex',
          }}
        />
        {/* Musical notes symbol */}
        <span
          style={{
            fontSize: 18,
            color: '#00d9ff',
            position: 'relative',
            fontWeight: 700,
          }}
        >
          ♫
        </span>
        {/* Glow dot */}
        <div
          style={{
            position: 'absolute',
            top: 1,
            right: 1,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#d946ef',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
