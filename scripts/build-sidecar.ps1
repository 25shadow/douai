$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root ".venv-sidecar"
$python = Join-Path $venv "Scripts\python.exe"
$outputDir = Join-Path $root "src-tauri\binaries"
$target = Join-Path $outputDir "douai-api-x86_64-pc-windows-msvc.exe"

if (-not (Test-Path $python)) {
  py -3 -m venv $venv
}

& $python -m pip install --upgrade pip pyinstaller
New-Item -ItemType Directory -Force $outputDir | Out-Null

& $python -m PyInstaller `
  --noconfirm `
  --clean `
  --onefile `
  --name douai-api `
  --distpath $outputDir `
  --workpath (Join-Path $root "output\pyinstaller-build") `
  --specpath (Join-Path $root "output\pyinstaller-spec") `
  --console `
  (Join-Path $root "config_server.py")

$built = Join-Path $outputDir "douai-api.exe"
if (Test-Path $built) {
  Copy-Item -Force $built $target
}

if (-not (Test-Path $target)) {
  throw "PyInstaller did not produce $target"
}

Write-Output "Built $target"
