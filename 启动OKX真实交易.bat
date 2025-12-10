@echo off
chcp 65001 >nul
title Alpha Arena - OKX真实交易

color 0E
cls
echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║                                                       ║
echo ║          Alpha Arena Clone - AI交易竞技平台            ║
echo ║                                                       ║
echo ║          交易所: OKX (已配置真实交易环境)               ║
echo ║          API状态: 已连接                               ║
echo ║          Sandbox模式: 已禁用 (真实交易)                ║
echo ║                                                       ║
echo ║    ⚠️⚠️⚠️  警告：真实资金交易！ ⚠️⚠️⚠️                  ║
echo ║                                                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.
echo [环境信息]
echo   • 项目目录: %~dp0
echo   • 配置文件: .env.local
echo   • OKX_SANDBOX=false (真实交易)
echo.
echo [安全提示]
echo   ✓ 系统已从 Hyperliquid 切换到 OKX
echo   ✓ 真实交易模式已启用
echo   ✓ 请确认您了解交易风险
echo.

REM 确认启动
echo 按任意键继续启动，或关闭窗口取消...
pause >nul

REM 切换到脚本所在目录
cd /d "%~dp0"

color 0A
cls
echo.
echo ╔═══════════════════════════════════════════════╗
echo ║            正在启动交易系统...                 ║
echo ╚═══════════════════════════════════════════════╝
echo.

echo [1/5] 检查 Node.js 环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ✗ 错误: 未安装 Node.js
    echo 请访问 https://nodejs.org 下载安装
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo   ✓ Node.js %NODE_VERSION%
echo.

echo [2/5] 检查 OKX 配置...
if not exist ".env.local" (
    color 0C
    echo   ✗ 错误: .env.local 文件不存在
    echo   请先配置 OKX API 密钥
    pause
    exit /b 1
)
findstr /C:"OKX_API_KEY" .env.local >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo   ✗ 错误: OKX API 密钥未配置
    pause
    exit /b 1
)
echo   ✓ OKX API 已配置
findstr /C:"OKX_SANDBOX=false" .env.local >nul 2>&1
if %errorlevel% equ 0 (
    echo   ⚠️  模式: 真实交易 (OKX_SANDBOX=false)
) else (
    echo   ℹ️  模式: 测试环境 (OKX_SANDBOX=true)
)
echo.

echo [3/5] 检查项目依赖...
if not exist "node_modules\" (
    echo   首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo   ✗ 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo   ✓ 依赖已安装
)
echo.

echo [4/5] 清理端口占用...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo   正在停止进程 %%a...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo   ✓ 端口 3000 已清理
echo.

echo [5/5] 启动开发服务器...
echo.
echo ╔═══════════════════════════════════════════════╗
echo ║  🚀 OKX 真实交易系统启动中...                  ║
echo ║                                               ║
echo ║  📍 访问地址: http://localhost:3000           ║
echo ║  💱 交易所: OKX (LIVE TRADING)                ║
echo ║  🤖 AI模型: DeepSeek V3.1                     ║
echo ║                                               ║
echo ║  ⚠️  警告: 真实资金交易，请谨慎操作             ║
echo ║  ⏸️  按 Ctrl+C 可停止服务器                    ║
echo ╚═══════════════════════════════════════════════╝
echo.

REM 延迟5秒后自动打开浏览器
start /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

npm run dev

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ✗ 服务器启动失败
    pause
)
