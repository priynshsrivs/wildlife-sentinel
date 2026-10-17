@echo off
setlocal
cd /d "%~dp0"
title Wildlife Sentinel

echo Wildlife Sentinel - local startup
echo Checkout: %~dp0
echo.

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" scripts\bootstrap.py --frontend-port 5174 %*
  goto finished
)

where py >nul 2>nul
if not errorlevel 1 (
  py -3.13 scripts\bootstrap.py --frontend-port 5174 %*
  goto finished
)

where python >nul 2>nul
if not errorlevel 1 (
  python scripts\bootstrap.py --frontend-port 5174 %*
  goto finished
)

echo Python 3.13 is required. Install it, then run start.bat again.
cmd /c exit 1

:finished
set "SENTINEL_EXIT=%errorlevel%"
if /i "%~1"=="--check" exit /b %SENTINEL_EXIT%
if not "%SENTINEL_EXIT%"=="0" (
  echo.
  echo Startup stopped. Review the message above; no existing services were stopped.
  echo To verify prerequisites without starting services, run start.bat --check.
  echo.
  pause
)
exit /b %SENTINEL_EXIT%
