@echo off
chcp 65001 >nul
title 检查 OKX 配置

color 0B
cls
echo.
echo ╔═══════════════════════════════════════════════╗
echo ║        Alpha Arena - OKX 配置检查工具          ║
echo ╚═══════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [1/4] 检查配置文件...
if not exist ".env.local" (
    color 0C
    echo   ✗ 错误: .env.local 文件不存在
    echo.
    echo   请创建 .env.local 文件并配置以下内容:
    echo   OKX_API_KEY=你的API密钥
    echo   OKX_SECRET_KEY=你的密钥
    echo   OKX_PASSPHRASE=你的密码短语
    echo   OKX_SANDBOX=false
    echo.
    pause
    exit /b 1
)
echo   ✓ .env.local 文件存在
echo.

echo [2/4] 检查 OKX API 密钥配置...
set HAS_API_KEY=0
set HAS_SECRET=0
set HAS_PASSPHRASE=0
set IS_SANDBOX=未知

findstr /C:"OKX_API_KEY=" .env.local | findstr /V "^#" | findstr /R "=..*" >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ OKX_API_KEY 已配置
    set HAS_API_KEY=1
) else (
    echo   ✗ OKX_API_KEY 未配置或为空
)

findstr /C:"OKX_SECRET_KEY=" .env.local | findstr /V "^#" | findstr /R "=..*" >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ OKX_SECRET_KEY 已配置
    set HAS_SECRET=1
) else (
    echo   ✗ OKX_SECRET_KEY 未配置或为空
)

findstr /C:"OKX_PASSPHRASE=" .env.local | findstr /V "^#" | findstr /R "=..*" >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ OKX_PASSPHRASE 已配置
    set HAS_PASSPHRASE=1
) else (
    echo   ✗ OKX_PASSPHRASE 未配置或为空
)
echo.

echo [3/4] 检查交易模式...
findstr /C:"OKX_SANDBOX=false" .env.local >nul 2>&1
if %errorlevel% equ 0 (
    color 0E
    echo   ⚠️  模式: 真实交易 (OKX_SANDBOX=false)
    echo   ⚠️  警告: 将使用真实资金进行交易！
    set IS_SANDBOX=false
) else (
    findstr /C:"OKX_SANDBOX=true" .env.local >nul 2>&1
    if %errorlevel% equ 0 (
        color 0A
        echo   ✓ 模式: 测试环境 (OKX_SANDBOX=true)
        echo   ✓ 安全: 使用 OKX Demo 测试账户
        set IS_SANDBOX=true
    ) else (
        color 0C
        echo   ✗ OKX_SANDBOX 配置缺失或格式错误
        echo   请设置为 true (测试) 或 false (真实)
        set IS_SANDBOX=未配置
    )
)
echo.

echo [4/4] 检查系统配置...
if exist "lib\config.ts" (
    findstr /C:"USE_REAL_TRADING: true" lib\config.ts >nul 2>&1
    if %errorlevel% equ 0 (
        echo   ⚠️  lib\config.ts: USE_REAL_TRADING = true
        echo   系统将执行真实交易
    ) else (
        echo   ℹ️  lib\config.ts: USE_REAL_TRADING = false
        echo   系统处于模拟模式
    )
) else (
    echo   ⚠️  未找到 lib\config.ts
)
echo.

REM 检查是否所有必需配置都已完成
if %HAS_API_KEY%==1 if %HAS_SECRET%==1 if %HAS_PASSPHRASE%==1 (
    color 0A
    echo ╔═══════════════════════════════════════════════╗
    echo ║               ✓ 配置检查完成                   ║
    echo ╚═══════════════════════════════════════════════╝
    echo.
    echo [配置摘要]
    echo   • API密钥: 已配置
    echo   • 交易模式: %IS_SANDBOX%
    if "%IS_SANDBOX%"=="false" (
        echo   • 风险等级: 高 (真实资金)
    ) else (
        echo   • 风险等级: 低 (测试环境)
    )
    echo.
    echo [下一步]
    echo   1. 确认配置无误后，可以运行 "启动OKX真实交易.bat"
    echo   2. 首次运行前，建议先将 OKX_SANDBOX 设为 true 进行测试
    echo.
) else (
    color 0C
    echo ╔═══════════════════════════════════════════════╗
    echo ║            ✗ 配置不完整，无法启动               ║
    echo ╚═══════════════════════════════════════════════╝
    echo.
    echo 请确保 .env.local 中配置了所有必需项:
    echo   - OKX_API_KEY
    echo   - OKX_SECRET_KEY
    echo   - OKX_PASSPHRASE
    echo   - OKX_SANDBOX (true 或 false)
    echo.
)

pause
