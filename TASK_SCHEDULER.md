# skyh00k local automation — Task Scheduler setup (~10 min, one time)

Replaces the GitHub Actions crons (blocked by stats.nba.com's datacenter-IP
throttling). Same scripts, same schedule, runs on your PC where they work.

## 0. One-time: check git works in a terminal
Open cmd and run:  git --version
- If it prints a version -> skip to step 1.
- If "not recognized" -> install Git for Windows from https://git-scm.com/download/win
  (accept ALL defaults, ~2 min). It shares credentials with GitHub Desktop,
  so no login setup needed. Close and reopen cmd, verify git --version works.

Then do ONE manual test before scheduling. In cmd:
    cd C:\Users\wangm\OneDrive\Documents\GitHub\skyh00k
    run_daily.bat
Wait for it to finish (a few minutes), then check data\task_log.txt ends
with "run complete" and GitHub shows a new auto commit.

## 1. Put run_daily.bat in the repo root
C:\Users\wangm\OneDrive\Documents\GitHub\skyh00k\run_daily.bat
(committing it is fine — it contains nothing secret)

## 2. Create the scheduled task
1. Start menu -> type "Task Scheduler" -> open it
2. Right panel -> Create Task (NOT "Create Basic Task")
3. General tab:
   - Name: skyh00k daily
   - Select "Run whether user is logged on or not"
   - Check "Run with highest privileges" (avoids OneDrive permission quirks)
4. Triggers tab -> New:
   - Begin: On a schedule, Daily, 9:30 AM  -> OK
   -> New again: Daily, 5:40 PM -> OK   (two triggers, one task)
5. Actions tab -> New:
   - Action: Start a program
   - Program/script:  C:\Users\wangm\OneDrive\Documents\GitHub\skyh00k\run_daily.bat
   - Start in:        C:\Users\wangm\OneDrive\Documents\GitHub\skyh00k
6. Conditions tab:
   - UNCHECK "Start the task only if the computer is on AC power" (laptop)
   - CHECK "Wake the computer to run this task"
7. Settings tab:
   - CHECK "Run task as soon as possible after a scheduled start is missed"
     (covers the PC being asleep/off at trigger time)
8. OK -> enter your Windows password when prompted

## 3. Verify
Right-click the task -> Run. Watch data\task_log.txt fill in, then check
GitHub for the auto commit and Vercel for the redeploy. Done: the loop now
runs itself twice a day from your desk.

## Notes
- PC off at both trigger times = no update that day; the "run missed task"
  setting catches it as soon as the PC wakes.
- The GitHub Actions workflow can stay for manual runs, but silence its
  failing crons: edit .github/workflows/skyh00k.yml on GitHub and delete the
  two "- cron:" lines (keep workflow_dispatch), so it stops emailing you
  daily failures.

## Run-now watcher (v0.8.1)

One-time setup for the RUN NOW button in the app:

1. Supabase -> SQL Editor -> paste `supabase_run_requests.sql` -> Run.
2. Create `data\supabase.env` (it's gitignored) with two lines, same values
   as the Vercel env vars:
       SUPABASE_URL=https://xxxx.supabase.co
       SUPABASE_KEY=eyJ...   (the legacy anon key)
3. Task Scheduler -> Create Task:
   - Name: skyh00k watch
   - Trigger: Daily 8:00 AM, Advanced: repeat every 15 minutes for 1 day
   - Action: Start a program ->
       Program:  C:\Users\wangm\OneDrive\Documents\GitHub\skyh00k\run_watch.bat
       Start in: C:\Users\wangm\OneDrive\Documents\GitHub\skyh00k
   - Conditions: uncheck "only on AC power"
4. Test: tap RUN NOW in the app, then right-click "skyh00k watch" -> Run.
   data\task_log.txt should show "run-now request picked up".

While the laptop is awake, a RUN NOW tap is picked up within ~15 minutes.
Laptop asleep = request waits in the queue until it wakes.
