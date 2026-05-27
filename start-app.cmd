@echo off
setlocal

cd /d "%~dp0"
title Spoken English Practice

set "PORT=3000"
set "URL=http://127.0.0.1:%PORT%"

echo.
echo Starting Spoken English Practice...
echo Project folder: %cd%
echo.

where node > nul 2> nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js and run this file again.
  echo Download: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$conn = Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue; if ($conn) { exit 0 } exit 1"
if "%errorlevel%"=="0" (
  echo Port %PORT% is already running. Opening the browser...
  start "" "%URL%"
  echo.
  pause
  exit /b 0
)

if not exist "node_modules" (
  echo Installing dependencies. This may take a few minutes...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed. Please check your network and Node.js/npm setup.
    pause
    exit /b 1
  )
)

echo Opening browser: %URL%
start "" "%URL%"
echo.
echo Keep this window open while using the app. Close it to stop the server.
echo.

call npm.cmd run dev -- --hostname 127.0.0.1 --port %PORT%

echo.
echo Server stopped.
pause
