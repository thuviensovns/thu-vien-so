// yt-proxy-cf — Cloudflare Worker YouTube proxy.
// Calls YouTube's Innertube API directly (no youtubei.js lib → minimal CPU).
// Endpoints: /health, /info, /stream.
//
// Deploy:  npm install && npx wrangler login && npx wrangler secret put PROXY_SECRET && npx wrangler deploy

/**
 * Innertube client configs. Each posts to /youtubei/v1/player and gets back
 * streamingData with direct-URL formats (no cipher parsing needed).
 */
const CLIENTS = {
  ANDROID: {
    clientName: 'ANDROID',
    clientVersion: '19.09.36',
    clientNameHeader: '3',
    apiKey: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    userAgent: 'com.google.android.youtube/19.09.36 (Linux; U; Android 14) gzip',
    extras: { androidSdkVersion: 34, hl: 'en', gl: 'US' },
  },
  IOS: {
    clientName: 'IOS',
    clientVersion: '19.09.3',
    clientNameHeader: '5',
    apiKey: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
    userAgent: 'com.google.ios.youtube/19.09.3 (iPhone16,2; U; CPU iOS 17_2_1 like Mac OS X;)',
    extras: { deviceMake: 'Apple', deviceModel: 'iPhone16,2', hl: 'en', gl: 'US' },
  },
}

function extractVideoId(u) {
  const m = (u || '').match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] || null
}

async function callInnertube(videoId, cfg) {
  const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${cfg.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': cfg.userAgent,
      'X-YouTube-Client-Name': cfg.clientNameHeader,
      'X-YouTube-Client-Version': cfg.clientVersion,
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: cfg.clientName,
          clientVersion: cfg.clientVersion,
          ...cfg.extras,
        },
      },
    }),
  })
  if (!res.ok) return null
  return await res.json()
}

/**
 * Pick the best combined (video+audio) MP4 format from Innertube response.
 * Prefers highest bitrate in streamingData.formats (combined streams).
 */
function pickBestFormat(data) {
  const formats = data?.streamingData?.formats || []
  const withUrl = formats.filter((f) => f.url)
  if (withUrl.length === 0) return null
  // Sort by bitrate desc; prefer mp4 mime
  withUrl.sort((a, b) => {
    const aMp4 = (a.mimeType || '').includes('mp4') ? 1 : 0
    const bMp4 = (b.mimeType || '').includes('mp4') ? 1 : 0
    if (aMp4 !== bMp4) return bMp4 - aMp4
    return (b.bitrate || 0) - (a.bitrate || 0)
  })
  return withUrl[0]
}

async function fetchInfo(videoId) {
  for (const [name, cfg] of Object.entries(CLIENTS)) {
    try {
      const data = await callInnertube(videoId, cfg)
      if (!data) continue
      const status = data.playabilityStatus?.status
      if (status && status !== 'OK') {
        console.log(`client=${name} playability=${status} reason=${data.playabilityStatus?.reason}`)
        continue
      }
      const fmt = pickBestFormat(data)
      if (!fmt) {
        console.log(`client=${name} no direct-URL format`)
        continue
      }
      const d = data.videoDetails || {}
      return {
        id: videoId,
        title: d.title || '',
        channel: d.author || '',
        duration: Number(d.lengthSeconds) || 0,
        view_count: Number(d.viewCount) || 0,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        cdnUrl: fmt.url,
        client: name,
      }
    } catch (e) {
      console.log(`client=${name} error:`, e.message)
    }
  }
  return null
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-proxy-secret',
    },
  })
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url)

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-proxy-secret',
          },
        })
      }

      if (url.pathname === '/health') {
        return json({ ok: true, ts: Date.now() })
      }

      // Auth
      if (env.PROXY_SECRET) {
        const got = request.headers.get('x-proxy-secret')
        if (got !== env.PROXY_SECRET) return json({ error: 'unauthorized' }, 401)
      }

      const y = url.searchParams.get('url')
      const videoId = extractVideoId(y)
      if (!videoId) return json({ error: 'invalid youtube url' }, 400)

      if (url.pathname === '/info') {
        const info = await fetchInfo(videoId)
        if (!info) return json({ error: 'no usable stream', id: videoId }, 404)
        return json(info)
      }

      if (url.pathname === '/stream') {
        const info = await fetchInfo(videoId)
        if (!info?.cdnUrl) return json({ error: 'no stream' }, 404)
        const upstream = await fetch(info.cdnUrl, {
          headers: {
            'User-Agent': CLIENTS.ANDROID.userAgent,
            Accept: '*/*',
          },
          cf: { cacheTtl: 0 },
        })
        if (!upstream.ok) return json({ error: `CDN ${upstream.status}` }, 502)
        // Stream body directly back — no buffering, no 100MB limit.
        return new Response(upstream.body, {
          status: 200,
          headers: {
            'Content-Type': upstream.headers.get('content-type') || 'video/mp4',
            'Content-Length': upstream.headers.get('content-length') || '',
            'Cache-Control': 'no-store',
          },
        })
      }

      return json({ error: 'not found' }, 404)
    } catch (e) {
      console.error('worker error:', e)
      return json({ error: String(e.message || e) }, 500)
    }
  },
}
