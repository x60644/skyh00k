// Model change log — the running story of how the first-point model is being
// refined against live audit results. NEWEST FIRST. Add an entry whenever the
// formula, its inputs, or the target market changes; keep `result` honest
// (what the graded picks actually showed). Edit from the phone via the GitHub
// web UI — Vercel auto-deploys.
//
// tag ∈ FIX | DATA | MARKET | CALIBRATION | DIAGNOSTIC | PENDING
// date: 'YYYY-MM-DD', or 'next' for not-yet-shipped work.
export const MODEL_UPDATES = [
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
    title: 'Model surgery (awaiting sign-off)',
    detail: 'On deck once approved: demote or reweight the putback term, blend ' +
      'season-long and last-10 first-shot share, and switch to ' +
      'audit-calibrated fair odds once ~50 graded picks per league are in. No ' +
      'edge claims before that sample.',
  },
]
