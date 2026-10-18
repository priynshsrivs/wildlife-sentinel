@echo off
setlocal
cd /d "%~dp0"
title Wildlife Sentinel Hardware
if not exist ".venv\Scripts\python.exe" (
  echo Run start.bat --setup first to prepare the Python environment.
  exit /b 1
)
".venv\Scripts\python.exe" hardware_listener.py %*
exit /b %errorlevel%
