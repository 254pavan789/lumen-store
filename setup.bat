@echo off
setlocal
title Item ^& Purchase Management - Setup
cd /d "%~dp0"

echo ==========================================================
echo   Item ^& Purchase Management System - one-time setup
echo ==========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 18+ from https://nodejs.org and run setup again.
  pause & exit /b 1
)

set "PY=python"
where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Python was not found. Install Python 3.9+ from https://python.org ^(tick "Add python.exe to PATH"^).
    pause & exit /b 1
  )
  set "PY=py"
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo [INFO] Created .env from .env.example
  echo [ACTION] Opening .env - set DB_PASSWORD ^(and DB_USER if not root^), save, close Notepad.
  notepad ".env"
)

echo.
echo [1/3] Installing Node.js packages...
call npm install --no-audit --no-fund
if errorlevel 1 ( echo [ERROR] npm install failed. & pause & exit /b 1 )

echo.
echo [2/3] Installing Python packages...
%PY% -m pip install -r requirements.txt
if errorlevel 1 ( echo [ERROR] pip install failed. & pause & exit /b 1 )

echo.
echo [3/3] Creating MySQL database, tables and sample data...
%PY% engine\migrate.py --seed
if errorlevel 1 (
  echo [ERROR] Database setup failed. Make sure MySQL is running and .env credentials are correct.
  pause & exit /b 1
)

echo.
echo ==========================================================
echo   Setup complete. Double-click start.bat to run the app.
echo ==========================================================
pause
