@echo off
chcp 65001 >nul
rem 11-01 감우: 시뮬 옛 자동 생성 던전 10개를 _to_delete 로 옮겨요 (지우지 않음 · 확인 후 직접 지우세요)
cd /d "%~dp0data\dungeons"
if not exist "_to_delete" mkdir "_to_delete"
if exist "auto_easy_10920.json" move /y "auto_easy_10920.json" "_to_delete\" >nul
if exist "auto_easy_2002.json" move /y "auto_easy_2002.json" "_to_delete\" >nul
if exist "auto_easy_2003.json" move /y "auto_easy_2003.json" "_to_delete\" >nul
if exist "auto_hard_10929.json" move /y "auto_hard_10929.json" "_to_delete\" >nul
if exist "auto_hard_17846.json" move /y "auto_hard_17846.json" "_to_delete\" >nul
if exist "auto_hard_2009.json" move /y "auto_hard_2009.json" "_to_delete\" >nul
if exist "auto_normal_2004.json" move /y "auto_normal_2004.json" "_to_delete\" >nul
if exist "auto_normal_2006.json" move /y "auto_normal_2006.json" "_to_delete\" >nul
if exist "auto_normal_2007.json" move /y "auto_normal_2007.json" "_to_delete\" >nul
if exist "auto_normal_3005.json" move /y "auto_normal_3005.json" "_to_delete\" >nul
echo 옮겼어요: data\dungeons\_to_delete
pause
