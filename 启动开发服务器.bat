@echo off
chcp 65001 >nul
title AAOKX Trading System - Dev Server

echo ========================================
echo    AAOKX Trading System
echo    Flow-Radar Integration v2.0
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Node.js...
node -v
if errorlevel 1 (
    echo ERROR: Node.js not found!
    pause
    exit /b 1
)

echo.
echo [2/3] Clearing port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Killing process %%a on port 3000...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [3/3] Starting development server...
echo.
echo ========================================
echo    Access: http://localhost:3000
echo    Press Ctrl+C to stop
echo ========================================
echo.

npm run dev

pause
