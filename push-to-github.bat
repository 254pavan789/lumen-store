@echo off
setlocal EnableExtensions
title Lumen Store - upload to GitHub
cd /d "%~dp0"

echo.
echo  ==========================================================
echo   Lumen Store - upload this project to your GitHub repository
echo  ==========================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo  Git is not installed.
  echo  1. Download and install it from  https://git-scm.com/download/win
  echo     ^(keep all the default options^)
  echo  2. Close this window and double-click push-to-github.bat again.
  echo.
  pause
  exit /b 1
)

echo  Paste the URL of your EMPTY GitHub repository and press Enter.
echo  Example:  https://github.com/yourname/lumen-store.git
echo.
set "REPO="
set /p "REPO=  Repository URL: "
if "%REPO%"=="" (
  echo  No URL entered - nothing was uploaded.
  pause
  exit /b 1
)

rem --- Git needs a name and e-mail for the commit (stored only in this project)
for /f "delims=" %%A in ('git config user.email 2^>nul') do set "GIT_EMAIL=%%A"
if not defined GIT_EMAIL (
  echo.
  echo  Git needs your name and e-mail once ^(use the e-mail of your GitHub account^).
  set /p "GIT_NAME=  Your name: "
  set /p "GIT_EMAIL=  Your e-mail: "
)
if not exist ".git" (
  git init >nul
)
for /f "delims=" %%A in ('git config user.email 2^>nul') do set "HAVE_EMAIL=%%A"
if not defined HAVE_EMAIL (
  git config user.name "%GIT_NAME%"
  git config user.email "%GIT_EMAIL%"
)

echo.
echo  Preparing files ^(your .env file with passwords is NOT uploaded^) ...
git add -A
git commit -q -m "Lumen Store - deploy to Render" >nul 2>nul
git branch -M main

git remote remove origin >nul 2>nul
git remote add origin "%REPO%"

echo  Uploading ... a browser window may open: sign in to GitHub and click "Authorize".
echo.
git push -u origin main
if errorlevel 1 (
  echo.
  echo  Upload FAILED. Common fixes:
  echo   - The repository must exist and be EMPTY ^(no README^) - create it at https://github.com/new
  echo   - Check the URL you pasted.
  echo   - Sign in with the GitHub account that owns the repository.
  echo.
  pause
  exit /b 1
)

echo.
echo  ==========================================================
echo   Done! Your code is on GitHub:  %REPO%
echo   Next: open DEPLOY.md, Step 3 ^(Render^).
echo   Later changes: double-click this file again to upload them -
echo   Render redeploys automatically.
echo  ==========================================================
echo.
pause
