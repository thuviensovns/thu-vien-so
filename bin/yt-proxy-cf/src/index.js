// yt-proxy-cf — Cloudflare Worker YouTube proxy.
// Endpoints: /health, /info, /stream, /debug (diagnostic).

const CLIENTS = {
  // Smart-TV client — YouTube's most permissive 2026 Innertube surface.
  TV: {
    clientName: 'TV',
    clientVersion: '2.0',
    clientNameHeader: '7',
    apiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    userAgent:
      'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version',
    extras: {
      clientScreen: 'WATCH',
      hl: 'en',
      gl: 'US',
      platform: 'TV',
    },
  },
  // TVHTML5 with modern version (2.0 is deprecated as of late 2025).
  TVHTML5: {
    clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
    clientVersion: '2.0',
    clientNameHeader: '85',
    apiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    userAgent:
      'Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
    extras: {
      clientScreen: 'EMBED',
      hl: 'en',
      gl: 'US',
      thirdParty: { embedUrl: 'https://www.youtube.com/' },
    },
  },
  // ANDROID with full context (osName, platform, utcOffsetMinutes fix HTTP 400).
  ANDROID: {
    clientName: 'ANDROID',
    clientVersion: '19.44.38',
    clientNameHeader: '3',
    apiKey: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    userAgent: 'com.google.android.youtube/19.44.38 (Linux; U; Android 14; en_US) gzip',
    extras: {
      androidSdkVersion: 34,
      osName: 'Android',
      osVersion: '14',
      platform: 'MOBILE',
      hl: 'en',
      gl: 'US',
      timeZone: 'UTC',
      utcOffsetMinutes: 0,
    },
  },
  // IOS with full context.
  IOS: {
    clientName: 'IOS',
    clientVersion: '19.45.4',
    clientNameHeader: '5',
    apiKey: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
    userAgent: 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)',
    extras: {
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      osName: 'iOS',
      osVersion: '18.1.0.22B83',
      platform: 'MOBILE',
      hl: 'en',
      gl: 'US',
      timeZone: 'UTC',
      utcOffsetMinutes: 0,
    },
  },
  // MWEB (mobile web) — sometimes returns direct URLs without PO token.
  MWEB: {
    clientName: 'MWEB',
    clientVersion: '2.20241201.00.00',
    clientNameHeader: '2',
    apiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    extras: {
      hl: 'en',
      gl: 'US',
      platform: 'MOBILE',
    },
  },
}

function extractVideoId(u) {
  const m = (u || '').match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] || null
}

async function callInnertube(videoId, cfg) {
  const body = {
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
    context: {
      client: {
        clientName: cfg.clientName,
        clientVersion: cfg.clientVersion,
        ...cfg.extras,
      },
    },
  }
  const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${cfg.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': cfg.userAgent,
      'X-YouTube-Client-Name': cfg.clientNameHeader,
      'X-YouTube-Client-Version': cfg.clientVersion,
      Origin: 'https://www.youtube.com',
      Referer: 'https://www.youtube.com/',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { httpStatus: res.status, data: null }
  return { httpStatus: res.status, data: await res.json() }
}

function pickBestFormat(data) {
  const formats = data?.streamingData?.formats || []
  const adaptive = data?.streamingData?.adaptiveFormats || []
  const all = [...formats, ...adaptive]
  const withUrl = all.filter((f) => f.url)
  if (withUrl.length === 0) return null
  withUrl.sort((a, b) => {
    // Prefer combined (has both video+audio). Formats (not adaptive) are always combined.
    const aCombined = formats.includes(a) ? 1 : 0
    const bCombined = formats.includes(b) ? 1 : 0
    if (aCombined !== bCombined) return bCombined - aCombined
    const aMp4 = (a.mimeType || '').includes('mp4') ? 1 : 0
    const bMp4 = (b.mimeType || '').includes('mp4') ? 1 : 0
    if (aMp4 !== bMp4) return bMp4 - aMp4
    return (b.bitrate || 0) - (a.bitrate || 0)
  })
  return withUrl[0]
}

async function fetchInfo(videoId, debug = false) {
  const attempts = []
  for (const [name, cfg] of Object.entries(CLIENTS)) {
    try {
      const { httpStatus, data } = await callInnertube(videoId, cfg)
      const status = data?.playabilityStatus?.status
      const reason = data?.playabilityStatus?.reason
      const formatCount = data?.streamingData?.formats?.length || 0
      const adaptiveCount = data?.streamingData?.adaptiveFormats?.length || 0
      const formatWithUrl =
        (data?.streamingData?.formats || []).filter((f) => f.url).length +
        (data?.streamingData?.adaptiveFormats || []).filter((f) => f.url).length
      attempts.push({
        client: name,
        httpStatus,
        playability: status,
        reason,
        formatCount,
        adaptiveCount,
        formatWithUrl,
      })
      if (!data || (status && status !== 'OK')) continue
      const fmt = pickBestFormat(data)
      if (!fmt) continue
      const d = data.videoDetails || {}
      const result = {
        id: videoId,
        title: d.title || '',
        channel: d.author || '',
        duration: Number(d.lengthSeconds) || 0,
        view_count: Number(d.viewCount) || 0,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        cdnUrl: fmt.url,
        client: name,
      }
      if (debug) result._attempts = attempts
      return result
    } catch (e) {
      attempts.push({ client: name, error: String(e.message || e) })
    }
  }
  return debug ? { _attempts: attempts } : null
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
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

      // /debug does NOT require secret — useful for diagnosing publicly
      if (url.pathname === '/debug') {
        const y = url.searchParams.get('url')
        const videoId = extractVideoId(y)
        if (!videoId) return json({ error: 'invalid url' }, 400)
        const result = await fetchInfo(videoId, true)
        return json(result || { error: 'total failure' })
      }

      if (env.PROXY_SECRET) {
        const got = request.headers.get('x-proxy-secret')
        if (got !== env.PROXY_SECRET) return json({ error: 'unauthorized' }, 401)
      }

      const y = url.searchParams.get('url')
      const videoId = extractVideoId(y)
      if (!videoId) return json({ error: 'invalid youtube url' }, 400)

      if (url.pathname === '/info') {
        const info = await fetchInfo(videoId)
        if (!info?.cdnUrl) return json({ error: 'no usable stream', id: videoId }, 404)
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
