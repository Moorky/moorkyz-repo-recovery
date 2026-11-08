@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22.13 or newer is required on PATH: https://nodejs.org/ & pause & exit /b 1)
if not "%~1"=="" goto run
for %%I in ("%~dp0..") do set "default=%%~fI"
echo MOORKYZ Repo Recovery - local, read-only scan first. Nothing is uploaded.
echo.
set "root="
set /p "root=Folder that contains your repositories [%default%]: "
if not defined root set "root=%default%"
set "root=%root:"=%"
node ".\src\dashboard\server.mjs" --root "%root%" --open
goto done
:run
node ".\src\dashboard\server.mjs" %*
:done
set "result=%errorlevel%"
if not "%result%"=="0" pause
exit /b %result%