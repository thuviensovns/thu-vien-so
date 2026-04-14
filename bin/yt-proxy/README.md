# yt-proxy — Local YouTube Proxy

Runs on **your PC's residential IP** to bypass YouTube's block on Vercel datacenter IPs.

```
Browser → Vercel /api/youtube-download → [Cloudflare Tunnel] → Your PC → YouTube
```

## One-time setup

### 1. Install cloudflared (Windows)

Download from https://github.com/cloudflare/cloudflared/releases/latest
(file: `cloudflared-windows-amd64.exe`) → rename to `cloudflared.exe` → put in:
- `C:\Windows\System32\` (available everywhere), OR
- This folder (`bin/yt-proxy/`)

Verify: open cmd → `cloudflared --version`

### 2. Configure secret

```cmd
cd bin\yt-proxy
copy .env.example .env
notepad .env
```

Replace `change-me-to-a-long-random-string` with a random 48+ character string.
**Copy this exact string — you'll paste it into Vercel next.**

### 3. Install deps

```cmd
npm install
```

### 4. Set Vercel env vars

Go to https://vercel.com → your project → Settings → Environment Variables → add:

| Name | Value |
|---|---|
| `YT_PROXY_URL` | (leave blank for now, will get after step 5) |
| `YT_PROXY_SECRET` | (same string you put in `.env`) |

### 5. Start the proxy + tunnel

Double-click `start.bat` (or run manually):

```cmd
npm start
REM In another terminal:
npm run tunnel
```

Look for a line like:
```
+--------------------------------------------------------------------------+
|  https://abc-xyz-123.trycloudflare.com                                   |
+--------------------------------------------------------------------------+
```

**Copy that URL** → paste into Vercel `YT_PROXY_URL` → redeploy (or it picks up on next request in ~1 min).

---

## Daily use

Just double-click `start.bat` and leave the terminal window open.

**Keep PC on while users are downloading.** When you close the terminal/shutdown PC, the tunnel dies and downloads stop working (site falls back to broken Innertube → "hasDownload: false" for most videos).

## Troubleshooting

- **`cloudflared` not found**: finish step 1 (download & put in PATH).
- **Vercel still says "none"**: (1) make sure `YT_PROXY_URL` has no trailing slash, (2) secrets match, (3) trigger Vercel redeploy or wait ~1 minute for cache.
- **Quick Tunnel URL changes every restart**: that's normal. For permanent URL, run `cloudflared tunnel login` + `cloudflared tunnel create` (free CF account needed).
- **Test locally**: `curl http://localhost:3001/health` → should return `{"ok":true,...}`.
- **Test with secret**: `curl -H "x-proxy-secret: YOUR_SECRET" "http://localhost:3001/info?url=https://youtu.be/dQw4w9WgXcQ"`.

## How it works

1. User hits `thuvienso.top/cong-cu/tai-youtube` and clicks download.
2. Vercel `/api/youtube-download/info` sees `YT_PROXY_URL` is set → forwards request to tunnel.
3. Tunnel → your PC → youtubei.js fetches from YouTube (your home IP is not blocked).
4. PC returns video metadata + stream URL → Vercel → browser.
5. For actual file download, Vercel proxies the bytes through the tunnel.

Bandwidth: ~50MB per download passes twice through your home internet (YouTube → PC, PC → Vercel). Fine on most home plans.

Security: every request carries the shared `PROXY_SECRET`. Without it, the tunnel URL is useless to random discoverers.
