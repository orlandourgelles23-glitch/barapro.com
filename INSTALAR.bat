@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title BARAPRO v11 - Instalacion
color 0A

REM ============================================================
REM SAFETY: Prevent unexpected window closure
REM   - Every exit point has a "pause" so the user can see
REM     the error message before the window closes.
REM   - All "call" commands are wrapped with error handling.
REM   - Special characters in paths are handled safely.
REM   - The script NEVER exits without showing the user what
REM     happened and giving them a chance to read it.
REM ============================================================

echo.
echo ============================================================
echo   BARAPRO v11 - Instalador
echo   Herramienta de Viabilidad Financiera
echo ============================================================
echo.
echo  Si se corta la red, ejecute este bat de nuevo.
echo  El instalador continuara desde donde se quedo.
echo.

REM ============================================================
REM SAFETY: Check for special characters in path
REM ============================================================
set "CURRENT_DIR=%~dp0"
set "CURRENT_DIR=!CURRENT_DIR:~0,-1!"
echo  Directorio: !CURRENT_DIR!
echo !CURRENT_DIR! | findstr /R "[()&^#!@%%]" >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo.
    echo  [AVISO] La ruta contiene caracteres especiales.
    echo  Esto puede causar problemas. Se recomienda mover la
    echo  carpeta a una ruta simple como: D:\BARAPRO\BARAPRO_v11
    echo.
    echo  Presione cualquier tecla para continuar de todas formas...
    pause >nul 2>&1
)

REM ============================================================
REM STEP 1: Check/Install Node.js
REM ============================================================
echo.
echo [1/9] Verificando Node.js...
where node >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo  Node.js no encontrado. Instalando Node.js v22...
    echo  Descargando... esto puede tardar varios minutos.
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi' -OutFile '!TEMP!\node-setup.msi' -TimeoutSec 300 } catch {}" 2>nul
    if exist "!TEMP!\node-setup.msi" (
        echo  Instalando Node.js ^(puede pedir permisos de administrador^)...
        msiexec /i "!TEMP!\node-setup.msi" /qn /norestart 2>nul
        del "!TEMP!\node-setup.msi" 2>nul
        set "PATH=!PATH!;C:\Program Files\nodejs"
    ) else (
        echo.
        echo  [ERROR] No se pudo descargar Node.js.
        echo  Descarguelo manualmente de https://nodejs.org
        echo.
        pause
        exit /b 1
    )
    where node >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo  [ERROR] No se pudo instalar Node.js.
        echo  Descarguelo de https://nodejs.org e instalelo manualmente.
        echo  Luego ejecute este instalador de nuevo.
        echo.
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%i in ('node -v 2^>nul') do echo  [1/9] Node.js %%i - OK

REM ============================================================
REM STEP 2: Check Bun (optional, fallback to npm)
REM ============================================================
echo.
echo [2/9] Verificando Bun (gestor de paquetes alternativo)...
set "BUN_AVAILABLE=0"
where bun >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    set "BUN_AVAILABLE=1"
    echo  Bun encontrado - OK
) else (
    echo  Bun no encontrado. Se usara npm.
)

REM ============================================================
REM STEP 3: Install dependencies WITHOUT postinstall scripts
REM   This prevents ECONNRESET crashes from @prisma/engines
REM   postinstall which downloads large binaries over network.
REM ============================================================
echo.
echo [3/9] Instalando dependencias...
echo  (Si se corta la red, ejecute de nuevo - es reanudable)
echo.
set "INSTALL_OK=0"

if "!BUN_AVAILABLE!"=="1" (
    echo  Intentando con bun install --ignore-scripts...
    call bun install --ignore-scripts 2>nul
    if !ERRORLEVEL! EQU 0 (
        if exist "node_modules\next" set "INSTALL_OK=1"
    )
)

if "!INSTALL_OK!"=="0" (
    echo  Intentando con npm install --ignore-scripts...
    call npm install --ignore-scripts 2>nul
    if !ERRORLEVEL! EQU 0 (
        if exist "node_modules\next" set "INSTALL_OK=1"
    )
)

