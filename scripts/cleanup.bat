@echo off
REM Cleanup script for Windows (run from scripts\cleanup.bat)
pushd %~dp0\.. || exit /b 1
echo Repository root: %CD%

echo Removing data directory if present...
if exist "data" (
  rmdir /s /q "data"
  echo Removed: data
) else (
  echo Not found: data
)
necho Removing .cache directory if present...
if exist ".cache" (
  rmdir /s /q ".cache"
  echo Removed: .cache
) else (
  echo Not found: .cache
)
necho Removing .local directory if present...
if exist ".local" (
  rmdir /s /q ".local"
  echo Removed: .local
) else (
  echo Not found: .local
)
necho Removing any .sqlite files in repository...
for /r %%f in (*.sqlite) do (
  del /q "%%f" && echo Removed sqlite: %%f
)
necho Removing artifact build directories (if exist)...
if exist "artifacts\ppro\dist" (
  rmdir /s /q "artifacts\ppro\dist" && echo Removed artifacts\ppro\dist
)
necho Cleanup complete.
popd
pause
