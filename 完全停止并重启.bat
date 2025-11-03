@echo off
chcp 65001 >nul
echo ========================================
echo 完全停止并重启 Alpha Arena
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] 停止所有 Node.js 进程...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ 已停止所有 Node.js 进程
) else (
    echo ✓ 没有运行中的 Node.js 进程
)

echo.
echo [2/4] 检查端口 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo   停止进程 %%a...
    taskkill /F /PID %%a >nul 2>&1
)
echo ✓ 端口 3000 已清理

echo.
echo [3/4] 等待 3 秒...
timeout /t 3 /nobreak >nul
echo ✓ 完成

echo.
echo [4/4] 启动开发服务器...
echo.
echo ========================================
echo 新窗口即将打开...
echo 请等待显示 "Ready in X.Xs"
echo ========================================
echo.

start cmd /k "chcp 65001 >nul && cd /d %~dp0 && npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo ✓ 完成！浏览器将自动打开...
echo.
pause
