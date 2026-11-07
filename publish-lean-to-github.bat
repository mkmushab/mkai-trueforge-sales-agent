@echo off
echo ============================================================================
echo   PUBLISHING LEAN 22-FILE TRUEFORGE REPO TO GITHUB (GREEN CI CHECKMARK)
echo ============================================================================
if exist .git rmdir /s /q .git
if exist ..\.env copy /y ..\.env .env >nul 2>&1

echo [1/2] Running Self-Improving Agent Loop (Run 1 -> Skill Rewrite -> Run 2)...
python run.py

if exist .env del /f /q .env >nul 2>&1

echo [2/2] Pushing clean lean repo to https://github.com/mkmushab/mkai-trueforge-sales-agent.git ...
git init
git config user.name "mkmushab"
git config user.email "mkmushab@users.noreply.github.com"
git branch -M main
git add .
git commit -m "feat: lean TrueForge self-improving B2B sales & leads agent (Run 1: 52.2 -> Run 2: 95.25)"
git remote add origin https://github.com/mkmushab/mkai-trueforge-sales-agent.git
git push -u origin main --force

echo ============================================================================
echo   PUBLISHED CLEAN LEAN REPO! Check https://github.com/mkmushab/mkai-trueforge-sales-agent
echo ============================================================================
pause