if "!INSTALL_OK!"=="0" (
    echo  Reintentando con npm install...
    call npm install 2>nul
    if !ERRORLEVEL! EQU 0 (
        if exist "node_modules\next" set "INSTALL_OK=1"
    )
)

if not exist "node_modules\next" (
    echo.
    echo  [ERROR] Dependencias no instaladas correctamente.
    echo  Verifique su conexion a internet y ejecute de nuevo.
    echo.
    pause
    exit /b 1
)
echo  Dependencias instaladas correctamente.

REM ============================================================
REM STEP 4: Generate Prisma client (separate from install)
REM ============================================================
echo.
echo [4/9] Generando cliente Prisma...
set "PRISMA_GEN_OK=0"

if exist "node_modules\.prisma\client\index.js" (
    echo  Prisma client ya generado - OK
    set "PRISMA_GEN_OK=1"
) else (
    echo  Intento 1 de 3...
    if exist "node_modules\.bin\prisma.cmd" (
        call node_modules\.bin\prisma.cmd generate 2>nul
    ) else (
        call npx -y prisma generate 2>nul
    )
    if exist "node_modules\.prisma\client\index.js" set "PRISMA_GEN_OK=1"

    if "!PRISMA_GEN_OK!"=="0" (
        echo  Primer intento fallo. Reintentando en 5 segundos...
        timeout /t 5 /nobreak >nul 2>&1
        echo  Intento 2 de 3...
        if exist "node_modules\.bin\prisma.cmd" (
            call node_modules\.bin\prisma.cmd generate 2>nul
        ) else (
            call npx -y prisma generate 2>nul
        )
        if exist "node_modules\.prisma\client\index.js" set "PRISMA_GEN_OK=1"
    )

    if "!PRISMA_GEN_OK!"=="0" (
        echo  Segundo intento fallo. Reintentando en 5 segundos...
        timeout /t 5 /nobreak >nul 2>&1
        echo  Intento 3 de 3...
        if exist "node_modules\.bin\prisma.cmd" (
            call node_modules\.bin\prisma.cmd generate 2>nul
        ) else (
            call npx -y prisma generate 2>nul
        )
        if exist "node_modules\.prisma\client\index.js" set "PRISMA_GEN_OK=1"
    )
)

if "!PRISMA_GEN_OK!"=="1" (
    echo  Cliente Prisma generado correctamente.
) else (
    echo  [AVISO] prisma generate fallo tras 3 intentos.
    echo  El sistema intentara generarlo en el primer inicio.
)

REM ============================================================
REM STEP 5: Initialize database (only if prisma generate worked)
REM ============================================================
echo.
echo [5/9] Inicializando base de datos...

if "!PRISMA_GEN_OK!"=="0" (
    echo  [AVISO] Se omitira la inicializacion de la base de datos.
    echo  Se creara automaticamente en el primer inicio del sistema.
    goto :skip_db_init
)

if not exist "db" mkdir db

REM -- Build absolute DATABASE_URL safely --
for /f "tokens=*" %%d in ('cd') do set "DATABASE_URL=file:%%d/db/custom.db"
set "DATABASE_URL=!DATABASE_URL:\=/!"
set "NODE_ENV=production"

echo  Creando tablas ^(prisma db push^)...
if exist "node_modules\.bin\prisma.cmd" (
    call node_modules\.bin\prisma.cmd db push 2>nul
) else (
    call npx -y prisma db push 2>nul
)
if !ERRORLEVEL! NEQ 0 (
    echo  [AVISO] prisma db push fallo. Intentando alternativa...
    call node node_modules\prisma\entrypoint.js db push 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo  [AVISO] No se pudieron crear las tablas.
        echo  Se intentara crear en el primer inicio del sistema.
    )
)

echo.
echo  Insertando datos iniciales...
call node init-db.js 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [AVISO] init-db.js fallo. Intentando alternativa...
    call npx -y tsx prisma\seed.ts 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo  [AVISO] No se pudieron insertar todos los datos iniciales.
        echo  El sistema puede funcionar, pero puede faltar data basica.
    )
)
echo  Base de datos inicializada.

:skip_db_init

REM ============================================================
REM STEP 6: Build better-sqlite3 native module
REM ============================================================
echo.
echo [6/9] Compilando better-sqlite3 (modulo nativo)...

if exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
    echo  better-sqlite3 ya compilado - OK
) else (
    echo  Compilando modulo nativo para esta plataforma...
    call npm rebuild better-sqlite3 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo  [AVISO] npm rebuild fallo. Intentando con node-gyp...
        call npx -y node-gyp rebuild --directory=node_modules/better-sqlite3 2>nul
        if !ERRORLEVEL! NEQ 0 (
            echo  [AVISO] No se pudo compilar better-sqlite3.
            echo  El sistema intentara compilarlo en el primer inicio.
            echo  Si falla, instale Visual Studio Build Tools.
        ) else (
            echo  better-sqlite3 compilado con node-gyp - OK
        )
    ) else (
        echo  better-sqlite3 compilado - OK
    )
)

REM ============================================================
REM STEP 7: Generate AUTH_SECRET_HEX
REM ============================================================
echo.
echo [7/9] Generando clave de seguridad...
if exist "scripts\generate-auth-secret.js" (
    node scripts\generate-auth-secret.js 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo  [AVISO] Error generando clave. Se intentara en el primer inicio.
    )
) else (
    echo  [AVISO] generate-auth-secret.js no encontrado.
    echo  Se generara la clave en el primer inicio.
)

REM ============================================================
REM STEP 8: Build the Next.js standalone app
REM ============================================================
echo.
echo [8/9] Compilando BARAPRO ^(1-3 minutos^)...
echo  Este paso es el mas largo. No cierre esta ventana.
echo.

set "BUILD_OK=0"

REM -- Attempt 1: Turbopack with 4GB memory --
echo  Intentando compilacion con Turbopack ^(4GB RAM^)...
set "NODE_OPTIONS=--max-old-space-size=4096"
if exist "node_modules\.bin\next.cmd" (
    call "node_modules\.bin\next.cmd" build 2>nul
) else (
    call npx -y next build 2>nul
)
if !ERRORLEVEL! EQU 0 set "BUILD_OK=1"

REM -- Attempt 2: Webpack with 4GB memory --
if "!BUILD_OK!"=="0" (
    echo.
    echo  [AVISO] Turbopack fallo. Intentando con Webpack ^(usa menos memoria^)...
    echo.
    set "NODE_OPTIONS=--max-old-space-size=4096"
    if exist "node_modules\.bin\next.cmd" (
        call "node_modules\.bin\next.cmd" build --webpack 2>nul
    ) else (
        call npx -y next build --webpack 2>nul
    )
    if !ERRORLEVEL! EQU 0 set "BUILD_OK=1"
)

REM -- Attempt 3: Webpack with 2GB memory --
if "!BUILD_OK!"=="0" (
    echo.
    echo  [AVISO] Reintentando con menos memoria...
    echo.
    set "NODE_OPTIONS=--max-old-space-size=2048"
    if exist "node_modules\.bin\next.cmd" (
        call "node_modules\.bin\next.cmd" build --webpack 2>nul
    ) else (
        call npx -y next build --webpack 2>nul
    )
    if !ERRORLEVEL! EQU 0 set "BUILD_OK=1"
)

if "!BUILD_OK!"=="0" (
    echo.
    echo  [AVISO] La compilacion fallo.
    echo  Configurando modo desarrollo ^(usa menos memoria^)...
    echo.
    goto :dev_mode_setup
)

REM ============================================================
REM FIX: Flatten nested standalone directory
REM ============================================================
if not exist ".next\standalone\server.js" (
    echo  Detectando estructura standalone anidada...
    for /d %%i in (".next\standalone\*") do (
        if exist "%%i\server.js" (
            echo  Aplanando: %%i -^> .next\standalone
            xcopy /E /I /Y "%%i" ".next\standalone" >nul 2>&1
        )
    )
)

if not exist ".next\standalone\server.js" (
    echo.
    echo  [AVISO] No se genero el build standalone.
    echo  Configurando modo desarrollo...
    echo.
    goto :dev_mode_setup
)
echo  Compilacion completada.

REM ============================================================
REM STEP 9: Copy files to standalone directory
REM ============================================================
echo.
echo [9/9] Copiando archivos al directorio de ejecucion...

