@echo off
setlocal
cd /d "%~dp0"
if not defined QBR_PORT set QBR_PORT=5500

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%QBR_PORT%"
  echo QBR Dashboard is running at http://localhost:%QBR_PORT%
  echo Keep this window open. Press Ctrl+C to stop.
  py -3 -m http.server %QBR_PORT%
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%QBR_PORT%"
  echo QBR Dashboard is running at http://localhost:%QBR_PORT%
  echo Keep this window open. Press Ctrl+C to stop.
  python -m http.server %QBR_PORT%
  goto :end
)

echo Python 3 is required to start the QBR Dashboard.
echo Install Python 3 from python.org and select "Add Python to PATH".
pause

:end
endlocal
