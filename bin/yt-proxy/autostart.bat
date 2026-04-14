@echo off
REM yt-proxy autostart — khởi động lúc Windows boot.
REM
REM Khởi động 2 cửa sổ (ẩn) rồi gọi PowerShell script để update Vercel.

setlocal
cd /d "%~dp0"

REM Chờ network sẵn sàng (max 60s)
echo [autostart] Waiting for network...
for /l %%i in (1,1,30) do (
    ping -n 1 api.vercel.com >nul 2>&1 && goto network_ok
    timeout /t 2 /nobreak >nul
)
echo [autostart] WARN: network timeout, continuing anyway.
:network_ok

REM Start Node server in minimized window (stays open, so server keeps running)
echo [autostart] Starting node server.js...
start "yt-proxy-server" /min cmd /c "cd /d %~dp0 && node server.js"

REM Start ngrok in minimized window
echo [autostart] Starting ngrok...
start "yt-proxy-ngrok" /min cmd /c "cd /d %~dp0 && ngrok http 3001"

REM Chờ ngrok khởi động xong
echo [autostart] Waiting 15s for ngrok to come online...
timeout /t 15 /nobreak >nul

REM Chạy PowerShell script để đọc URL và update Vercel
echo [autostart] Updating Vercel env var + redeploying...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0update-vercel.ps1"

echo [autostart] Done.
REM Không pause — cửa sổ tự đóng sau 5s để user thấy kết quả.
timeout /t 5 /nobreak >nul
endlocal
