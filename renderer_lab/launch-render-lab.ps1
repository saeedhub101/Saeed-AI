$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$electron = Join-Path $root "electron\electron.exe"
$app = Join-Path $root "app"
if (!(Test-Path $electron)) { throw "Electron runtime is missing: $electron" }
if (!(Test-Path (Join-Path $app "package.json"))) { throw "Renderer Lab app is missing." }
& $electron $app
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
