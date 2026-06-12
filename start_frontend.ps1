# start_frontend.ps1 -- Start the Room3D Next.js frontend
# Usage: .\start_frontend.ps1

Write-Host ""
Write-Host "  Room3D Viewer -- Starting Frontend" -ForegroundColor Cyan
Write-Host "  ==================================" -ForegroundColor Cyan
Write-Host ""

# Check Node version
$nodeVersion = node --version
Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green

if ($nodeVersion -notmatch "^v20\.") {
    Write-Host "  WARNING: Node.js 20 LTS required. Current: $nodeVersion" -ForegroundColor Yellow
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing dependencies..." -ForegroundColor Gray
    npm install
}

Write-Host ""
Write-Host "  Starting Next.js dev server on port 3000..." -ForegroundColor Cyan
Write-Host "  Open: http://localhost:3000" -ForegroundColor White
Write-Host ""
npm run dev
