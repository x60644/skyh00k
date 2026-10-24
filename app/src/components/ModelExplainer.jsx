import { useState } from 'react'
import { teamLogoUrl, TEAM_TINTS, DEFAULT_TINTS } from '../config.js'

// MODEL tab — how the pick is computed (terms + weights, with honest status
// from the audit) plus per-matchup team profiles and collapsible L10 logs.
// Profile data comes from build_slate.py >= v0.8; older slate.json degrades
// to the formula view with a note.

const TERMS = [
  {
    k: '1 · POSSESSION',
    title: 'P(team takes the first shot)',
    math: 'tipEdge × 0.85 + (1 − tipEdge) × 0.15',
    detail: 'tipEdge = this jumper’s win rate normalized against the other jumper’s. The 0.85 is a phase-0 constant: the tip-winning team takes the game’s first shot ~85% of the time (NBA and WNBA nearly identical).',
    status: 'VALIDATED', tone: 'in',
  },
  {
    k: '2 · WHO SHOOTS',
    title: 'Player first-shot share',
    math: 'games with team’s 1st shot, last 10 ÷ 10',
    detail: 'Each team hands out exactly one first-shot credit per game, so this is 10 coin flips — very noisy. The audit (0-for-77) found displayed share has NO live signal: every share bucket scores first ~8%.',
    status: 'NO LIVE SIGNAL', tone: 'bad',
  },
  {
    k: '3 · FINISH',
    title: 'First-attempt FG%',
    math: '(makes + 0.47 × 5) ÷ (attempts + 5)',
    detail: 'Shrunk toward the 0.47 league mean with a 5-attempt prior so a 2-for-2 reads ~60%, not 100%.',
    status: 'OK', tone: 'in',
  },
  {
    k: '+ 4 · PUTBACK',
    title: 'Second-chance term',
    math: '0.5 × (season putback 1st baskets ÷ team games)',
    detail: 'Weighted so 3 season putbacks ≈ an entire 20%-share scorer’s base probability — it pulls 54% of picks away from the top-share player, toward centers, and those picks underperform even a random board player. Prime suspect in the 0-for-77.',
    status: 'ANTI-SELECTS · UNDER REVIEW', tone: 'bad',
  },
]

const IDEAS = [
  ['Team-level base rates', 'The table below: team 1st-shot %, 1st-score %, conversion. ~n games per team instead of 10 coin flips per player. Candidate replacement for the noisy L10 share.', 'NEW DATA'],
  ['Season + L10 share blend', 'EWMA-style: season share anchors, recent games tilt (the m00nshot halflife lesson).', 'PROPOSED'],
  ['Putback weight recalibration', 'Measure the real second-chance effect size before it keeps a seat (factor-audit rule).', 'PROPOSED'],
  ['Fair odds from live audit', 'Map rank → probability from audit history instead of the formula (the rankToHrProb move). Needs ~50+ graded picks per league.', 'WAITING ON N'],
  ['Positional concessions', 'Which positions score first vs this opponent — computed, shown in callouts, not yet in the number.', 'WATCH'],
  ['Confirmed starters / scratches', 'Lineup check near tip; biggest practical risk to any first-basket bet.', 'ROADMAP'],
  ['Home/away, rest, role drift', 'Phase-0 catalog tier 3 — measure before admission.', 'UNMEASURED'],
]

const fmtDate = (d) => {
  if (!d) return ''
  const [, m, day] = String(d).split('-')
  const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][Number(m) - 1] || ''
  return `${mon} ${Number(day)}`
}

function Last10({ tri, rows }) {
  const [open, setOpen] = useState(false)
  if (!rows || !rows.length) return null
  return (
    <div className="l10">
      <button type="button" className="l10btn" onClick={() => setOpen(!open)}>
        {tri} — last {rows.length} games {open ? '▴' : '▾'}
      </button>
      {open && rows.map((r, i) => (
        <div className="l10row" key={i}>
          <span className="l10date">{fmtDate(r.date)}</span>
          <span className="l10opp">vs {r.opp}</span>
          <span className={'l10chip ' + (r.tip === true ? 'yes' : r.tip === false ? 'no' : '')}>
            tip {r.tip === true ? '✓' : r.tip === false ? '✗' : '–'}
          </span>
          <span className={'l10chip ' + (r.firstShotUs ? 'yes' : 'no')}>
            1st shot {r.firstShotUs ? '✓' : '✗'}
          </span>
          <span className="l10fb">
            1st pt: <b className={r.fbUs ? 'us' : 'them'}>{r.fb || '—'}</b>
          </span>
        </div>
      ))}
    </div>
  )
}

