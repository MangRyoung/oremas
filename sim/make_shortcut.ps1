# 바로가기 만들기 (10-27 고침: 망령 「바로가기 만들기 bat 해도 되는 게 없다」)
# 예전 bat 은 한글 경로를 powershell -Command 한 줄에 넣어서, 한글이 깨져 아무것도 안 만들어졌다.
# 이제 이 파일(UTF-8 BOM)이 경로를 스스로 찾는다. -LocalOnly 를 주면 이 폴더에만 만든다.
param([switch]$LocalOnly)
$ErrorActionPreference = 'Stop'
$dir    = $PSScriptRoot
$target = Join-Path $dir '실행.bat'
$icon   = Join-Path $dir 'sim.ico'
if (-not (Test-Path -LiteralPath $target)) { Write-Host "실행.bat 을 못 찾았어요: $target"; exit 1 }
$places = @(Join-Path $dir '시뮬레이터.lnk')
if (-not $LocalOnly) { $places += (Join-Path ([Environment]::GetFolderPath('Desktop')) '망켓몬 시뮬레이터.lnk') }
$w = New-Object -ComObject WScript.Shell
foreach ($p in $places) {
  try {
    # 한글 이름으로 바로 저장하면 COM 이 실패하는 PC 가 있어서, 영문 임시 이름으로 저장한 뒤 이름만 바꾼다
    $tmp = Join-Path (Split-Path $p) ('sim_tmp_' + [guid]::NewGuid().ToString('N').Substring(0,8) + '.lnk')
    $s = $w.CreateShortcut($tmp)
    # 10-28: bat 를 바로 가리키면 윈도우가 「작업 표시줄에 고정」을 막는다 → cmd.exe 로 감싸서 고정되게
    $s.TargetPath = $env:ComSpec
    $s.Arguments = '/c "' + $target + '"'
    $s.WorkingDirectory = $dir
    if (Test-Path -LiteralPath $icon) { $s.IconLocation = "$icon,0" }
    $s.Description = '망켓몬 던전 · 스킬 체크 시뮬레이터'
    $s.Save()
    if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force }
    Move-Item -LiteralPath $tmp -Destination $p -Force
    Write-Host "만들었어요: $p"
  } catch {
    Write-Host "못 만들었어요: $p"
    Write-Host ("  이유: " + $_.Exception.Message)
    if ($tmp -and (Test-Path -LiteralPath $tmp)) { Remove-Item -LiteralPath $tmp -Force }
  }
}
