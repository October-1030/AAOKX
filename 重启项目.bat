@echo off
echo ========================================
echo 正在重启 Alpha Arena 项目...
echo ========================================
echo.

echo 1. 检查并停止现有进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo 发现进程 %%a，正在停止...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo 2. 等待3秒...
timeout /t 3 /nobreak >nul

echo.
echo 3. 启动开发服务器...
start cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================
echo 完成！浏览器将自动打开...
echo ========================================
timeout /t 5 /nobreak >nul
start http://localhost:3000

exit
