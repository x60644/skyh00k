import { useEffect, useState } from 'react'
import Mug from './Mug.jsx'
import { DEFAULT_TINTS } from '../config.js'
import { supa } from '../lib/supa.js'

// American odds -> profit in units for a 1u stake that wins.
function profitUnits(odds) {
  const o = parseInt(String(odds).replace('+', ''), 10)
  if (Number.isNaN(o)) return 0
  return o > 0 ? o / 100 : 100 / Math.abs(o)
}

const fmtU = (u) => (u >= 0 ? '+' : '') + u.toFixed(2) + 'u'
const fmtDate = (d) => {
  const [y, m, day] = d.split('-')
  const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][Number(m) - 1] || ''
  return `${mon} ${Number(day)}`
}

const FILTERS = [['all', 'ALL'], ['hit', 'WON'], ['miss', 'LOST'], ['pend', 'PENDING']]

export default function LogTab({ league }) {
  const [audit, setAudit] = useState(null)
  const [lines, setLines] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const a = await fetch('/audit.json')
        .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      let rows = []
      if (supa) {
        const { data } = await supa.from('lines').select('*').order('created_at')
        if (data) rows = data
      }
      if (alive) { setAudit(a); setLines(rows); setLoaded(true) }
    })()
    return () => { alive = false }
  }, [])

  const games = (audit && audit.games) || {}

  // Dedup to the latest line per game+player (saveLine inserts, never upserts),
  // matching App.merge()'s "latest wins". Rows arrive ordered by created_at asc.
  const latest = new Map()
  for (const l of lines) {
    if (l.league !== league) continue
    latest.set(String(l.game_id) + ':' + Number(l.player_id), l)
  }

  const bets = [...latest.values()].map((l) => {
    const g = games[String(l.game_id)]
    let result = 'pend', pnl = 0
    if (g) {
      const hit = Number(g.actualPlayerId) === Number(l.player_id)
      result = hit ? 'hit' : 'miss'
      pnl = hit ? profitUnits(l.odds) : -1
    }
    return { ...l, g, result, pnl }
  }).sort((a, b) =>
    b.slate_date.localeCompare(a.slate_date) ||
    String(b.created_at || '').localeCompare(String(a.created_at || '')))

  // Aggregates over settled bets (1u flat stake each).
  const settled = bets.filter((b) => b.result !== 'pend')
  const wins = settled.filter((b) => b.result === 'hit').length
  const losses = settled.length - wins
  const pnl = settled.reduce((s, b) => s + b.pnl, 0)
  const roi = settled.length ? (pnl / settled.length) * 100 : 0
  const winPct = settled.length ? (wins / settled.length) * 100 : 0

  // Current streak from most-recent settled bet backward.
  let streak = 0, streakType = null
  for (const b of settled) {
    if (streakType === null) { streakType = b.result; streak = 1 }
    else if (b.result === streakType) streak++
    else break
  }

  const shown = filter === 'all' ? bets : bets.filter((b) => b.result === filter)

  // Group shown bets by slate date, preserving newest-first order.
  const groups = []
  for (const b of shown) {
    let g = groups[groups.length - 1]
    if (!g || g.date !== b.slate_date) { g = { date: b.slate_date, items: [] }; groups.push(g) }
    g.items.push(b)
  }

  if (!loaded) return <div className="empty">Loading Line Book…</div>

  if (bets.length === 0) {
    return (
      <div className="empty">
        No bets logged yet.<br />
        Enter a book line on the <b>SLATE</b> to start your Line Book.
        {!supa && <div className="logsub" style={{ marginTop: 12 }}>Supabase not configured — Line Book is read from the server.</div>}
      </div>
    )
  }

  return (
    <div className="logtab">
      <div className="logstats">
        <div className="lstat">
          <div className="k">Bets</div>
          <div className="v">{bets.length}</div>
        </div>
        <div className="lstat">
          <div className="k">Record</div>
          <div className="v">{wins}–{losses}</div>
          <div className="sub">{settled.length ? `${winPct.toFixed(1)}%` : '—'}</div>
        </div>
        <div className="lstat">
          <div className="k">P&amp;L</div>
          <div className={'v ' + (pnl >= 0 ? 'pos' : 'neg')}>{settled.length ? fmtU(pnl) : '—'}</div>
        </div>
      </div>

      <div className="logsub">
        ROI <b className={roi >= 0 ? 'pos' : 'neg'}>{settled.length ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : '—'}</b>
        {' · '}<b>{settled.length}u</b> risked
        {streakType && <>{' · '}streak <b className={streakType === 'hit' ? 'pos' : 'neg'}>{streakType === 'hit' ? 'W' : 'L'}{streak}</b></>}
      </div>

      <div className="logfilters">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={'tg' + (filter === k ? ' on' : '')}
            onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty">No {filter === 'pend' ? 'pending' : filter === 'hit' ? 'won' : 'lost'} bets.</div>
      ) : groups.map((grp) => (
        <div className="daygroup" key={grp.date}>
          <div className="dayhead">{fmtDate(grp.date)}</div>
          {grp.items.map((b) => (
            <div className={'betrow ' + b.result} key={b.id ?? (b.game_id + ':' + b.player_id)}>
              <Mug league={b.league} playerId={b.player_id} name={b.player_name || '?'}
                size={40} tint={DEFAULT_TINTS.home} ring={b.result === 'hit'} />
              <div className="betbody">
                <div className="betname">{b.player_name || '—'}</div>
                <div className="betmeta">
                  {b.g ? b.g.matchup : b.game_id}
                  {b.book ? ` · ${b.book.toUpperCase()}` : ''}
                </div>
              </div>
              <div className="betright">
                <div className="betodds">{b.odds}</div>
                <div className={'rslt ' + b.result}>
                  {b.result === 'pend' ? 'PEND'
                    : b.result === 'hit' ? `HIT ${fmtU(b.pnl)}`
                      : `MISS ${fmtU(b.pnl)}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="logfoot">
        Settled first-FG (DraftKings rule){audit && audit.generated ? ` · results as of ${audit.generated.slice(0, 10)}` : ''}
      </div>
    </div>
  )
}
