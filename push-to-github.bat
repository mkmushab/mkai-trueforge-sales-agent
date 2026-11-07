@echo off
echo ============================================================================
echo   PUBLISHING TO https://github.com/mkmushab/mkai-trueforge-sales-agent
echo ============================================================================
if exist .git rmdir /s /q .git
if exist .env move /y .env .env.local.backup >nul 2>&1
if exist mkai-backend\.env del /f /q mkai-backend\.env >nul 2>&1

python run.py

git init
git config user.name "mkmushab"
git config user.email "mkmushab@users.noreply.github.com"
git branch -M main
git add .
git commit -m "feat: MK-AI Self-Improving B2B Sales & Leads Agent on TrueForge (Run 1: 50 -> Run 2: 90 -> Run 3: 100)"
git remote add origin https://github.com/mkmushab/mkai-trueforge-sales-agent.git
git push -u origin main --force

if exist .env.local.backup move /y .env.local.backup .env >nul 2>&1
echo ============================================================================
echo   DONE! Open https://github.com/mkmushab/mkai-trueforge-sales-agent
echo ============================================================================
pause
