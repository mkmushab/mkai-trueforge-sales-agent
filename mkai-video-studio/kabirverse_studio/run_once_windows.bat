@echo off
cd /d "%~dp0"
call .venv\Scripts\activate.bat
echo Making ONE episode (no upload). Add --upload to also open the upload forms in Chrome.
python scheduler_24x7.py --now %*
pause
