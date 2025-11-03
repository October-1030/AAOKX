@echo off
echo ========================================
echo  Alpha Arena Clone - 启动脚本
echo ========================================
echo.

REM 检查并停止占用3000端口的进程
echo [1/3] 检查3000端口...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo 发现进程 %%a 占用3000端口，正在停止...
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/3] 等待端口释放...
timeout /t 2 /nobreak >nul

echo [3/3] 启动开发服务器...
echo.
echo ========================================
echo  服务器启动中...
echo  访问地址: http://localhost:3000
echo ========================================
echo.

npm run dev

pause
