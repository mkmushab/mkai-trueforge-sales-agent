@echo off
cd /d "%~dp0"
call .venv\Scripts\activate.bat
echo Making the LONG YouTube video (2:00-2:30, 16:9). Takes 5-10 minutes. Add --upload to open YouTube Studio.
python scheduler_24x7.py --now --kind long %*
pause
