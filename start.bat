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

echo  [1/3] Starting Python API...
start /B /MIN "" cmd /c "cd /d %~dp0backend && python api.py"
echo        Waiting for API...
timeout /t 8 /nobreak >nul
echo        Done!
echo.

echo  [2/3] Starting React App...
start /B /MIN "" cmd /c "cd /d %~dp0 && set BROWSER=none && npm start"
echo        Waiting for React...
timeout /t 8 /nobreak >nul
echo        Done!
echo.

echo  [3/3] Opening browser...
start "" "http://localhost:3000"
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
start "" "http://localhost:3000"
timeout /t 1 /nobreak >nul
start "" "http://localhost:3000/admin"
echo  Done!
echo.
goto menu

:restart
echo.
echo  Restarting...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul
start /B /MIN "" cmd /c "cd /d %~dp0backend && python api.py"
timeout /t 8 /nobreak >nul
start /B /MIN "" cmd /c "cd /d %~dp0 && set BROWSER=none && npm start"
timeout /t 8 /nobreak >nul
start "" "http://localhost:3000"
timeout /t 1 /nobreak >nul
start "" "http://localhost:3000/admin"
echo  Restarted!
echo.
goto menu

:shutdown
echo.
echo  Shutting down...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
echo  Goodbye!
timeout /t 2 /nobreak >nul
exit