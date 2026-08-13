# skyh00k v0.5 setup checklist (one time, ~20 min)

## 1. Supabase (Line Book backend)
1. supabase.com -> New project (name: skyh00k, free tier, any region near you)
2. Left sidebar -> SQL Editor -> New query -> paste ALL of `supabase.sql` -> Run
3. Left sidebar -> Project Settings -> API. Copy two values:
   - Project URL  (https://xxxx.supabase.co)
   - anon public key (long string starting eyJ...)

## 2. Vercel (app reads/writes lines)
1. vercel.com -> skyh00k project -> Settings -> Environment Variables
2. Add BOTH, for all environments:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
3. Deployments -> Redeploy latest (env vars only apply on new builds)

## 3. GitHub (automation)
1. Repo -> Settings -> Secrets and variables -> Actions -> New repository secret:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_KEY` = anon public key
2. Repo -> Settings -> Actions -> General -> Workflow permissions ->
   select "Read and write permissions" -> Save

## 4. Local (once)
From repo root in cmd (not PowerShell): `npm install`
(picks up @supabase/supabase-js for local dev; Vercel installs it automatically)

## 5. Verify
- Commit + push this release. Actions tab -> "skyh00k daily" -> Run workflow
  (manual trigger). Watch it audit, build, and push a slate commit.
- Open the app, tap "+ Enter book line" on tonight's top pick, type the DK
  odds, Save -> verdict chip appears instantly and the row lands in
  Supabase -> Table Editor -> lines.

Notes: crons fire at 9:37 AM and 5:41 PM ET (fixed UTC, shifts 1hr when DST
ends). The bot commits slates/audit log; pull before running scripts locally
to avoid conflicts.
