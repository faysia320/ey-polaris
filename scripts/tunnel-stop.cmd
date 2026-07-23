@echo off
REM Double-click to STOP the running Cloudflare Quick Tunnel (cuts off external access).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tunnel.ps1" stop
echo.
pause
