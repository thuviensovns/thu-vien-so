@echo off
REM Start yt-proxy server + Cloudflare Tunnel in one go (Windows).
REM Requires: Node.js installed, cloudflared.exe in PATH or bin/.

echo.
echo ========================================
echo   yt-proxy starter
echo ========================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo [1/3] Installing dependencies...
    call npm install
    if errorlevel 1 goto :error
)

if not exist .env (
    echo [!] Missing .env file. Copy .env.example to .env and set PROXY_SECRET.
    pause
    exit /b 1
)

echo [2/3] Starting proxy server on port 3001...
start "yt-proxy server" cmd /k "node server.js"

timeout /t 2 /nobreak > nul

echo [3/3] Starting Cloudflare Tunnel (public URL will appear below)...
echo.
echo ----------------------------------------
echo   Copy the "https://xxx.trycloudflare.com" URL
echo   and set it as YT_PROXY_URL in Vercel env vars.
echo ----------------------------------------
echo.

cloudflared tunnel --url http://localhost:3001
goto :eof

:error
echo.
echo [ERROR] Setup failed. Check Node.js is installed.
pause
exit /b 1