REM -- Copy start.js (DB auto-init wrapper) - MUST NOT overwrite server.js --
if exist "start.js" (
    copy /Y "start.js" ".next\standalone\start.js" >nul 2>&1
    echo  start.js copiado.
) else (
    echo  [AVISO] No se encontro start.js. Se usara server.js directamente.
)

REM -- Copy INICIAR.bat to standalone --
if exist "INICIAR.bat" (
    copy /Y "INICIAR.bat" ".next\standalone\INICIAR.bat" >nul 2>&1
    echo  INICIAR.bat copiado.
) else (
    echo  [AVISO] No se encontro INICIAR.bat. Se generara uno basico.
    (
        echo @echo off
        echo setlocal enabledelayedexpansion
        echo cd /d "%%~dp0"
        echo set "NODE_ENV=production"
        echo set "PORT=3000"
        echo set "BARAPRO_AUTO_OPEN=1"
        echo if not exist "db" mkdir db
        echo for /f "tokens=*" %%%%d in ^('cd'^) do set "DATABASE_URL=file:%%%%d/db/custom.db"
        echo set "DATABASE_URL=!DATABASE_URL:\=/!"
        echo if exist "start.js" ^(
        echo     node start.js
        echo ^) else ^(
        echo     node server.js
        echo ^)
        echo if !ERRORLEVEL! NEQ 0 ^(
        echo     echo.
        echo     echo  [ERROR] El servidor fallo.
        echo ^)
        echo pause
    ) > ".next\standalone\INICIAR.bat"
)

REM -- Copy DETENER.bat to standalone --
if exist "DETENER.bat" (
    copy /Y "DETENER.bat" ".next\standalone\DETENER.bat" >nul 2>&1
    echo  DETENER.bat copiado.
)

REM -- Copy CREAR_ACCESO_DIRECTO.bat to standalone --
if exist "CREAR_ACCESO_DIRECTO.bat" (
    copy /Y "CREAR_ACCESO_DIRECTO.bat" ".next\standalone\CREAR_ACCESO_DIRECTO.bat" >nul 2>&1
    echo  CREAR_ACCESO_DIRECTO.bat copiado.
)

REM -- Copy ACTUALIZAR.bat to standalone --
if exist "ACTUALIZAR.bat" (
    copy /Y "ACTUALIZAR.bat" ".next\standalone\ACTUALIZAR.bat" >nul 2>&1
    echo  ACTUALIZAR.bat copiado.
)

REM -- Copy .next/static to standalone --
if exist ".next\static" (
    if not exist ".next\standalone\.next" mkdir ".next\standalone\.next"
    xcopy /E /I /Y ".next\static" ".next\standalone\.next\static" >nul 2>&1
    echo  Archivos estaticos copiados.
)

REM -- Copy public to standalone --
if exist "public" (
    xcopy /E /I /Y "public" ".next\standalone\public" >nul 2>&1
    echo  Archivos publicos copiados.
)

REM -- Copy .prisma (generated client internals) --
if exist "node_modules\.prisma" (
    if not exist ".next\standalone\node_modules\.prisma" mkdir ".next\standalone\node_modules\.prisma"
    xcopy /E /I /Y "node_modules\.prisma" ".next\standalone\node_modules\.prisma" >nul 2>&1
    echo  .prisma copiado.
)

REM -- Copy @prisma/client --
if exist "node_modules\@prisma\client" (
    if not exist ".next\standalone\node_modules\@prisma\client" mkdir ".next\standalone\node_modules\@prisma\client"
    xcopy /E /I /Y "node_modules\@prisma\client" ".next\standalone\node_modules\@prisma\client" >nul 2>&1
    echo  @prisma/client copiado.
)

REM -- Copy @prisma/engines --
if exist "node_modules\@prisma\engines" (
    if not exist ".next\standalone\node_modules\@prisma\engines" mkdir ".next\standalone\node_modules\@prisma\engines"
    xcopy /E /I /Y "node_modules\@prisma\engines" ".next\standalone\node_modules\@prisma\engines" >nul 2>&1
    echo  @prisma/engines copiado.
)

