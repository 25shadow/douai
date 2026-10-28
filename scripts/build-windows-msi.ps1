$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  pnpm run sidecar:build
  pnpm run tauri:build -- --bundles msi

  $msi = Get-ChildItem "src-tauri\target\release\bundle\msi\*.msi" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $msi) {
    throw "Tauri did not produce an MSI installer."
  }

  $destinationDir = Join-Path $root "output\windows"
  New-Item -ItemType Directory -Force $destinationDir | Out-Null
  $destination = Join-Path $destinationDir "DouAi_1.0.0_x64.msi"
  Copy-Item -Force $msi.FullName $destination
  Write-Output "MSI installer: $destination"
}
finally {
  Pop-Location
}
