@echo off
chcp 65001 >nul
cd /d "%~dp0"
node bin\sim.js fetch
pause
