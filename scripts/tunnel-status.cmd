@echo off
REM Double-click to check whether the tunnel is running and show the current URL.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tunnel.ps1" status
echo.
pause
