@echo off
echo Starting Chrome with remote debugging on port 9222 (separate agent profile).
echo FIRST TIME: log in to YouTube and Instagram in this window, then leave it open.
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\ChromeAgentProfile"
