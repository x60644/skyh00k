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
  `lineups.py` pulls same-day OUT players (ESPN) + each team's last-game
  starting five (nba_api box scores) — the starters-only board (constraint #7).
- `data/cache/` — play-by-play CSVs, ~1,500 files / 110MB. NOTE: these ARE
  tracked in git (the gitignore line was lost at some point) — do NOT
  `git rm --cached` them casually: a pull of that commit would delete the
  laptop's working-tree cache and force an hours-long NBA refetch. Untrack
  only with a deliberate migration plan; growth is ~1.5MB/day in season.
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
   `run_daily.bat` (9:30 AM + 5:40 PM ET, missed-task catch-up on), plus
   `run_watch.bat` every 15 min: it polls Supabase `run_requests` for the
   app's RUN NOW button (data/check_run_requests.py, stdlib-only) and fires
   run_daily on a pending request. Creds come from gitignored
   data/supabase.env (both bats load it, which also makes build_slate's
   Line Book merge work locally).
2. **Audit before build.** `run_daily.bat` order matters: audit grades
   yesterday's archived slate before build overwrites anything. Keep it.
3. **Vercel build command** is `node node_modules/vite/bin/vite.js build`
   (not bare `vite build`) — works around a corrupted-cache permission bug.
   VERCEL_FORCE_NO_BUILD_CACHE env var may still be set; safe to remove
   once builds are consistently green.
4. **Target event = FIRST POINT (FTs count) since 2026-10-24**, matching
   DK's "1st Points Scorer" market: audit grading, team 1ST SCORE%, player
   first-point counts and second-chance all use made FG *or made FT*.
   Audit rows before 2026-10-24 were graded on first made FG. Roster
   "MAKE%" display = player's OWN first shot of the game (n ≈ games);
   the formula's fg1 term still uses team-first-attempt conversion.
   **Model = structured three-term, not ML.** P(first basket) ≈
   P(team first shot | tip) × first-shot share × first-attempt FG%
   (shrunk to league mean 0.47, prior n=5). As of v0.15 (model surgery,
   2026-11-18, backtested on 91 graded games): first-shot share is a
   0.5/0.5 blend of L10 and season-long (was L10 only); the second-chance
   /putback term is REMOVED (it anti-selected toward centers, 14.3%→9.9%
   hit with it on); the candidate pool is every current-roster player who
   shoots (own_att>0, was first_shots>0 — so stars who rarely take the
   opening shot like Tatum no longer vanish, coverage ~71%→~99% in-pool);
   and an availability guard drops anyone who missed his team's last
   RECENT_K=3 completed games (caught Markkanen, out 6 straight yet ranked
   #1). As of v0.16 (2026-11-18): the board is STARTERS-ONLY — pool +
   display restricted to each team's five from their most recent game's box
   score (data/lineups.py last_game_starters, START_POSITION=G/F/C), minus
   same-day OUT. The first point is always scored by a player on the floor
   at the tip, so this is correct, not just cosmetic; coverage of the actual
   scorer is ~76% (vs ~99% for the v0.15 wide board — the trade for a clean
   five-per-side board). Fails open to the wide pool if a box score can't be
   fetched. Phase-0 constants: tip winner shoots first ~85%, tip team scores
   first ~64-66% (NBA/WNBA nearly identical). Don't add factors without
   measuring effect size first (docs/phase0-findings.md).
5. **Book rules:** both DK ("1st Points Scorer") and FanDuel settle first
   POINTS — FTs count — and so does the model (see 4). DK still lists
   separate first-FG markets ("1st Team FG"); don't mix them. BOOK_RULES
   in app/src/config.js is the source of truth.
6. **PlayByPlayV3 only** (V2 endpoint is dead). Jump-ball descriptions use
   bare last names ("Tip to Thompson") — parser maps playerName→team with
   an ambiguity guard.
7. **Same-day availability = ESPN injuries feed** (data/lineups.py
   fetch_out_players, public site.api.espn.com, no creds/PII, stdlib urllib).
   Status Out/Doubtful → dropped from tonight's board; matched to nba_api
   personIds by (first initial, accent-folded last name). Runs only when
   building TODAY's NBA slate. Fails open (no gate) on any network/parse
   error. nba_api box scores cache under data/cache/box/box_{gid}.csv.

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

## Season rollover (active since 2026-10-20)
- NBA is the live league: DEFAULT_SEASONS nba = 2026-27, with 2025-26 as
  PRIOR_SEASONS seed — factors combine both; L10 windows roll forward as
  2026-27 games land (game IDs sort chronologically across seasons).
- Roster caches are season-keyed (roster_{league}_{season}_{team}.csv) so
  each new season refetches once and picks up trades.
- slate.json holds ONE league; run_daily.bat builds NBA nightly. WNBA audit
  lines in the bat are no-ops once its last archived slates grade; build a
  WNBA playoff slate manually with --league wnba if wanted.

## Commands
- Build today's slate:  cd data && python build_slate.py   (--league nba|wnba, --date YYYY-MM-DD)
- Grade yesterday:      cd data && python audit_slate.py
- Full daily loop:      run_daily.bat  (repo root; logs to data/task_log.txt)
- Frontend dev:         cd app && npm run dev
- Frontend build check: cd app && node node_modules/vite/bin/vite.js build

## Tabs (v0.8)
- SLATE / LOG (Line Book) / AUDIT (pick-vs-actual grades, reads audit.json)
  / MODEL (formula explainer with term weights + per-matchup team profiles
  + collapsible last-10 logs; reads slate.json `profile` and `last10`
  emitted by build_slate v0.8+). WNBA is hidden via LEAGUES.wnba.hidden in
  config.js — flip to false to bring it back; pipeline still supports it.
- Diagnostic verdict (0-for-77, data/diagnose_rank_bias.py): L10 share has
  no live signal; putback term anti-selects (54% of picks pulled off the
  top-share player, toward centers). ACTED ON in the v0.15 surgery
  (2026-11-18): putback removed, share blended season+L10, pool widened,
  injury guard added — see constraint #4. UPDATES tab logs it.

## Roadmap
- Confirmed lineups: v0.16 projects the starting five from last game's box
  score + ESPN same-day OUT. A tip-time lineup change (promotion, surprise
  start) is still missed until official lineups post ~30 min pre-tip; a
  near-tip refresh (on RUN NOW close to tip) would close the ~24% coverage gap.
- Sizing favorites: the model ranks a favorite but can't price one — a
  heavy chalk scorer who rarely takes the opening shot (Tatum, DK's #2)
  lands low. A usage/role input is the candidate fix. Measure effect size
  on the audit log before shipping (same discipline as the v0.15 surgery).
- Raspberry Pi as always-on runner.
