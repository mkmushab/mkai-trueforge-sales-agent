@echo off
echo ============================================================================
echo   MK-AI x TRUEFORGE - ONE-CLICK FULL VERIFICATION (WINDOWS)
echo ============================================================================
python check_trueforge_live.py
echo.
echo Running 9-Subsystem Verification Matrix (verify-all-systems.py)...
python verify-all-systems.py
echo.
echo Done! To launch the live TrueForge Web UI on http://localhost:8790, run:
echo   npx @truefoundry/trueforge@latest
pause
