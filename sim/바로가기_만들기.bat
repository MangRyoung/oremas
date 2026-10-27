@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 시뮬레이터 바로가기 만들기
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make_shortcut.ps1"
echo.
echo  이 폴더의 「시뮬레이터.lnk」와 바탕화면의 「망켓몬 시뮬레이터」 두 곳에 주사위 아이콘으로 만들었어요.
echo  「못 만들었어요」가 보이면 그 줄을 감우에게 알려 주세요.
pause
