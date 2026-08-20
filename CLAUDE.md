# skyh00k — project context

NBA + WNBA first-basket prop predictor and PWA. Second app in the m00nshot
family (m00nshot MLB / skyh00k basketball / b00mstick NFL). Live at
skyh00k.vercel.app. WNBA is the live beta track (in season now); NBA
activates late October 2026.

## Architecture
- `app/` — Vite + React frontend. **Vercel root directory is `app/`**, so
  package.json, package-lock.json, index.html live here, NOT repo root.
  Deploys automatically on push to main.
- `data/` — Python pipeline (nba_api). `build_slate.py` computes factors and
  writes `app/public/slate.json` + archives to `data/slates/`.
  `audit_slate.py` grades past slates into `data/audit_log.csv` (append-only).
- `data/cache/` — play-by-play CSVs, gitignored, ~1,500 files. Never commit.
- Supabase backend: `lines` table (the Line Book). App reads/writes with
  VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (Vercel env vars). Python reads
  with SUPABASE_URL / SUPABASE_KEY. Legacy eyJ anon key, RLS allows
  anon select+insert only.
- `.github/workflows/skyh00k.yml` exists but crons are dead weight — see
  constraint #1.

## Hard constraints (learned the hard way — do not re-litigate)
1. **stats.nba.com blocks datacenter IPs.** GitHub Actions runners time out
   on every fetch (verified twice, 75s timeout × 3 retries). All data pulls
   MUST run on a residential IP. Automation = Windows Task Scheduler running
   `run_daily.bat` (9:30 AM + 5:40 PM ET, missed-task catch-up on).
2. **Audit before build.** `run_daily.bat` order matters: audit grades
   yesterday's archived slate before build overwrites anything. Keep it.
3. **Vercel build command** is `node node_modules/vite/bin/vite.js build`
   (not bare `vite build`) — works around a corrupted-cache permission bug.
   VERCEL_FORCE_NO_BUILD_CACHE env var may still be set; safe to remove
   once builds are consistently green.
4. **Model = structured three-term, not ML.** P(first basket) ≈
   P(team first shot | tip) × first-shot share (L10) × first-attempt FG%
   (shrunk to league mean 0.47, prior n=5) + damped second-chance term.
   Phase-0 constants: tip winner shoots first ~85%, tip team scores first
   ~64-66% (NBA/WNBA nearly identical). Don't add factors without
   measuring effect size first (docs/phase0-findings.md).
5. **Book rules differ:** DraftKings first basket = first FIELD GOAL
   (matches model). FanDuel = first POINTS (FTs count). Line Book rows and
   any settlement logic must respect BOOK_RULES in app/src/config.js.
6. **PlayByPlayV3 only** (V2 endpoint is dead). Jump-ball descriptions use
   bare last names ("Tip to Thompson") — parser maps playerName→team with
   an ambiguity guard.

## Conventions
- Verdicts: BET (edge ≥ 3pts of implied prob), VALUE (≥ 1pt), PASS.
  No verdict without a real book line. Fair odds shown with "model fair
  odds" chip when no line entered.
- Audit discipline: no edge claims before ~50 graded picks. Track
  "actual scorer on board" rate as the coverage diagnostic.
- Aesthetic: NBA Jam arcade. Bungee display font, Barlow Condensed data,
  flame #FF5C1A / amber #FFB524 on near-black #0D0D15. Header badge is the
  red coin asset hue-rotated to flame via CSS filter. Thin samples
  (< 3 first attempts) render dimmed with asterisk.
- Python: stdlib + pandas + nba_api only. 0.8s sleeps between NBA fetches.
  Everything cached and resumable.

## Commands
- Build today's slate:  cd data && python build_slate.py   (--league nba|wnba, --date YYYY-MM-DD)
- Grade yesterday:      cd data && python audit_slate.py
- Full daily loop:      run_daily.bat  (repo root; logs to data/task_log.txt)
- Frontend dev:         cd app && npm run dev
- Frontend build check: cd app && node node_modules/vite/bin/vite.js build

## Roadmap (v0.6+)
- LOG tab: Line Book + audit history in-app (join lines table with
  audit_log.csv; the m00nshot five-tab lineage: SLATE/LOG/MODEL/...).
- Rank→probability calibration from audit history once n≈50.
- Scratch/lineup check near tip time. Raspberry Pi as always-on runner.
