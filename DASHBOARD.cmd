@echo off
setlocal
cd /d "%~dp0"
node ".\src\dashboard\server.mjs" %*
set "result=%errorlevel%"
if not "%result%"=="0" pause
exit /b %result%
