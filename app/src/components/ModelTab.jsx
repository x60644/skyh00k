import { useEffect, useState } from 'react'
import Mug from './Mug.jsx'
import { DEFAULT_TINTS } from '../config.js'

const fmtDate = (d) => {
  const [, m, day] = d.split('-')
  const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][Number(m) - 1] || ''
  return `${mon} ${Number(day)}`
}

// How the model's board did vs. reality — every graded game, whether or not
// a bet was logged. Reads the same audit.json the LOG tab settles against.
export default function ModelTab({ league }) {
  const [audit, setAudit] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/audit.json')
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((a) => { if (alive) { setAudit(a); setLoaded(true) } })
    return () => { alive = false }
  }, [])

  const games = audit && audit.games
    ? Object.entries(audit.games).map(([id, g]) => ({ id, ...g }))
      .filter((g) => g.league === league)
      .sort((a, b) => b.date.localeCompare(a.date) || a.matchup.localeCompare(b.matchup))
    : []

  if (!loaded) return <div className="empty">Loading model log…</div>
  if (!games.length) return <div className="empty">No graded games yet for {league.toUpperCase()}.</div>

  const n = games.length
  const hits = games.filter((g) => g.pickHit).length
  const onBoard = games.filter((g) => g.actualBoardRank != null).length
  const hitPct = (hits / n) * 100
  const boardPct = (onBoard / n) * 100

  const groups = []
  for (const g of games) {
    let grp = groups[groups.length - 1]
    if (!grp || grp.date !== g.date) { grp = { date: g.date, items: [] }; groups.push(grp) }
    grp.items.push(g)
  }

  return (
    <div className="logtab">
      <div className="logstats">
        <div className="lstat">
          <div className="k">Graded</div>
          <div className="v">{n}</div>
        </div>
        <div className="lstat">
          <div className="k">Top pick</div>
          <div className="v">{hits}/{n}</div>
          <div className="sub">{hitPct.toFixed(1)}%</div>
        </div>
        <div className="lstat">
          <div className="k">On board</div>
          <div className="v pos">{onBoard}/{n}</div>
          <div className="sub">{boardPct.toFixed(1)}%</div>
        </div>
      </div>

      <div className="logsub">
        {n < 50
          ? <>Coverage is the read at this sample — <b>judge nothing before ~50 graded picks</b>.</>
          : <>Top pick lands <b className="pos">{hitPct.toFixed(1)}%</b>; actual scorer on board <b className="pos">{boardPct.toFixed(1)}%</b>.</>}
      </div>

      {groups.map((grp) => (
        <div className="daygroup" key={grp.date}>
          <div className="dayhead">{fmtDate(grp.date)}</div>
          {grp.items.map((g) => (
            <div className={'mrow ' + (g.pickHit ? 'hit' : 'miss')} key={g.id}>
              <div className="mtop">
                <span className="mmatch">{g.matchup}</span>
                <span className={'rslt ' + (g.pickHit ? 'hit' : 'miss')}>
                  {g.pickHit ? 'HIT' : 'MISS'}
                </span>
              </div>
              <div className="mvs">
                <div className="mside">
                  <div className="mlabel">Model pick</div>
                  <div className="mplayer">
                    <Mug league={g.league} playerId={g.pickPlayerId} name={g.pickName}
                      size={30} tint={DEFAULT_TINTS.home} ring={g.pickHit} />
                    <span>{g.pickName}</span>
                  </div>
                </div>
                <div className="marrow">→</div>
                <div className="mside">
                  <div className="mlabel">Actual 1st</div>
                  <div className="mplayer">
                    <Mug league={g.league} playerId={g.actualPlayerId} name={g.actualName}
                      size={30} tint={DEFAULT_TINTS.away} />
                    <span>{g.actualName}<em className="mteam">{g.actualTeam}</em></span>
                  </div>
                </div>
              </div>
              <div className="mrank">
                {g.actualBoardRank != null
                  ? <>scorer was board rank <b>#{g.actualBoardRank}</b></>
                  : 'scorer was off our board'}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="logfoot">
        Model top pick vs. actual first field goal · {audit && audit.generated ? `as of ${audit.generated.slice(0, 10)}` : ''}
      </div>
    </div>
  )
}
