@echo off
TITLE Wildlife Sentinel Launcher
echo ===================================================
echo       Launching Wildlife Sentinel Services
echo ===================================================
echo.

set "ROOT_DIR=%~dp0"
REM Remove trailing backslash if present
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

cd /d "%ROOT_DIR%"

echo [1/2] Starting Python Backend (Port 8000)...
start "Wildlife Sentinel - Backend" cmd /k "cd /d "%ROOT_DIR%\backend" && call "%ROOT_DIR%\.venv\Scripts\activate.bat" && python -m uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Vite Dev Server (Port 5173)...
start "Wildlife Sentinel - Frontend" cmd /k "cd /d "%ROOT_DIR%\frontend" && npm run dev"

timeout /t 3 /nobreak >nul
echo.
echo Opening http://localhost:5173 in browser...
start http://localhost:5173/

echo.
echo ===================================================
echo All services launched! Keep the opened windows open.
echo ===================================================
timeout /t 5