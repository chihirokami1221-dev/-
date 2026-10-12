@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion

set BACKUP_ROOT=%~dp0..\growth-os-backups
if not exist "%BACKUP_ROOT%\db" mkdir "%BACKUP_ROOT%\db"
if not exist "%BACKUP_ROOT%\code-snapshots" mkdir "%BACKUP_ROOT%\code-snapshots"

for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set DATESTAMP=%%c%%a%%b
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIMESTAMP=%%a%%b
set TS=%DATESTAMP%-%TIMESTAMP%

echo データベースをバックアップ中...
copy /y "prisma\dev.db" "%BACKUP_ROOT%\db\dev_%TS%.db" >nul

echo コードのスナップショットを作成中...
powershell -NoProfile -Command ^
  "$tmp = Join-Path $env:TEMP ('gos-snap-' + (Get-Date -Format yyyyMMdd-HHmmss));" ^
  "New-Item -ItemType Directory -Force -Path $tmp | Out-Null;" ^
  "robocopy '.' $tmp /E /XD node_modules .next .claude migrations /XF tsconfig.tsbuildinfo /NFL /NDL /NJH /NJS | Out-Null;" ^
  "Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath (Join-Path '%BACKUP_ROOT%\code-snapshots' ('growth-os_' + (Get-Date -Format yyyyMMdd-HHmmss) + '.zip')) -Force;" ^
  "Remove-Item -Recurse -Force $tmp"

echo 完了しました。保存先: %BACKUP_ROOT%
pause
