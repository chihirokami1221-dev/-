@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%

if not exist "node_modules" (
  echo 初回セットアップがまだのようです。先に setup.bat をダブルクリックしてください。
  pause
  exit /b 1
)

echo 成長OS を起動しています...
echo.
echo このパソコンで使う: http://localhost:3000
echo スマホで使う場合は、この後に表示される「Network:」の後のURLを
echo 同じWi-Fiに繋いだスマホのブラウザで開いてください。
echo.
start "" http://localhost:3000
call npm run dev
echo.
echo npm run dev が終了しました。上にエラーが出ていないか確認してください。
pause
