@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Missing .venv. Run: py -3.13 -m venv .venv
  echo Then: .venv\Scripts\python.exe -m pip install -r backend\requirements.txt
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS before continuing.
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm is missing from PATH.
  exit /b 1
)
if not exist ".env" (
  echo Initializing local environment credentials...
  ".venv\Scripts\python.exe" -m scripts.init_env
)
if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  cd /d "%~dp0frontend" && call npm install && cd /d "%~dp0"
)
".venv\Scripts\python.exe" -m scripts.launch %*
exit /b %errorlevel%
