// yt-proxy — Local YouTube proxy server.
// Runs on your PC's residential IP (which YouTube doesn't block, unlike Vercel's datacenter IPs).
// Vercel calls this server via Cloudflare Tunnel → fetch YouTube → stream back.
//
// Setup:
//   npm install
//   cp .env.example .env   (then edit PROXY_SECRET)
//   npm start              (port 3001)
//   npm run tunnel         (in another terminal — exposes public URL)
//
// Set Vercel env: YT_PROXY_URL=https://<your>.trycloudflare.com, YT_PROXY_SECRET=<same as .env>

import http from 'node:http'
import https from 'node:https'
import { Innertube } from 'youtubei.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env if present (no dep)
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i)
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const PORT = Number(process.env.PORT || 3001)
const SECRET = process.env.PROXY_SECRET || ''
if (!SECRET) {
  console.warn('[yt-proxy] ⚠ PROXY_SECRET not set — server will accept any request. Set it in .env for security.')
}

// ---------- YouTube ----------

let innertubeInstance = null
let instanceCreatedAt = 0
const INSTANCE_TTL = 30 * 60_000

async function getInnertube() {
  const now = Date.now()
  if (!innertubeInstance || now - instanceCreatedAt > INSTANCE_TTL) {
    innertubeInstance = await Innertube.create({ generate_session_locally: true })
    instanceCreatedAt = now
  }
  return innertubeInstance
}

function extractVideoId(u) {
  const m = (u || '').match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] || null
}

async function resolveFormatUrl(fmt, player) {
  if (fmt.url) return fmt.url
  try { return await fmt.decipher(player) } catch { return null }
}

async function fetchInfo(videoId, kind = 'video') {
  const yt = await getInnertube()
  const clients = ['ANDROID', 'IOS', 'MWEB', 'WEB']
  for (const client of clients) {
    try {
      const info = await yt.getBasicInfo(videoId, { client })
      const sd = info.streaming_data
      if (!sd) continue

      let chosen = null
      let mime = null

      if (kind === 'audio') {
        // Prefer adaptive audio-only (m4a/mp4a). Falls back to combined if none.
        const audioOnly = (sd.adaptive_formats || []).filter(f =>
          (f.mime_type || '').startsWith('audio/'),
        )
        audioOnly.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
        for (const f of audioOnly) {
          const u = await resolveFormatUrl(f, yt.session.player)
          if (u) { chosen = u; mime = f.mime_type; break }
        }
      }

      if (!chosen) {
        for (const f of sd.formats || []) {
          const u = await resolveFormatUrl(f, yt.session.player)
          if (u) { chosen = u; mime = f.mime_type || 'video/mp4'; break }
        }
      }

      if (chosen) {
        const d = info.basic_info
        return {
          id: videoId,
          title: d.title || '',
          channel: d.channel?.name || d.author || '',
          duration: d.duration || 0,
          view_count: d.view_count || 0,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          cdnUrl: chosen,
          mime: mime || 'video/mp4',
          client,
        }
      }
      console.log(`[yt-proxy] ${videoId} client=${client} no usable URL`)
    } catch (e) {
      console.log(`[yt-proxy] ${videoId} client=${client} error: ${String(e.message || e).slice(0, 100)}`)
    }
  }
  return null
}

// ---------- HTTP helpers ----------

function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(obj))
}

function requireAuth(req, res, urlObj) {
  if (!SECRET) return true
  const got = req.headers['x-proxy-secret'] || urlObj?.searchParams.get('secret')
  if (got !== SECRET) {
    sendJson(res, 401, { error: 'unauthorized' })
    return false
  }
  return true
}

function streamFromCdn(url, res, filename, forcedType) {
  const req = https.get(
    url,
    {
      headers: {
        'User-Agent': 'com.google.android.youtube/19.09.36 (Linux; U; Android 14) gzip',
        Accept: '*/*',
      },
    },
    (upstream) => {
      if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
        streamFromCdn(upstream.headers.location, res)
        return
      }
      if (upstream.statusCode !== 200) {
        sendJson(res, 502, { error: `CDN returned ${upstream.statusCode}` })
        return
      }
      const headers = {
        'Content-Type': forcedType || upstream.headers['content-type'] || 'video/mp4',
        'Content-Length': upstream.headers['content-length'] || '',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Disposition',
      }
      if (filename) {
        const safe = filename.replace(/"/g, '')
        headers['Content-Disposition'] =
          `attachment; filename="${safe.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safe)}`
      }
      res.writeHead(200, headers)
      upstream.pipe(res)
    },
  )
  req.setTimeout(60_000, () => req.destroy(new Error('CDN timeout')))
  req.on('error', (err) => {
    console.error('[yt-proxy] CDN error:', err.message)
    if (!res.headersSent) sendJson(res, 502, { error: err.message })
    else res.destroy()
  })
}

// ---------- Routes ----------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)

    // Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-proxy-secret, ngrok-skip-browser-warning',
      })
      res.end()
      return
    }

    // Health check (no auth)
    if (url.pathname === '/health') {
      sendJson(res, 200, { ok: true, ts: Date.now() })
      return
    }

    if (!requireAuth(req, res, url)) return

    // GET /info?url=...&kind=video|audio
    if (req.method === 'GET' && url.pathname === '/info') {
      const y = url.searchParams.get('url')
      const kind = url.searchParams.get('kind') === 'audio' ? 'audio' : 'video'
      const videoId = extractVideoId(y)
      if (!videoId) return sendJson(res, 400, { error: 'invalid youtube url' })
      const info = await fetchInfo(videoId, kind)
      if (!info) return sendJson(res, 404, { error: 'no usable stream found', id: videoId })
      sendJson(res, 200, info)
      return
    }

    // GET /stream?url=...&kind=video|audio  — proxy the actual media bytes
    if (req.method === 'GET' && url.pathname === '/stream') {
      const y = url.searchParams.get('url')
      const kind = url.searchParams.get('kind') === 'audio' ? 'audio' : 'video'
      const videoId = extractVideoId(y)
      if (!videoId) return sendJson(res, 400, { error: 'invalid youtube url' })
      const info = await fetchInfo(videoId, kind)
      if (!info?.cdnUrl) return sendJson(res, 404, { error: 'no stream' })
      const ext = kind === 'audio' ? 'm4a' : 'mp4'
      const filename = url.searchParams.get('filename') || `${info.title || videoId}.${ext}`
      const forcedType = kind === 'audio' ? (info.mime?.startsWith('audio/') ? info.mime.split(';')[0] : 'audio/mp4') : null
      streamFromCdn(info.cdnUrl, res, filename, forcedType)
      return
    }

    sendJson(res, 404, { error: 'not found' })
  } catch (e) {
    console.error('[yt-proxy]', e)
    if (!res.headersSent) sendJson(res, 500, { error: String(e.message || e) })
  }
})

server.listen(PORT, () => {
  console.log(`[yt-proxy] listening on http://localhost:${PORT}`)
  console.log(`[yt-proxy] health: http://localhost:${PORT}/health`)
  console.log(`[yt-proxy] secret: ${SECRET ? 'ENABLED' : 'DISABLED (insecure)'}`)
})
