@echo off
chcp 65001 >nul
cd /d "%~dp0"
node bin\sim.js run --scenario data\scenarios\base.json
start "" report\index.html
pause
