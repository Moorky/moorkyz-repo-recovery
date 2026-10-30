@echo off
setlocal
cd /d "%~dp0"
node ".\src\recovery.mjs" help
set "result=%errorlevel%"
if not "%result%"=="0" echo Node.js 22 or newer is required on PATH.
pause
exit /b %result%
