@echo off
REM Regenerate pnpm lockfile without frozen lockfile
pushd %~dp0\.. || exit /b 1
pnpm install --no-frozen-lockfile
popdnecho done
pause
