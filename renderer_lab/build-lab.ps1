$ErrorActionPreference="Stop"
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$node=Get-Command node -ErrorAction SilentlyContinue
$npm=Get-Command npm -ErrorAction SilentlyContinue
if(!$node -or !$npm){ throw "Node.js/npm is required to build Renderer Lab." }
$app=Join-Path $root "app"
New-Item -ItemType Directory -Force -Path $app | Out-Null
Copy-Item (Join-Path $root "package.json") (Join-Path $app "package.json") -Force
Copy-Item (Join-Path $root "main.js") (Join-Path $app "main.js") -Force
Copy-Item (Join-Path $root "index.html") (Join-Path $app "index.html") -Force
Copy-Item (Join-Path $root "renderer.js") (Join-Path $app "renderer.js") -Force
Copy-Item (Join-Path $root "style.css") (Join-Path $app "style.css") -Force
Copy-Item (Join-Path $root "..\assets\Saeed_AI-3D.glb") (Join-Path $app "saeed.ai.glb") -Force
Push-Location $app
npm install --omit=dev
Pop-Location
Write-Host "Renderer Lab dependencies installed and GLB copied."
