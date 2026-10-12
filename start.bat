@echo off
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%

if not exist "node_modules" (
  echo 初回セットアップがまだのようです。先に setup.bat をダブルクリックしてください。
  pause
  exit /b 1
)

echo 成長OS を起動しています... (http://localhost:3000)
start "" http://localhost:3000
call npm run dev
pause
