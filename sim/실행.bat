@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 망켓몬 던전 시뮬레이터 (이 창을 닫으면 화면도 꺼져요)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js 가 설치되어 있지 않아요. https://nodejs.org 에서 LTS 를 설치한 뒤 다시 실행해 주세요.
  echo.
  start "" https://nodejs.org/ko
  pause
  exit /b
)
if not exist "%~dp0시뮬레이터.lnk" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make_shortcut.ps1" -LocalOnly >nul 2>nul
rem 11-03: 예전 서버가 8470 포트를 잡고 있으면 끄고 새로 켠다 (창을 닫아도 옛 서버가 남아 새 코드가 안 돌던 일)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8470 " ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>nul
start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:8470"
node bin\sim.js ui --noopen
echo.
echo  (서버가 끝났어요. 포트가 이미 쓰이고 있으면 다른 실행 창이 켜져 있는지 봐 주세요.)
pause
