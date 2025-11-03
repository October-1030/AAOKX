@echo off
echo ========================================
echo 快速重启 Alpha Arena
echo ========================================
echo.

cd /d "%~dp0"

echo 停止旧进程...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq npm*" >nul 2>&1

echo 等待2秒...
timeout /t 2 /nobreak >nul

echo 启动项目...
npm run dev
