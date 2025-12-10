Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 获取当前脚本所在目录
strScriptPath = fso.GetParentFolderName(WScript.ScriptFullName)
strDesktop = WshShell.SpecialFolders("Desktop")

' 创建主启动快捷方式
Set oShellLink1 = WshShell.CreateShortcut(strDesktop & "\Alpha Arena (OKX真实交易).lnk")
oShellLink1.TargetPath = strScriptPath & "\启动OKX真实交易.bat"
oShellLink1.WorkingDirectory = strScriptPath
oShellLink1.Description = "Alpha Arena Clone - OKX真实交易启动"
oShellLink1.IconLocation = "%SystemRoot%\System32\SHELL32.dll,138"
oShellLink1.Save

' 创建配置检查快捷方式
Set oShellLink2 = WshShell.CreateShortcut(strDesktop & "\检查 OKX 配置.lnk")
oShellLink2.TargetPath = strScriptPath & "\检查OKX配置.bat"
oShellLink2.WorkingDirectory = strScriptPath
oShellLink2.Description = "检查 Alpha Arena 的 OKX 配置"
oShellLink2.IconLocation = "%SystemRoot%\System32\SHELL32.dll,23"
oShellLink2.Save

MsgBox "✓ 桌面快捷方式创建成功!" & vbCrLf & vbCrLf & _
       "已创建以下快捷方式:" & vbCrLf & _
       "1. Alpha Arena (OKX真实交易).lnk" & vbCrLf & _
       "2. 检查 OKX 配置.lnk" & vbCrLf & vbCrLf & _
       "建议先运行配置检查工具，确认无误后再启动交易系统。", 64, "完成"
