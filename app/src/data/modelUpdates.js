// Model change log — the running story of how the first-point model is being
// refined against live audit results. NEWEST FIRST. Add an entry whenever the
// formula, its inputs, or the target market changes; keep `result` honest
// (what the graded picks actually showed). Edit from the phone via the GitHub
// web UI — Vercel auto-deploys.
//
// tag ∈ LINEUP | SURGERY | FIX | DATA | MARKET | CALIBRATION | DIAGNOSTIC | PENDING
// date: 'YYYY-MM-DD', or 'next' for not-yet-shipped work.
export const MODEL_UPDATES = [
  {
    date: '2026-11-18', tag: 'LINEUP', version: 'v0.16.0',
    title: 'Starters-only board + same-day scratch coverage',
    detail: 'The board now shows only each team’s starting five, projected from ' +
      'their most recent game’s box score (START_POSITION). The first point is ' +
      'always scored by someone on the floor at the opening tip, so bench names ' +
      'no longer clutter the board, and a star who starts but rarely takes the ' +
      'literal opening shot now appears among the five instead of buried at #14. ' +
      'On top of that, a same-day OUT/Doubtful feed (ESPN injuries) drops anyone ' +
      'ruled out tonight even if they played last game — the gap the multi-game ' +
      'injury guard couldn’t cover. Austin Reaves (Out) and Kingston Flemings ' +
      '(Out, the old ATL #1 pick) are now off the board.',
    result: 'The trade-off: the tighter starters-only board shows the actual ' +
      'first scorer ~76% of games (the wider v0.15 board reached ~99% but buried ' +
      'the pick among bench players). The win is a clean five-per-side board with ' +
      'OUT players gone. When a projected starter is ruled out, that side shows ' +
      'four until tip-time lineups confirm the replacement.',
  },
  {
    date: '2026-11-18', tag: 'SURGERY', version: 'v0.15.0',
    title: 'Model surgery: wider board, injury guard, putback dropped',
    detail: 'Three changes, each backtested on 91 graded games. (1) The ' +
      'candidate pool widened from “took a game’s literal opening shot” to ' +
      '“any current-roster player who shoots”, so a star who scores early but ' +
      'rarely takes the tip-off possession (Tatum) no longer vanishes — ' +
      'actual-scorer coverage rose from ~71% to ~99% in-pool. (2) First-shot ' +
      'share now blends last-10 with season-long: L10 is sharp at the top, ' +
      'season steadies the tail. (3) The second-chance/putback term was removed ' +
      '— it anti-selected toward centers and dragged top-pick hit rate ' +
      '(14.3% → 9.9% with it on). Added an availability guard: a player who has ' +
      'missed his team’s last three games is treated as OUT.',
    result: 'Both of today’s flagged bugs are gone. Lauri Markkanen — ranked #1 ' +
      'while injured six straight games — is dropped, and both #1 picks now ' +
      'match the DK favorite (Dončić, Murray). Hit-rate change is within ' +
      'small-sample noise; the solid wins are board coverage and no longer ' +
      'leading with players who aren’t active.',
  },
  {
    date: '2026-11-17', tag: 'CALIBRATION', version: 'v0.14.0',
    title: 'Audit-calibrated fair odds',
    detail: 'Fair odds are no longer read straight off the raw formula, which ' +
      'under-summed per game and ran far too long — a clear favorite priced ' +
      '+1200 when the book had +450. Each player’s board rank is now ' +
      'mapped to how often the actual first scorer has historically landed at ' +
      'that rank (86 graded games since the roster fix), smoothed to a ' +
      'monotone curve. Ranking is unchanged; the modeled board now sums to the ' +
      '~73% empirical on-board coverage, with the rest as the off-board field.',
    result: 'Top-pick fair odds now land near the DK line (Garland +473 vs DK ' +
      '+464). Recomputed nightly as more picks grade. Still flat on favorite ' +
      'strength — the model can rank a favorite but not yet size one.',
  },
  {
    date: '2026-11-13', tag: 'FIX', version: 'v0.13.0',
    title: 'Model stops picking OUT players',
    detail: 'The availability guard moved from the card display into the ' +
      'pipeline. When a dated DK first-points snapshot exists for a game, ' +
      'rostered players absent from the board are treated as scratched and ' +
      'dropped from the ranking — so the top pick is never an inactive player.',
    result: 'Prompted by the Jarrett Allen miss (NYK @ CLE, Nov 7): the model ' +
      'ranked an OUT player #1, a guaranteed loss.',
  },
  {
    date: '2026-11-06', tag: 'DATA',
    title: 'Current-roster filter',
    detail: 'Players are now matched against each team’s live roster, so ' +
      'traded names (Ayton, Grant) no longer linger on their old team from ' +
      'stale play-by-play history. Fails open if a roster can’t be fetched.',
    result: 'Audit tracking reset to this date — earlier boards graded picks ' +
      'off stale rosters and would unfairly drag the numbers.',
  },
  {
    date: '2026-10-24', tag: 'MARKET',
    title: 'Target switched to FIRST POINT (free throws count)',
    detail: 'Model, audit grading, and all team/player factors realigned to ' +
      'first POINT — made field goal OR made free throw — to match DK’s ' +
      '“1st Points Scorer” board and FanDuel settlement. DK’s ' +
      'separate first-FG markets are kept distinct, never mixed in.',
  },
  {
    date: '2026-10-20', tag: 'DIAGNOSTIC',
    title: 'Rank-bias diagnostic: 0-for-77',
    detail: 'A full audit of early picks found the last-10 first-shot share ' +
      'carries no live signal, and the second-chance (putback) term ' +
      'anti-selects — it pulled 54% of picks off the top-share player toward ' +
      'centers. Team-level profile stats are the candidate replacement inputs.',
    result: 'The case for the pending model surgery below. Formula left frozen ' +
      'until the change is signed off.',
  },
  {
    date: '2026-10-20', tag: 'CALIBRATION',
    title: 'Phase-0 constants locked',
    detail: 'Baseline rates measured and frozen as the formula’s priors: ' +
      'the tip winner shoots first ~85% of the time, the tip-winning team ' +
      'scores the game’s first point ~64–66% (NBA and WNBA nearly ' +
      'identical), and first-attempt FG% is shrunk to the league mean 0.47 ' +
      '(prior n=5). No factor is added without measuring its effect size first.',
  },
  {
    date: 'next', tag: 'PENDING',
    title: 'Confirmed lineups + sizing favorites',
    detail: 'Two gaps left. Projected vs confirmed starters: the five come from ' +
      'last game’s box score, so a tip-time lineup change (a promotion, a ' +
      'surprise start) is missed until official lineups post ~30 min before ' +
      'tip — a near-tip refresh would close it. And sizing: the model ranks a ' +
      'favorite but still can’t price one — a heavy chalk scorer who rarely ' +
      'takes the opening shot (Tatum) lands low among the five. A usage/role ' +
      'input is the candidate fix.',
  },
]
