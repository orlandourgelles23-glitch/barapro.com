@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title BARAPRO v11 - Crear Acceso Directo
color 0A

echo.
echo ============================================================
echo   BARAPRO v11 - Crear Acceso Directo en Escritorio
echo ============================================================
echo.

REM -- FIX: D10 - Always point to root INICIAR.bat, not standalone --
set "SHORTCUT_TARGET=%~dp0INICIAR.bat"
set "ICON_DIR=%~dp0"

echo  Creando acceso directo en el escritorio...

REM -- Create VBScript to make a proper Windows shortcut --
set "VBS_FILE=%TEMP%\barapro_shortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "!VBS_FILE!"
echo sLinkFile = oWS.SpecialFolders("Desktop") & "\BARAPRO.lnk" >> "!VBS_FILE!"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "!VBS_FILE!"
echo oLink.TargetPath = "!SHORTCUT_TARGET!" >> "!VBS_FILE!"
echo oLink.WorkingDirectory = "!ICON_DIR!" >> "!VBS_FILE!"
echo oLink.Description = "BARAPRO v11 - Viabilidad Financiera" >> "!VBS_FILE!"
echo oLink.Save >> "!VBS_FILE!"

cscript //nologo "!VBS_FILE!"
del "!VBS_FILE!" 2>nul

if !ERRORLEVEL! EQU 0 (
    echo  Acceso directo creado en el escritorio.
) else (
    echo  [AVISO] No se pudo crear el acceso directo automaticamente.
    echo  Puede crearlo manualmente: clic derecho en INICIAR.bat ^> Enviar a Escritorio
)

echo.
pause
