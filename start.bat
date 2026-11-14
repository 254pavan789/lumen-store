@echo off
setlocal
title Item ^& Purchase Management - Server
cd /d "%~dp0"

if not exist "node_modules" (
  echo [INFO] First run detected - running setup.bat first...
  call setup.bat
)
if not exist ".env" (
  echo [ERROR] .env not found. Run setup.bat first.
  pause & exit /b 1
)

echo Starting server... the browser will open at http://localhost:3000
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
node backend\server.js
pause