REM -- Copy prisma CLI --
if exist "node_modules\@prisma\cli" (
    if not exist ".next\standalone\node_modules\@prisma\cli" mkdir ".next\standalone\node_modules\@prisma\cli"
    xcopy /E /I /Y "node_modules\@prisma\cli" ".next\standalone\node_modules\@prisma\cli" >nul 2>&1
    echo  @prisma/cli copiado.
) else if exist "node_modules\prisma" (
    if not exist ".next\standalone\node_modules\prisma" mkdir ".next\standalone\node_modules\prisma"
    xcopy /E /I /Y "node_modules\prisma" ".next\standalone\node_modules\prisma" >nul 2>&1
    echo  prisma CLI copiado.
)

REM -- Copy better-sqlite3 native module --
if exist "node_modules\better-sqlite3" (
    if not exist ".next\standalone\node_modules\better-sqlite3" mkdir ".next\standalone\node_modules\better-sqlite3"
    xcopy /E /I /Y "node_modules\better-sqlite3" ".next\standalone\node_modules\better-sqlite3" >nul 2>&1
    echo  better-sqlite3 copiado.
)

REM -- Copy docx library (Word export) --
if exist "node_modules\docx" (
    if not exist ".next\standalone\node_modules\docx" mkdir ".next\standalone\node_modules\docx"
    xcopy /E /I /Y "node_modules\docx" ".next\standalone\node_modules\docx" >nul 2>&1
    echo  docx copiado.
)

REM -- Copy jszip (dependency of docx for Word export) --
if exist "node_modules\jszip" (
    if not exist ".next\standalone\node_modules\jszip" mkdir ".next\standalone\node_modules\jszip"
    xcopy /E /I /Y "node_modules\jszip" ".next\standalone\node_modules\jszip" >nul 2>&1
    echo  jszip copiado.
)

REM -- Copy jose library (RSA license verification) --
if exist "node_modules\jose" (
    if not exist ".next\standalone\node_modules\jose" mkdir ".next\standalone\node_modules\jose"
    xcopy /E /I /Y "node_modules\jose" ".next\standalone\node_modules\jose" >nul 2>&1
    echo  jose copiado.
)

REM -- Copy bcryptjs (password hashing) --
if exist "node_modules\bcryptjs" (
    if not exist ".next\standalone\node_modules\bcryptjs" mkdir ".next\standalone\node_modules\bcryptjs"
    xcopy /E /I /Y "node_modules\bcryptjs" ".next\standalone\node_modules\bcryptjs" >nul 2>&1
    echo  bcryptjs copiado.
)

REM -- Copy uuid (ID generation) --
if exist "node_modules\uuid" (
    if not exist ".next\standalone\node_modules\uuid" mkdir ".next\standalone\node_modules\uuid"
    xcopy /E /I /Y "node_modules\uuid" ".next\standalone\node_modules\uuid" >nul 2>&1
    echo  uuid copiado.
)

REM -- Copy tsx (for seed execution) --
if exist "node_modules\tsx" (
    if not exist ".next\standalone\node_modules\tsx" mkdir ".next\standalone\node_modules\tsx"
    xcopy /E /I /Y "node_modules\tsx" ".next\standalone\node_modules\tsx" >nul 2>&1
    echo  tsx copiado.
)

REM -- Write .env file (NO space before >) --
set "ENVFILE=.next\standalone\.env"
for /f "tokens=*" %%d in ('cd') do set "STANDALONE_DIR=%%d\.next\standalone"
set "STANDALONE_DIR=!STANDALONE_DIR:\=/!"
echo DATABASE_URL=file:!STANDALONE_DIR!/db/custom.db> "!ENVFILE!"
echo  .env creado.

REM -- Copy database with data to standalone --
if not exist ".next\standalone\db" mkdir ".next\standalone\db"
if exist "db\custom.db" (
    copy /Y "db\custom.db" ".next\standalone\db\custom.db" >nul 2>&1
    echo  Base de datos copiada al directorio de ejecucion.
) else if exist "prisma\data\custom.db" (
    copy /Y "prisma\data\custom.db" ".next\standalone\db\custom.db" >nul 2>&1
    echo  Base de datos copiada al directorio de ejecucion ^(desde prisma\data^).
) else (
    echo  [AVISO] No se encontro db\custom.db ni prisma\data\custom.db.
    echo  Se creara en el primer inicio.
)

