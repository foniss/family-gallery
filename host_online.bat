@echo off
title Family Gallery — Host Online
color 0B
cls

echo.
echo  ╔════════════════════════════════════════════╗
echo  ║                                            ║
echo  ║    Family Gallery — HOST ONLINE MODE       ║
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

echo  [3/3] Starting tunnel and updating share link...
echo.
cd /d %~dp0
python update_link.py

echo.
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1
echo  Done!
timeout /t 2 /nobreak >nul
exit