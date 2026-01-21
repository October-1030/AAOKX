@echo off
chcp 65001 >nul
title OKX Trading System v1.4 - Sentinel

echo ══════════════════════════════════════════════════════════
echo   OKX 交易系统 v1.4 (Sentinel)
echo   日期: 2026-01-20
echo ══════════════════════════════════════════════════════════
echo.

:: 切换到项目目录
cd /d "D:\onedrive\文档\ProjectS\AAOKX"

:: 检查环境
echo [1/3] 检查环境配置...
findstr /C:"OKX_SANDBOX=true" .env.local >nul 2>&1
if %errorlevel%==0 (
    echo       模式: 模拟盘 (Sandbox)
) else (
    echo       模式: 实盘 (Live) - 请谨慎操作!
)
echo.

:: 显示修复信息
echo [2/3] v1.4 修复内容:
echo       - Dashboard 使用新 Sentinel 系统
echo       - 安全限制: MAX_ORDER=$50, MAX_CONTRACTS=50
echo       - 观察模式: 等待 0.3%% 反弹确认
echo       - 反抖动: 开仓后 15 秒保护
echo       - EMA20 趋势过滤
echo       - 速度过滤: 60秒跌 ^>1.5%% 不开仓
echo.

:: 启动服务器
echo [3/3] 启动开发服务器...
echo.
echo ══════════════════════════════════════════════════════════
echo   访问地址: http://localhost:3000
echo   按 Ctrl+C 停止服务器
echo ══════════════════════════════════════════════════════════
echo.

npm run dev

pause
