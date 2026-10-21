@echo off
title CampusPass
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found. Install Node.js and try again.
    pause
    exit /b 1
)
if not exist "node_modules\express" (
    echo Installing packages for the first run...
    call npm install
)
echo Starting on http://localhost:3100
node server.js
pause
