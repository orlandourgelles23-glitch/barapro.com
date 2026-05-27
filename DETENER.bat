@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title BARAPRO v11 - Detener Servidor
color 0A

echo.
echo ============================================================
echo   BARAPRO v11 - Deteniendo servidor...
echo ============================================================
echo.

REM -- Find and kill processes on port 3000 --
echo Buscando procesos en puerto 3000...

set "FOUND_PID=0"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo Deteniendo proceso PID %%a...
    taskkill /PID %%a /F >nul 2>&1
    set "FOUND_PID=1"
)

if "!FOUND_PID!"=="0" (
    echo No se encontraron procesos en el puerto 3000.
)

echo.
echo  Servidor BARAPRO detenido.
echo.
pause
