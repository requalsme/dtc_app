@echo off
setlocal
title Run the DTC app locally

REM Port the app runs on. Change this if 5180 is ever taken.
set DTCPORT=5180
set PORT=%DTCPORT%

echo ============================================================
echo   Dare to Care - Forms Platform (local preview)
echo ============================================================
echo.
echo   This runs the app on your own computer so you can click
echo   through all 33 forms before anything goes live.
echo.
echo   Nothing here touches the live site or real client data.
echo.

cd /d "%~dp0dare-to-care-forms"
if errorlevel 1 (
  echo   Could not find the app folder. Is this file in C:\dev\dtc-app ?
  pause
  exit /b 1
)

REM A previous install was interrupted and left several packages only
REM half-extracted (react-router and pdfjs-dist had files missing entirely),
REM which is what caused the "Failed to resolve import" error. A partial
REM npm install will NOT repair that - the folder has to go first.
if exist "node_modules\.dtc-install-ok" goto :haveDeps

echo [1/3] Clearing the damaged dependency folder...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
echo       done.
echo.

echo [2/3] Installing dependencies from scratch...
echo       This takes a few minutes the first time. Later runs skip it.
echo.
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo   Install failed. Make sure Node.js is installed:
  echo   https://nodejs.org
  echo.
  pause
  exit /b 1
)

REM Sanity-check a few packages that were truncated last time, so a bad
REM install is caught here instead of showing up as a blank page later.
set DEPSOK=1
if not exist "node_modules\react-router\dist\development\dom-export.mjs" set DEPSOK=0
if not exist "node_modules\pdfjs-dist\build\pdf.worker.min.mjs" set DEPSOK=0
if not exist "node_modules\vite\package.json" set DEPSOK=0

if "%DEPSOK%"=="0" (
  echo.
  echo   The install finished but key files are still missing.
  echo   Run this file again - npm sometimes needs a second pass.
  echo.
  pause
  exit /b 1
)

echo. > "node_modules\.dtc-install-ok"
echo       dependencies verified.

:haveDeps
REM Vite caches pre-bundled dependencies here. It can hold a stale bad
REM resolution after a failed install, so clear it every start - it costs
REM about a second and prevents a confusing error.
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite"

echo.
echo [3/3] Starting the app on port %DTCPORT%...
echo.
echo ------------------------------------------------------------
echo   Your browser will open automatically in a few seconds at:
echo       http://localhost:%DTCPORT%
echo.
echo   If it doesn't, type that address in yourself.
echo.
echo   To stop the app: click this window and press Ctrl+C.
echo ------------------------------------------------------------
echo.

REM Give Vite a moment to boot before opening the browser, otherwise
REM the tab loads before the server is listening and shows an error.
start "" cmd /c "timeout /t 6 /nobreak >nul && start """" http://localhost:%DTCPORT%"

call npm run dev

echo.
echo   The app has stopped.
pause
