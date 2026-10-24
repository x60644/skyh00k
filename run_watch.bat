@echo off
REM skyh00k run-now watcher — schedule every 15 minutes (see TASK_SCHEDULER.md).
REM Checks Supabase for a "RUN NOW" tapped in the app; if one is queued,
REM runs the full daily loop. Silent and cheap when there's nothing to do.

set REPO=C:\Users\wangm\OneDrive\Documents\GitHub\skyh00k
cd /d "%REPO%" || exit /b 1

if exist data\supabase.env for /f "usebackq tokens=1,* delims==" %%a in ("data\supabase.env") do set %%a=%%b

python data\check_run_requests.py >nul 2>&1
if %errorlevel% EQU 3 (
  echo run-now request picked up: %date% %time% >> data\task_log.txt
  call run_daily.bat
  python data\check_run_requests.py --complete >nul 2>&1
)
