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
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #00d9ff, #7c3aed)',
            backgroundClip: 'text',
            color: '#00d9ff',
          }}
        >
          ♫
        </span>
        <div
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
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
