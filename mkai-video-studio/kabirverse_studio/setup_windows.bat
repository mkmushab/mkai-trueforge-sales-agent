@echo off
cd /d "%~dp0"
echo === KabirVerse 3D setup ===
where python >nul 2>nul || (echo Python 3.9+ not found. Install from python.org and tick "Add to PATH". & pause & exit /b 1)
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt || (echo Install failed. & pause & exit /b 1)
echo.
echo NOTE: no "playwright install" needed - the agent drives YOUR Chrome.
echo Next: 1) put your NEW keys in .env   2) run doctor_windows.bat   3) run_once_windows.bat
pause
