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
import { spawn } from 'node:child_process'
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

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)),
  ])
}

// Cache PO token across Innertube rebuilds (generation is expensive: ~2-5s + jsdom memory).
let cachedPoToken = null
let cachedVisitorData = null
let poTokenAt = 0
const POTOKEN_TTL = 6 * 60 * 60_000 // 6h

function runPoWorker() {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, 'po-worker.mjs')
    const child = spawn(process.execPath, ['--max-old-space-size=512', workerPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { err += d })
    const to = setTimeout(() => {
      try { child.kill('SIGKILL') } catch {}
      reject(new Error('po-worker timeout'))
    }, 20_000)
    child.on('exit', (code) => {
      clearTimeout(to)
      if (code !== 0) return reject(new Error(`po-worker exit=${code} ${err.slice(0, 200)}`))
      try {
        const parsed = JSON.parse(out)
        if (!parsed.poToken) return reject(new Error('po-worker no token'))
        resolve(parsed)
      } catch (e) { reject(e) }
    })
    child.on('error', reject)
  })
}

async function getPoToken() {
  const now = Date.now()
  if (cachedPoToken && now - poTokenAt < POTOKEN_TTL) {
    return { poToken: cachedPoToken, visitorData: cachedVisitorData }
  }
  try {
    const { poToken, visitorData } = await runPoWorker()
    cachedPoToken = poToken
    cachedVisitorData = visitorData
    poTokenAt = now
    console.log('[yt-proxy] PO token generated (child)')
    return { poToken, visitorData }
  } catch (e) {
    console.warn('[yt-proxy] PO token generation failed:', e.message)
    return { poToken: null, visitorData: null }
  }
}

async function getInnertube() {
  const now = Date.now()
  if (!innertubeInstance || now - instanceCreatedAt > INSTANCE_TTL) {
    const { poToken, visitorData } = await getPoToken()
    const opts = { generate_session_locally: true }
    if (poToken && visitorData) {
      opts.po_token = poToken
      opts.visitor_data = visitorData
    }
    innertubeInstance = await Innertube.create(opts)
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

async function fetchInfo(videoId, kind = 'video', _retry = false) {
  const yt = await getInnertube()
  // TV_EMBEDDED and WEB_EMBEDDED bypass LOGIN_REQUIRED for most non-age-restricted videos.
  const clients = ['TV_EMBEDDED', 'WEB_EMBEDDED', 'ANDROID', 'IOS', 'MWEB', 'WEB']
  for (const client of clients) {
    try {
      const info = await yt.getBasicInfo(videoId, { client })
      const sd = info.streaming_data
      if (!sd) {
        console.log(`[yt-proxy] ${videoId} client=${client} no streaming_data (playability=${info.playability_status?.status || '?'})`)
        continue
      }

      let chosen = null
      let mime = null
      let contentLength = 0
      let isAdaptive = false

      if (kind === 'audio') {
        // Prefer adaptive audio-only (m4a/mp4a). Falls back to combined if none.
        const audioOnly = (sd.adaptive_formats || []).filter(f =>
          (f.mime_type || '').startsWith('audio/'),
        )
        audioOnly.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
        for (const f of audioOnly) {
          const u = await resolveFormatUrl(f, yt.session.player)
          if (u) {
            chosen = u
            mime = f.mime_type
            contentLength = Number(f.content_length) || 0
            isAdaptive = true
            break
          }
        }
      }

      if (!chosen) {
        for (const f of sd.formats || []) {
          const u = await resolveFormatUrl(f, yt.session.player)
          if (u) {
            chosen = u
            mime = f.mime_type || 'video/mp4'
            contentLength = Number(f.content_length) || 0
            break
          }
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
          contentLength,
          isAdaptive,
          client,
        }
      }
      console.log(`[yt-proxy] ${videoId} client=${client} no usable URL (formats=${sd.formats?.length || 0} adaptive=${sd.adaptive_formats?.length || 0})`)
    } catch (e) {
      console.log(`[yt-proxy] ${videoId} client=${client} error: ${String(e.message || e).slice(0, 200)}`)
    }
  }
  // If nothing worked and we haven't retried yet, rebuild the Innertube session once.
  if (!_retry) {
    console.log(`[yt-proxy] ${videoId} refreshing Innertube session & retrying`)
    innertubeInstance = null
    return fetchInfo(videoId, kind, true)
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

/**
 * Stream in bounded-range chunks. YouTube's adaptive (DASH) audio URLs 403 any
 * Range > ~256KB or unbounded `bytes=0-`. Sequential 200KB chunks stay under
 * the throttle ceiling and concatenate into a complete file client-side.
 */
function streamChunked(url, res, filename, forcedType, totalLength) {
  const CHUNK = 200 * 1024
  const UA = 'com.google.android.youtube/19.09.36 (Linux; U; Android 14) gzip'

  const headers = {
    'Content-Type': forcedType || 'audio/mp4',
    'Content-Length': String(totalLength),
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

  let pos = 0
  let cancelled = false
  res.on('close', () => { cancelled = true })

  function fetchNext() {
    if (cancelled) return
    if (pos >= totalLength) { res.end(); return }
    const end = Math.min(pos + CHUNK - 1, totalLength - 1)
    const rangeStart = pos
    const req = https.get(url, { headers: { 'User-Agent': UA, Range: `bytes=${rangeStart}-${end}` } }, (up) => {
      if (up.statusCode !== 206 && up.statusCode !== 200) {
        console.error(`[yt-proxy] chunk ${rangeStart}-${end} -> ${up.statusCode}`)
        res.destroy(new Error(`CDN returned ${up.statusCode} for chunk`))
        return
      }
      up.on('data', (buf) => {
        if (!cancelled) res.write(buf)
      })
      up.on('end', () => {
        pos = end + 1
        fetchNext()
      })
      up.on('error', (e) => {
        console.error('[yt-proxy] chunk stream error:', e.message)
        res.destroy(e)
      })
    })
    req.setTimeout(30_000, () => req.destroy(new Error('chunk timeout')))
    req.on('error', (e) => {
      console.error('[yt-proxy] chunk req error:', e.message)
      if (!res.headersSent) sendJson(res, 502, { error: e.message })
      else res.destroy(e)
    })
  }
  fetchNext()
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
        streamFromCdn(upstream.headers.location, res, filename, forcedType)
        return
      }
      if (upstream.statusCode !== 200 && upstream.statusCode !== 206) {
        sendJson(res, 502, { error: `CDN returned ${upstream.statusCode}` })
        return
      }
      // Derive full length: prefer Content-Range total, fall back to Content-Length.
      let contentLength = upstream.headers['content-length'] || ''
      const cr = upstream.headers['content-range']
      if (cr) {
        const m = /\/(\d+)$/.exec(cr)
        if (m) contentLength = m[1]
      }
      const headers = {
        'Content-Type': forcedType || upstream.headers['content-type'] || 'video/mp4',
        'Content-Length': contentLength,
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
      const isAudio = kind === 'audio' && info.mime?.startsWith('audio/')
      const isWebm = (info.mime || '').includes('webm')
      const ext = isAudio ? (isWebm ? 'weba' : 'm4a') : 'mp4'
      const filename = url.searchParams.get('filename') || `${info.title || videoId}.${ext}`
      const forcedType = isAudio ? info.mime.split(';')[0] : null
      if (info.isAdaptive && info.contentLength > 0) {
        streamChunked(info.cdnUrl, res, filename, forcedType, info.contentLength)
      } else {
        streamFromCdn(info.cdnUrl, res, filename, forcedType)
      }
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
