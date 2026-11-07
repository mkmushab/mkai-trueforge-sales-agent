@echo off
cd /d "%~dp0"
call .venv\Scripts\activate.bat
echo 3 episodes/day. Keep this window open and the laptop awake. Ctrl+C to stop.
python scheduler_24x7.py --daemon --upload
pause
