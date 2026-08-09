@echo off
chcp 65001 >nul
cd /d "%~dp0"

where pwsh.exe >nul 2>nul
if %errorlevel%==0 (
  pwsh.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0tools\blog-launcher.ps1"
) else (
  powershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0tools\blog-launcher.ps1"
)

if errorlevel 1 (
  echo.
  echo Khong the mo Blog Manager. Nhan phim bat ky de dong.
  pause >nul
)