function ProfileTable({ game, league }) {
  const sides = [['away', game.away], ['home', game.home]]
  const haveProfile = game.profile && (game.profile.home || game.profile.away)
  const pa = game.profile && game.profile.away
  const ph = game.profile && game.profile.home

  // green = edge over tonight's opponent, red = deficit (lowerBetter flips
  // the comparison for FGA→1st FG, where fewer attempts is the advantage)
  const cmp = (field, lowerBetter = false) => {
    const a = pa && pa[field], h = ph && ph[field]
    if (a == null || h == null || a === h) return { away: '', home: '' }
    const awayWins = lowerBetter ? a < h : a > h
    return awayWins ? { away: ' adv', home: ' dis' } : { away: ' dis', home: ' adv' }
  }
  const cols = {
    jumperTipPct: cmp('jumperTipPct'),
    firstShotPct: cmp('firstShotPct'),
    firstScorePct: cmp('firstScorePct'),
    firstAttFgPct: cmp('firstAttFgPct'),
    fgaToFirstFg: cmp('fgaToFirstFg', true),
  }
  const h2hCls = (p) => {
    if (!p || !p.h2h || p.h2h.w === p.h2h.l) return ''
    return p.h2h.w > p.h2h.l ? ' adv' : ' dis'
  }
  return (
    <div className="mxcard">
      <div className="mxhead">
        <img src={teamLogoUrl(league, game.away.teamId)} alt=""
          onError={(e) => e.currentTarget.remove()} />
        <span>{game.away.tri} @ {game.home.tri}</span>
        <img src={teamLogoUrl(league, game.home.teamId)} alt=""
          onError={(e) => e.currentTarget.remove()} />
        <span className="mxtime">{game.tipEt}</span>
      </div>
      {!haveProfile ? (
        <div className="mxnote">Team profiles arrive with the next pipeline run
          (build_slate v0.8+).</div>
      ) : (
        <>
          <div className="mxscroll">
            <table className="mxtable">
              <thead>
                <tr>
                  <th>TEAM</th><th>JUMPER</th><th>TIP%</th><th>H2H</th>
                  <th>1ST SHOT%</th><th>1ST SCORE%</th><th>1ST FGA FG%</th><th>FGA→1ST FG</th>
                </tr>
              </thead>
              <tbody>
                {sides.map(([side, team]) => {
                  const p = game.profile[side]
                  const tint = TEAM_TINTS[team.tri] ||
                    (side === 'home' ? DEFAULT_TINTS.home : DEFAULT_TINTS.away)
                  if (!p) return (
                    <tr key={side}><td style={{ color: tint }}>{team.tri}</td>
                      <td colSpan={7} className="dim">no completed games yet</td></tr>
                  )
                  return (
                    <tr key={side}>
                      <td style={{ color: tint, fontWeight: 700 }}>{p.tri}</td>
                      <td>{p.jumper}</td>
                      <td className={cols.jumperTipPct[side]}>{p.jumperTipPct != null
                        ? `${p.jumperTipPct}% (${p.jumperTips})` : '—'}</td>
                      <td className={h2hCls(p)}>{p.h2h ? `${p.h2h.w}-${p.h2h.l}` : '—'}</td>
                      <td className={cols.firstShotPct[side]}>{p.firstShotPct}%</td>
                      <td className={cols.firstScorePct[side]}>{p.firstScorePct}%</td>
                      <td className={cols.firstAttFgPct[side]}>{p.firstAttFgPct != null ? `${p.firstAttFgPct}%` : '—'}</td>
                      <td className={cols.fgaToFirstFg[side]}>{p.fgaToFirstFg != null ? p.fgaToFirstFg : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mxcap"><span className="capadv">green</span> = edge over
            tonight’s opponent · <span className="capdis">red</span> = deficit ·
            TIP% = jumper’s jump-ball win rate (jumps taken) ·
            H2H = this jumper vs that jumper · 1ST SHOT% = team takes the game’s first shot · 1ST SCORE% = team
            scores the game’s first point (FTs count) · FGA→1ST FG = avg attempts until first make
            (lower is better) · stats span prior + current season</div>
          {game.last10 && (
            <>
              <Last10 tri={game.away.tri} rows={game.last10.away} />
              <Last10 tri={game.home.tri} rows={game.last10.home} />
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function ModelExplainer({ league, slate }) {
  const games = slate && slate.league === league && Array.isArray(slate.games)
    ? slate.games : []
  return (
    <div className="modeltab">
      <div className="chead">The formula — P(player scores the first point) · DK “1st Points Scorer”, free throws count</div>
      <div className="termchain">
        {TERMS.map((t, i) => (
          <div className={'term' + (i === 3 ? ' plus' : '')} key={t.k}>
            <div className="termk">{t.k}</div>
            <div className="termtitle">{t.title}</div>
            <div className="termmath">{t.math}</div>
            <div className="termdetail">{t.detail}</div>
            <span className={'termstatus ' + t.tone}>{t.status}</span>
          </div>
        ))}
      </div>
      <div className="mxcap" style={{ padding: '0 4px' }}>
        Terms 1 × 2 × 3, then + term 4. Fair odds = 100 × (1/p − 1). Worked example:
        0.52 × 0.30 × 0.47 ≈ 7.3% → fair ~+1270. Audit verdict so far: 0-for-77 picks
        against a ~12% self-expectation (p ≈ 0.03% if the model were right) — terms 2
        and 4 are the suspects; no changes shipped without a measured fix.
      </div>

      <div className="chead" style={{ marginTop: 10 }}>
        Tonight’s matchup profiles{games.length ? ` — ${slate.date}` : ''}
      </div>
      {games.length === 0 ? (
        <div className="empty">No live {league.toUpperCase()} slate loaded.</div>
      ) : (
        games.map((g) => <ProfileTable key={g.id} game={g} league={league} />)
      )}

      <div className="chead" style={{ marginTop: 10 }}>What to incorporate next</div>
      <div className="ideas">
        {IDEAS.map(([name, note, tag]) => (
          <div className="idea" key={name}>
            <span className={'ideatag' + (tag === 'NEW DATA' ? ' hot' : '')}>{tag}</span>
            <div><b>{name}</b> — {note}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
