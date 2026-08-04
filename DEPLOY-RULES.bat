@echo off
setlocal
title Deploy Firebase security rules

echo ============================================================
echo   Deploy Firestore + Storage security rules
echo ============================================================
echo.
echo   What this does:
echo     - Locks down who can read/write client and staff records
echo     - Turns on the Storage rules for filed PDFs, which have
echo       never been deployed (Storage is still on defaults)
echo.
echo   This does NOT touch any data. Rules only.
echo.
echo   Do this before real client documents start being filed.
echo.
pause

cd /d "%~dp0"

echo.
echo [1/3] Checking you're signed in to Firebase...
call npx --yes firebase-tools login
if errorlevel 1 (
  echo.
  echo   Sign-in failed. Try again, or run:  npx firebase-tools login --reauth
  pause
  exit /b 1
)

echo.
echo [2/3] Confirming the project...
call npx --yes firebase-tools use dtcapp-24504
if errorlevel 1 (
  echo.
  echo   Could not select project dtcapp-24504.
  echo   Check that this Google account has access to it.
  pause
  exit /b 1
)

echo.
echo [3/3] Deploying rules...
call npx --yes firebase-tools deploy --only firestore:rules,storage
if errorlevel 1 (
  echo.
  echo   Deploy failed - see the message above.
  echo.
  echo   If it mentions Storage is not set up, open:
  echo     https://console.firebase.google.com/project/dtcapp-24504/storage
  echo   click "Get started" once, then run this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   Rules deployed.
echo.
echo   Filed PDFs are now: signed-in read, create-only (immutable),
echo   PDF-only, max 25MB. Client and staff records are role-gated.
echo ============================================================
echo.
pause
