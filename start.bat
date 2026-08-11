@echo off
title Family Gallery Launcher
color 0A
cls

echo.
echo  ╔════════════════════════════════════════════╗
echo  ║                                            ║
echo  ║        Family Gallery Launcher             ║
echo  ║                                            ║
echo  ╚════════════════════════════════════════════╝
echo.

:: ── Step 1: Start API ──────────────────────────
echo  [1/3] Starting Python API...
start /B /MIN "" cmd /c "cd /d D:\projects\family-gallery\backend && python api.py"
echo        Waiting for API...
timeout /t 8 /nobreak >nul
echo        Done!
echo.
:: ── Step 2: Start React ────────────────────────
echo  [2/3] Starting React App...
start /B /MIN "" cmd /c "cd /d D:\projects\family-gallery && npm start"
echo        Waiting for React to initialize...
:: Reduced from 25 to 8 seconds since it just needs to initialize, not fully finish compiling before the browser links are sent
timeout /t 8 /nobreak >nul
echo        Done!
echo.

:: ── Step 3: Open Both Tabs ─────────────────────
echo  [3/3] Opening browser...
start "" "http://localhost:3000"
:: No need for a long timeout here, a split second is fine just to let the default browser register the first tab
timeout /t 1 /nobreak >nul
start "" "http://localhost:3000/admin"
echo        Done!

echo.
echo  ╔════════════════════════════════════════════╗
echo  ║                                            ║
echo  ║   Family Gallery is running!               ║
echo  ║                                            ║
echo  ║   Family Viewer:  localhost:3000            ║
echo  ║   Admin Panel:    localhost:3000/admin      ║
echo  ║   API Docs:       localhost:8000/docs       ║
echo  ║                                            ║
echo  ║   Add photos to:                           ║
echo  ║   D:\projects\family-gallery\gallery\inbox  ║
echo  ║                                            ║
echo  ╠════════════════════════════════════════════╣
echo  ║                                            ║
echo  ║   Press Q to shutdown everything           ║
echo  ║   Press R to restart everything            ║
echo  ║   Press O to open browser again            ║
echo  ║                                            ║
echo  ╚════════════════════════════════════════════╝
echo.

:menu
choice /c QRO /n /m "  [Q]uit  [R]estart  [O]pen Browser > "

if errorlevel 3 goto openbrowser
if errorlevel 2 goto restart
if errorlevel 1 goto shutdown

:openbrowser
echo.
echo  Opening browser...
start "" "http://localhost:3000"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000/admin"
echo  Done!
echo.
goto menu

:restart
echo.
echo  Restarting...
echo.

taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo  Starting API...
start /B /MIN "" cmd /c "cd /d D:\projects\family-gallery\backend && python api.py"
timeout /t 8 /nobreak >nul

echo  Starting React...
start /B /MIN "" cmd /c "cd /d D:\projects\family-gallery && npm start"
echo        Waiting for React to initialize...
timeout /t 8 /nobreak >nul

echo  Opening browser...
start "" "http://localhost:3000"
timeout /t 1 /nobreak >nul
start "" "http://localhost:3000/admin"
echo.
echo  Restarted!
echo.
goto menu

:shutdown
echo.
echo  Shutting down...
echo.
taskkill /F /IM python.exe >nul 2>&1
echo  API stopped
taskkill /F /IM node.exe >nul 2>&1
echo  React stopped
echo.
echo  Goodbye!
echo.
timeout /t 2 /nobreak >nul
exit