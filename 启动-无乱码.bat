@echo off
chcp 65001 >nul
title Alpha Arena - OKX Live Trading

color 0E
cls
echo.
echo ========================================
echo   Alpha Arena - AI Trading Platform
echo   Exchange: OKX (LIVE TRADING)
echo   WARNING: Real Money Trading!
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Node.js not installed
    pause
    exit /b 1
)
node --version
echo.

echo [2/4] Checking dependencies...
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
) else (
    echo Dependencies OK
)
echo.

echo [3/4] Clearing port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo   Stopping process %%a...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo Port cleared
echo.

echo [4/4] Starting server...
echo.
echo ========================================
echo   Server starting...
echo   URL: http://localhost:3000
echo   Exchange: OKX (LIVE TRADING)
echo   WARNING: Real money trading!
echo   Press Ctrl+C to stop
echo ========================================
echo.

start /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

npm run dev

pause
