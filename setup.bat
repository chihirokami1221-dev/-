@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%

echo ============================================
echo  成長OS 初回セットアップ
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [エラー] Node.js が見つかりません。
  echo https://nodejs.org から LTS版をインストールしてから、
  echo もう一度このファイルをダブルクリックしてください。
  pause
  exit /b 1
)

echo [1/3] 必要なファイルをダウンロード中...(数分かかります)
call npm install
if errorlevel 1 (
  echo [エラー] npm install に失敗しました。上のメッセージを確認してください。
  pause
  exit /b 1
)

echo.
echo [2/3] データベースを準備中...
call npx prisma db push
if errorlevel 1 (
  echo [エラー] データベースの準備に失敗しました。
  pause
  exit /b 1
)

echo.
echo [3/3] 初期データを準備中...
call npm run seed

echo.
echo ============================================
echo  セットアップ完了しました!
echo  次回からは start.bat をダブルクリックしてください。
echo ============================================
pause
