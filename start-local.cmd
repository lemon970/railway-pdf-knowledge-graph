@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "SCRIPT=%ROOT%scripts\start-local.ps1"

if not exist "%SCRIPT%" (
    echo Cannot find scripts\start-local.ps1.
    pause
    exit /b 1
)

where pwsh.exe >nul 2>&1
if %errorlevel% equ 0 (
    pwsh.exe -NoLogo -NoProfile -File "%SCRIPT%" -ShowWindows %*
    set "EXIT_CODE=%errorlevel%"
) else (
    powershell.exe -NoLogo -NoProfile -File "%SCRIPT%" -ShowWindows %*
    set "EXIT_CODE=%errorlevel%"
)

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Startup failed. Read the message above.
    pause
)

exit /b %EXIT_CODE%
