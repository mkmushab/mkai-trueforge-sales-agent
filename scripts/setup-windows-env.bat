@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: ============================================================
:: LobsterAI Windows  
:: ============================================================
::  
::  
:: ============================================================

title LobsterAI  

echo.
echo ============================================================
echo   LobsterAI Windows  
echo ============================================================
echo.

:: -----------------------------------------------------------
::   0:  
:: -----------------------------------------------------------
echo [0/8]  ...
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ ]  
    echo         " " 
    echo.
    pause
    exit /b 1
)
echo       √  
echo.

:: -----------------------------------------------------------
::   1:   Node.js 24.x
:: -----------------------------------------------------------
echo [1/8]   Node.js...

::   PATH   session  
set "PATH=C:\Program Files\nodejs;%PATH%"

where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do set NODE_VER=%%v
    echo !NODE_VER! | findstr /r "^v24\." >nul 2>&1
    if !errorlevel! equ 0 (
        echo       √ Node.js  : !NODE_VER!
    ) else (
        echo       ! Node.js  : !NODE_VER!
        echo           24.x  ...
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        if !errorlevel! neq 0 (
            echo       [ ] winget   https://nodejs.org/   Node.js 24.x
        )
    )
) else (
    echo       Node.js   winget  ...
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if !errorlevel! neq 0 (
        echo       [ ] winget   https://nodejs.org/   Node.js 24.x
    )
)

::   PATH
set "PATH=C:\Program Files\nodejs;%PATH%"
echo.

:: -----------------------------------------------------------
::   2:   Git
:: -----------------------------------------------------------
echo [2/8]   Git...

set "PATH=C:\Program Files\Git\cmd;%PATH%"

where git >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('git --version 2^>nul') do set GIT_VER=%%v
    echo       √ Git  : !GIT_VER!
) else (
    echo       Git   winget  ...
    winget install Git.Git --accept-source-agreements --accept-package-agreements
    if !errorlevel! neq 0 (
        echo       [ ] winget   https://git-scm.com/   Git
    )
    set "PATH=C:\Program Files\Git\cmd;%PATH%"
)
echo.

:: -----------------------------------------------------------
::   3:   7-Zip
:: -----------------------------------------------------------
echo [3/8]   7-Zip...

if exist "C:\Program Files\7-Zip\7z.exe" (
    echo       √ 7-Zip  
) else (
    echo       7-Zip   winget  ...
    winget install 7zip.7zip --accept-source-agreements --accept-package-agreements
    if !errorlevel! neq 0 (
        echo       [ ] winget   https://www.7-zip.org/   7-Zip
    )
)
echo.

:: -----------------------------------------------------------
::   4:   Windows  
:: -----------------------------------------------------------
echo [4/8]   Windows  ...

reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /v AllowDevelopmentWithoutDevLicense 2>nul | findstr "0x1" >nul 2>&1
if %errorlevel% equ 0 (
    echo       √ Windows  
) else (
    reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /v AllowDevelopmentWithoutDevLicense /t REG_DWORD /d 1 /f >nul 2>&1
    reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /v AllowAllTrustedApps /t REG_DWORD /d 1 /f >nul 2>&1
    if !errorlevel! equ 0 (
        echo       √ Windows  
    ) else (
        echo       [ ]     -^>   -^>    
    )
)
echo.

:: -----------------------------------------------------------
::   5:   PATH  
:: -----------------------------------------------------------
echo [5/8]   PATH  ...

::   PATH
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul ^| findstr Path') do set "CURRENT_USER_PATH=%%b"

set "NEED_UPDATE=0"
set "NEW_PATH=!CURRENT_USER_PATH!"

::   Node.js  
echo !CURRENT_USER_PATH! | findstr /i "nodejs" >nul 2>&1
if !errorlevel! neq 0 (
    set "NEW_PATH=C:\Program Files\nodejs;!NEW_PATH!"
    set "NEED_UPDATE=1"
    echo       +   Node.js   PATH
)

::   Git  
echo !CURRENT_USER_PATH! | findstr /i "Git\\cmd" >nul 2>&1
if !errorlevel! neq 0 (
    set "NEW_PATH=C:\Program Files\Git\cmd;!NEW_PATH!"
    set "NEED_UPDATE=1"
    echo       +   Git   PATH
)

::   npm  
echo !CURRENT_USER_PATH! | findstr /i "Roaming\\npm" >nul 2>&1
if !errorlevel! neq 0 (
    set "NEW_PATH=%APPDATA%\npm;!NEW_PATH!"
    set "NEED_UPDATE=1"
    echo       +   npm   PATH
)

if "!NEED_UPDATE!"=="1" (
    setx PATH "!NEW_PATH!" >nul 2>&1
    echo       √ PATH   cmd  
) else (
    echo       √ PATH  
)

::   session   PATH
set "PATH=C:\Program Files\nodejs;C:\Program Files\Git\cmd;%APPDATA%\npm;%PATH%"
echo.

