# update-vercel.ps1 - read current ngrok URL, update Vercel env YT_PROXY_URL, trigger redeploy via deploy hook.
#
# Requires vercel-config.json (same dir) with fields: token, projectId, teamId, envName, deployHook

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $ScriptDir 'vercel-config.json'

if (-not (Test-Path $ConfigPath)) {
    Write-Host "[update-vercel] ERROR: vercel-config.json not found."
    exit 1
}

$cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$Token = [string]$cfg.token
$ProjectId = [string]$cfg.projectId
$TeamId = [string]$cfg.teamId
$EnvName = if ($cfg.envName) { [string]$cfg.envName } else { 'YT_PROXY_URL' }
$DeployHook = [string]$cfg.deployHook
$TeamQuery = if ($TeamId) { "?teamId=$TeamId" } else { "" }

# --- 1) Poll ngrok local API for public URL ---
Write-Host "[update-vercel] Polling ngrok API (127.0.0.1:4040)..."
$NgrokUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    try {
        $tunnels = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 3
        $public = $tunnels.tunnels | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1
        if ($public) {
            $NgrokUrl = [string]$public.public_url
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
}

if ([string]::IsNullOrWhiteSpace($NgrokUrl)) {
    Write-Host "[update-vercel] ERROR: could not read ngrok URL after 60s."
    exit 1
}
Write-Host ("[update-vercel] Ngrok URL: " + $NgrokUrl)

# --- 2) Fetch Vercel env list ---
$Headers = @{ Authorization = "Bearer $Token" }
Write-Host "[update-vercel] Fetching Vercel env list..."
$envList = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$ProjectId/env$TeamQuery" -Headers $Headers
$envItem = $envList.envs | Where-Object { $_.key -eq $EnvName } | Select-Object -First 1

if (-not $envItem) {
    Write-Host ("[update-vercel] ERROR: env var '" + $EnvName + "' not found in project.")
    exit 1
}

# --- 3) Skip update if already same ---
if ($envItem.value -eq $NgrokUrl) {
    Write-Host "[update-vercel] Env var already matches. Skip redeploy."
    exit 0
}

# --- 4) PATCH env var with new URL ---
$envId = $envItem.id
$body = @{ value = $NgrokUrl } | ConvertTo-Json
Write-Host ("[update-vercel] Updating " + $EnvName + " -> " + $NgrokUrl)
Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$ProjectId/env/$envId$TeamQuery" `
    -Method Patch -Headers $Headers -Body $body -ContentType 'application/json' | Out-Null

# --- 5) Trigger redeploy via Deploy Hook ---
Write-Host ("[update-vercel] DeployHook length: " + $DeployHook.Length)

if ([string]::IsNullOrWhiteSpace($DeployHook)) {
    Write-Host "[update-vercel] WARN: deployHook not set in config - env var updated but no auto-redeploy."
    exit 0
}

Write-Host "[update-vercel] Triggering redeploy via deploy hook..."
try {
    $hookUrl = $DeployHook.Trim()
    $redeploy = Invoke-RestMethod -Uri $hookUrl -Method Post -UseBasicParsing
    Write-Host ("[update-vercel] Redeploy triggered. Job ID: " + $redeploy.job.id)
    Write-Host "[update-vercel] Done. Production will use new URL in ~1-2 min."
} catch {
    Write-Host ("[update-vercel] ERROR calling deploy hook: " + $_)
    exit 1
}
