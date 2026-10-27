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
if not exist "%~dp0시뮬레이터.lnk" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut(\"%~dp0시뮬레이터.lnk\");$s.TargetPath=\"%~dp0실행.bat\";$s.WorkingDirectory=\"%~dp0\";$s.IconLocation=\"%~dp0sim.ico\";$s.Description=\"망켓몬 던전 시뮬레이터\";$s.Save()" >nul 2>nul
)
start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:8470"
node bin\sim.js ui --noopen
echo.
echo  (서버가 끝났어요. 포트가 이미 쓰이고 있으면 다른 실행 창이 켜져 있는지 봐 주세요.)
pause