:: -----------------------------------------------------------
::   6:  
:: -----------------------------------------------------------
echo [6/8]  ...

::   ELECTRON_RUN_AS_NODE
reg query "HKCU\Environment" /v ELECTRON_RUN_AS_NODE >nul 2>&1
if %errorlevel% equ 0 (
    reg delete "HKCU\Environment" /v ELECTRON_RUN_AS_NODE /f >nul 2>&1
    echo       √   ELECTRON_RUN_AS_NODE
) else (
    echo       √ ELECTRON_RUN_AS_NODE  
)

reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v ELECTRON_RUN_AS_NODE >nul 2>&1
if %errorlevel% equ 0 (
    reg delete "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v ELECTRON_RUN_AS_NODE /f >nul 2>&1
    echo       √   ELECTRON_RUN_AS_NODE
)

::   session
set "ELECTRON_RUN_AS_NODE="
echo.

:: -----------------------------------------------------------
::   7:  
:: -----------------------------------------------------------
echo [7/8]   (npm install)...

::  
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

::   package.json  
if not exist "%PROJECT_DIR%\package.json" (
    echo       [ ]   package.json 
    echo         scripts/  
    echo        : %PROJECT_DIR%
    echo.
    goto :verify
)

cd /d "%PROJECT_DIR%"
echo        : %CD%

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo       [ ] npm  
    echo         cmd 
    echo        Node.js  
    echo.
    goto :verify
)

::   node_modules  
if exist "node_modules\.bin\electron-builder.cmd" (
    echo       √ node_modules  
    echo         node_modules  
) else (
    echo         npm install ...
    echo        
    echo.
    call npm install
    if !errorlevel! neq 0 (
        echo.
        echo       [ ] npm install  
        echo        
        echo         npm config set registry https://registry.npmmirror.com
        echo         npm install
    ) else (
        echo.
        echo       √ npm install  
    )
)
echo.

:: -----------------------------------------------------------
::   8:  
:: -----------------------------------------------------------
:verify
echo [8/8]  ...
echo.

set "PASS_COUNT=0"
set "FAIL_COUNT=0"

::   Node.js
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do (
        echo       [√] Node.js %%v
        set /a PASS_COUNT+=1
    )
) else (
    echo       [×] Node.js  
    set /a FAIL_COUNT+=1
)

::   npm
where npm >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('npm --version 2^>nul') do (
        echo       [√] npm %%v
        set /a PASS_COUNT+=1
    )
) else (
    echo       [×] npm  
    set /a FAIL_COUNT+=1
)

::   Git
where git >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('git --version 2^>nul') do (
        echo       [√] %%v
        set /a PASS_COUNT+=1
    )
) else (
    echo       [×] Git  
    set /a FAIL_COUNT+=1
)

::   7-Zip
if exist "C:\Program Files\7-Zip\7z.exe" (
    echo       [√] 7-Zip  
    set /a PASS_COUNT+=1
) else (
    echo       [×] 7-Zip  
    set /a FAIL_COUNT+=1
)

::   Windows  
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /v AllowDevelopmentWithoutDevLicense 2>nul | findstr "0x1" >nul 2>&1
if %errorlevel% equ 0 (
    echo       [√] Windows  
    set /a PASS_COUNT+=1
) else (
    echo       [×] Windows  
    set /a FAIL_COUNT+=1
)

::   ELECTRON_RUN_AS_NODE  
reg query "HKCU\Environment" /v ELECTRON_RUN_AS_NODE >nul 2>&1
if %errorlevel% neq 0 (
    echo       [√] ELECTRON_RUN_AS_NODE  
    set /a PASS_COUNT+=1
) else (
    echo       [×] ELECTRON_RUN_AS_NODE  
    set /a FAIL_COUNT+=1
)

::   node_modules
if exist "%PROJECT_DIR%\node_modules\.bin\electron-builder.cmd" (
    echo       [√]  
    set /a PASS_COUNT+=1
) else (
    echo       [×]   npm install 
    set /a FAIL_COUNT+=1
)

::   Electron  
if exist "%PROJECT_DIR%\node_modules\electron\dist\electron.exe" (
    echo       [√] Electron  
    set /a PASS_COUNT+=1
) else (
    echo       [×] Electron  
    set /a FAIL_COUNT+=1
)

echo.
echo ============================================================

if !FAIL_COUNT! equ 0 (
    echo   ✅  !PASS_COUNT!/!PASS_COUNT! 
    echo.
    echo     cmd  
    echo.
    echo     cd %PROJECT_DIR%
    echo     npm run electron:dev          ^( ^)
    echo     npm run dist:win              ^(  Windows  ^)
    echo.
    echo     Node.js   Git 
    echo     cmd  
) else (
    echo   ⚠   !FAIL_COUNT!  
    echo.
    echo     Node.js / Git 
    echo     1.  
    echo     2.   cmd  
    echo     3.  
)

echo ============================================================
echo.
pause
endlocal
