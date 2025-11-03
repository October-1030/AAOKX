@echo off
echo ========================================
echo 正在清理端口 3000...
echo ========================================
echo.

REM 查找占用3000端口的进程
echo [1/3] 查找占用端口3000的进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    set PID=%%a
)

if defined PID (
    echo 找到进程 PID: %PID%
    echo.
    echo [2/3] 显示进程详情...
    tasklist /FI "PID eq %PID%" /FO TABLE
    echo.
    echo [3/3] 正在关闭进程...
    taskkill /F /PID %PID%
    echo.
    if %ERRORLEVEL% EQU 0 (
        echo ✅ 端口 3000 已成功释放！
    ) else (
        echo ❌ 关闭进程失败，可能需要管理员权限
        echo 请右键点击此文件，选择"以管理员身份运行"
    )
) else (
    echo ✅ 端口 3000 当前未被占用
    echo 可以直接启动项目: npm run dev
)

echo.
echo ========================================
echo 按任意键退出...
pause >nul
