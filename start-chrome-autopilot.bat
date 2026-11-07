@echo off
echo ============================================================================
echo   MK AI — Chrome Autopilot (Port 9222 - Persistent Logged-In Boss Profile)
echo   Log into YouTube, Instagram, GitHub, Gmail, LinkedIn, Meta Ads ONCE here!
echo ============================================================================
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\ChromeAgentProfile"
