@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 시뮬레이터 바로가기 만들기
powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell;$d=[Environment]::GetFolderPath('Desktop');foreach($p in @(\"%~dp0시뮬레이터.lnk\",(Join-Path $d '망켓몬 시뮬레이터.lnk'))){$s=$w.CreateShortcut($p);$s.TargetPath=\"%~dp0실행.bat\";$s.WorkingDirectory=\"%~dp0\";$s.IconLocation=\"%~dp0sim.ico,0\";$s.Description='망켓몬 던전 · 스킬 체크 시뮬레이터';$s.Save();Write-Host ('만들었어요: '+$p)}"
echo.
echo  이 폴더의 「시뮬레이터.lnk」 와 바탕화면의 「망켓몬 시뮬레이터」 두 곳에 주사위 아이콘으로 만들었어요.
pause
