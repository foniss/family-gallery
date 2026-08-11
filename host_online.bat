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

:: ── Step 1: Start API ──────────────────────────
echo  [1/4] Starting Python API...
start /B /MIN "" cmd /c "cd /d D:\projects\family-gallery\backend && python api.py"
echo        Waiting for API to be ready...
timeout /t 8 /nobreak >nul
echo        API ready!
echo.

:: ── Step 2: Start React ────────────────────────
echo  [2/4] Starting React App...
start /B /MIN "" cmd /c "cd /d D:\projects\family-gallery && npm start"
echo        Waiting for React to initialize...
timeout /t 8 /nobreak >nul
echo        React ready!
echo.

:: ── Step 3: Open Admin Panel Locally ───────────
echo  [3/4] Opening admin panel (local)...
start "" "http://localhost:3000/admin"
timeout /t 2 /nobreak >nul
echo        Done!
echo.

:: ── Step 4: Start Tunnel + Update GitHub ───────
echo  [4/4] Starting tunnel and updating share link...
echo.
cd /d D:\projects\family-gallery
python update_link.py

:: When tunnel stops (Ctrl+C in Python), come here
echo.
echo  ╔════════════════════════════════════════════╗
echo  ║   Tunnel stopped. Shutting down...         ║
echo  ╚════════════════════════════════════════════╝

taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1

echo  Done!
timeout /t 2 /nobreak >nul
exit