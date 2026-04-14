# yt-proxy-cf — Cloudflare Worker

Runs on Cloudflare's global edge (free tier: 100k req/day). Proxies YouTube fetches
through CF's IP pool, which (mostly) isn't blocked by YouTube like Vercel's is.

```
Browser → Vercel /api/youtube-download → CF Worker → YouTube
```

No server to manage, no PC to keep on. Deploy once, runs forever.

## One-time setup (10-15 minutes)

### 1. Create Cloudflare account

https://dash.cloudflare.com/sign-up → free plan, email + password, confirm email.

### 2. Install Wrangler (CF CLI) + dependencies

```cmd
cd bin\yt-proxy-cf
npm install
```

### 3. Login to Cloudflare

```cmd
npx wrangler login
```

Browser opens → "Allow" → done.

### 4. Set your secret

Generate a random 48-char string (same as Vercel side). In PowerShell:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | % {[char]$_})
```

**Copy the string**, then:
```cmd
npx wrangler secret put PROXY_SECRET
```

Paste the string when prompted.

### 5. Deploy

```cmd
npx wrangler deploy
```

You'll see output like:
```
Uploaded yt-proxy (1.23 sec)
Published yt-proxy (0.45 sec)
  https://yt-proxy.YOUR-USERNAME.workers.dev
```

**Copy that URL.** That's your proxy.

### 6. Test the worker

```cmd
curl "https://yt-proxy.YOUR-USERNAME.workers.dev/health"
REM → {"ok":true,"ts":...}

curl -H "x-proxy-secret: YOUR_SECRET" "https://yt-proxy.YOUR-USERNAME.workers.dev/info?url=https://youtu.be/dQw4w9WgXcQ"
REM → should return JSON with cdnUrl
```

### 7. Tell Vercel to use it

Vercel dashboard → project → Settings → Environment Variables → Add:

| Name | Value |
|---|---|
| `YT_PROXY_URL` | `https://yt-proxy.YOUR-USERNAME.workers.dev` (no trailing `/`) |
| `YT_PROXY_SECRET` | (same string you set in step 4) |

Apply to **Production** (+ Preview if you want). Redeploy or wait ~1 min.

### 8. Test on thuvienso.top

https://www.thuvienso.top/cong-cu/tai-youtube → paste any YouTube URL → download.

---

## Updating the worker

Edit `src/index.js`, then:
```cmd
npx wrangler deploy
```

## Checking logs

```cmd
npx wrangler tail
```

Shows realtime requests + `console.log` output.

## Caveats

- **Not all CF IPs work.** CF has a huge IP pool; most are fine, but YouTube sometimes 429s specific ranges. If you see `client=... error: 429` or empty `streamingData`, try again — CF rotates outbound IPs across requests.
- **Free tier limits**: 100k requests/day, 10ms CPU per request, 30s wall time. Direct Innertube calls use ~2-5ms CPU so you're fine.
- **Streaming large files**: Worker streams YouTube body straight through, no buffering, no 100MB limit. Bandwidth counts toward the free tier.

## Troubleshooting

- **`wrangler login` browser doesn't open**: manually visit the URL it prints.
- **Vercel still returns `_client: "none"`**: (1) check env vars no trailing slash, (2) secrets match exactly, (3) redeploy Vercel.
- **Worker returns 401 unauthorized**: secret in Vercel env ≠ secret in CF Worker. Re-run `wrangler secret put PROXY_SECRET` with the exact string you put in Vercel.
- **Worker returns 404 "no usable stream"**: YouTube blocked this particular CF IP for this video. Retry a few times — CF load-balances across different IPs per request.
