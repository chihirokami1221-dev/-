@echo off
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%
echo 成長OS を起動しています... (http://localhost:3000)
start "" http://localhost:3000
call npm run dev
pause
