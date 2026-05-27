@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title BARAPRO v11 - Actualizar
color 0A

echo.
echo ============================================================
echo   BARAPRO v11 - Actualizacion
echo ============================================================
echo.

REM -- Stop the server first --
echo Deteniendo servidor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo  Servidor detenido.
echo.

REM -- Clean build artifacts --
echo Limpiando archivos de compilacion...
if exist ".next" (
    echo  Eliminando .next...
    rmdir /s /q ".next" 2>nul
)

REM -- Re-run the installer --
echo.
echo  Ejecutando instalador...
echo.
call INSTALAR.bat