REM -- Copy prisma schema and seed for DB recovery --
if not exist ".next\standalone\prisma" mkdir ".next\standalone\prisma"
if exist "prisma\schema.prisma" (
    copy /Y "prisma\schema.prisma" ".next\standalone\prisma\schema.prisma" >nul 2>&1
    echo  schema.prisma copiado.
)
if exist "prisma\seed.ts" (
    copy /Y "prisma\seed.ts" ".next\standalone\prisma\seed.ts" >nul 2>&1
    echo  seed.ts copiado.
)

REM -- Copy init-db.js for DB auto-initialization --
if exist "init-db.js" (
    copy /Y "init-db.js" ".next\standalone\init-db.js" >nul 2>&1
    echo  init-db.js copiado.
)

REM -- Copy scripts/postbuild.js for build repair --
if exist "scripts\postbuild.js" (
    if not exist ".next\standalone\scripts" mkdir ".next\standalone\scripts"
    copy /Y "scripts\postbuild.js" ".next\standalone\scripts\postbuild.js" >nul 2>&1
)

REM ============================================================
REM Verify and repair critical standalone artifacts
REM ============================================================
echo.
echo  Verificando integridad del build standalone...

REM -- Check and create pages-manifest.json if missing --
if not exist ".next\standalone\.next\server\pages-manifest.json" (
    echo  [REPARANDO] pages-manifest.json faltante - creando...
    if not exist ".next\standalone\.next\server\pages" mkdir ".next\standalone\.next\server\pages"
    echo {"\/404":"pages\/404.html","\/500":"pages\/500.html"}> ".next\standalone\.next\server\pages-manifest.json"
    echo  pages-manifest.json creado.
)

REM -- Check and create 404.html if missing --
if not exist ".next\standalone\.next\server\pages\404.html" (
    echo  [REPARANDO] 404.html faltante - creando...
    echo ^<!DOCTYPE html^>^<html^>^<head^>^<meta charset="utf-8"^>^<title^>404^</title^>^</head^>^<body^>^<h1^>404 - Pagina no encontrada^</h1^>^</body^>^</html^>> ".next\standalone\.next\server\pages\404.html"
)

REM -- Check and create 500.html if missing --
if not exist ".next\standalone\.next\server\pages\500.html" (
    echo  [REPARANDO] 500.html faltante - creando...
    echo ^<!DOCTYPE html^>^<html^>^<head^>^<meta charset="utf-8"^>^<title^>500^</title^>^</head^>^<body^>^<h1^>500 - Error del servidor^</h1^>^</body^>^</html^>> ".next\standalone\.next\server\pages\500.html"
)

echo  Verificacion completada.

echo.
echo ============================================================
echo   INSTALACION COMPLETADA ^(modo produccion standalone^)
echo ============================================================
echo.
echo  Para iniciar BARAPRO:
echo    cd .next\standalone
echo    INICIAR.bat
echo.
echo  O simplemente haga doble clic en:
echo    .next\standalone\INICIAR.bat
echo.
echo  Credenciales por defecto:
echo    Usuario:     admin
echo    Contrasena:  2026
echo.
pause
exit /b 0

REM ============================================================
REM DEV MODE FALLBACK (when next build fails)
REM ============================================================
:dev_mode_setup

echo.
echo ============================================================
echo   INSTALACION COMPLETADA ^(modo desarrollo^)
echo ============================================================
echo.
echo  La compilacion produccion fallo.
echo  El sistema funcionara en modo desarrollo.
echo.
echo  Para iniciar BARAPRO haga doble clic en:
echo    INICIAR.bat
echo.
echo  NOTA: INICIAR.bat detectara automaticamente que no hay
echo  build standalone y usara modo desarrollo.
echo  Para modo produccion, compile en una maquina con mas RAM.
echo.
echo  Credenciales por defecto:
echo    Usuario:     admin
echo    Contrasena:  2026
echo.
pause
