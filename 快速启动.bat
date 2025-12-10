@echo off
chcp 65001 >nul
title Alpha Arena Clone - OKX真实交易启动

color 0E
echo.
echo ╔═══════════════════════════════════════════════╗
echo ║      Alpha Arena Clone - AI交易竞技平台        ║
echo ║      交易所: OKX (真实交易环境)                ║
echo ║      ⚠️  WARNING: LIVE TRADING ENABLED        ║
echo ╚═══════════════════════════════════════════════╝
echo.

REM 切换到脚本所在目录
cd /d "%~dp0"

echo [1/4] 检查 Node.js 环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ✗ 错误: 未安装 Node.js
    echo 请访问 https://nodejs.org 下载安装
    pause
    exit /b 1
)
node --version
echo.

echo [2/4] 检查项目依赖...
if not exist "node_modules\" (
    echo 首次运行，正在安装依赖...
    call npm install
) else (
    echo ✓ 依赖已安装
)
echo.

echo [3/4] 清理端口占用...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo   正在停止进程 %%a...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo ✓ 端口已清理
echo.

echo [4/4] 启动开发服务器...
echo.
echo ╔═══════════════════════════════════════════════╗
echo ║  🚀 服务器启动中...                            ║
echo ║  📍 地址: http://localhost:3000               ║
echo ║  💱 交易所: OKX (LIVE TRADING)                ║
echo ║  ⚠️  警告: 真实资金交易，请谨慎操作             ║
echo ║  ⏸️  按 Ctrl+C 可停止服务器                    ║
echo ╚═══════════════════════════════════════════════╝
echo.

REM 延迟3秒后自动打开浏览器
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

npm run dev

pause
