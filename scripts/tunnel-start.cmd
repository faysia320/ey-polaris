@echo off
REM Double-click to START the Cloudflare Quick Tunnel and show the public URL.
REM %~dp0 = folder of this .cmd (scripts\), so tunnel.ps1 is resolved from anywhere.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tunnel.ps1" start
echo.
pause
