@echo off
REM skyh00k daily automation — runs audits + NBA slate build, pushes results.
REM Scheduled via Windows Task Scheduler (see TASK_SCHEDULER.md).
REM Order matters: audits grade yesterday's archived slates BEFORE build
REM overwrites the live slate.json (CLAUDE.md constraint #2).

set REPO=C:\Users\wangm\OneDrive\Documents\GitHub\skyh00k
set LOG=%REPO%\data\task_log.txt

echo ================================================== >> "%LOG%"
echo skyh00k daily run: %date% %time% >> "%LOG%"

cd /d "%REPO%" || (echo REPO NOT FOUND >> "%LOG%" & exit /b 1)

git pull >> "%LOG%" 2>&1

cd data
REM WNBA audit: grades any remaining archived WNBA slates, then is a no-op
REM (season over; run build_slate.py --league wnba manually for playoff slates)
python audit_slate.py --league wnba >> "%LOG%" 2>&1
python audit_slate.py --league nba >> "%LOG%" 2>&1
python build_slate.py --league nba >> "%LOG%" 2>&1
cd ..

git add app/public/slate.json app/public/audit.json data/slates data/audit_log.csv >> "%LOG%" 2>&1
git commit -m "auto: slate + audit %date% %time%" >> "%LOG%" 2>&1
git push >> "%LOG%" 2>&1

echo run complete: %date% %time% >> "%LOG%"
