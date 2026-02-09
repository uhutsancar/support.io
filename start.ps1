# 🚀 START HERE - Quick Start Script

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  SupportChat - Quick Start Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found! Please install Node.js from https://nodejs.org" -ForegroundColor Red
    exit
}

# Check MongoDB
Write-Host "Checking MongoDB..." -ForegroundColor Yellow
$mongoRunning = Get-Process -Name "mongod" -ErrorAction SilentlyContinue
if ($mongoRunning) {
    Write-Host "✓ MongoDB is running" -ForegroundColor Green
} else {
    Write-Host "⚠ MongoDB not detected. Make sure it's running!" -ForegroundColor Yellow
    Write-Host "  Start it with: mongod" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Installing Dependencies..." -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Install backend dependencies
Write-Host ""
Write-Host "[1/2] Installing Backend dependencies..." -ForegroundColor Yellow
Set-Location backend
if (Test-Path "node_modules") {
    Write-Host "✓ Backend dependencies already installed" -ForegroundColor Green
} else {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Backend dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ Backend installation failed" -ForegroundColor Red
        exit
    }
}
Set-Location ..

# Install admin panel dependencies
Write-Host ""
Write-Host "[2/2] Installing Admin Panel dependencies..." -ForegroundColor Yellow
Set-Location admin-panel
if (Test-Path "node_modules") {
    Write-Host "✓ Admin Panel dependencies already installed" -ForegroundColor Green
} else {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Admin Panel dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ Admin Panel installation failed" -ForegroundColor Red
        exit
    }
}
Set-Location ..

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  ✓ Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Make sure MongoDB is running" -ForegroundColor White
Write-Host "2. Open TWO terminals:" -ForegroundColor White
Write-Host ""
Write-Host "   Terminal 1 - Backend:" -ForegroundColor Cyan
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "   Terminal 2 - Admin Panel:" -ForegroundColor Cyan
Write-Host "   cd admin-panel" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Open http://localhost:3002 to access admin panel" -ForegroundColor White
Write-Host "4. Create account and add your first site" -ForegroundColor White
Write-Host "5. Test with demo/index.html" -ForegroundColor White
Write-Host ""
Write-Host "Need help? Check SETUP_GUIDE.md" -ForegroundColor Yellow
Write-Host ""
