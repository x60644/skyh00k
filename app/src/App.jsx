import { useEffect, useState } from 'react'
import GameCard from './components/GameCard.jsx'
import SummaryBar from './components/SummaryBar.jsx'
import LogTab from './components/LogTab.jsx'
import ModelTab from './components/ModelTab.jsx'
import { demoSlate } from './data/demoSlate.js'
import { APP_VERSION, DEFAULT_LEAGUE, LEAGUES } from './config.js'
import { supa } from './lib/supa.js'

export default function App() {
  const [league, setLeague] = useState(DEFAULT_LEAGUE)
  const [tab, setTab] = useState('slate')
  const [wordmarkOk, setWordmarkOk] = useState(true)
  const [live, setLive] = useState(null)
  const [lines, setLines] = useState([])

  useEffect(() => {
    fetch('/slate.json')
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        if (data && Array.isArray(data.games)) {
          setLive(data)
          if (supa) {
            const { data: rows } = await supa.from('lines').select('*')
              .eq('slate_date', data.date).order('created_at')
            if (rows) setLines(rows)
          }
        }
      })
      .catch(() => {})
  }, [])

  const merge = (g) => {
    const mine = lines.filter((l) => String(l.game_id) === String(g.id) &&
      Number(l.player_id) === Number(g.topPick.playerId))
    if (!mine.length || g.topPick.bookOdds) return g
    const latest = mine[mine.length - 1]
    return { ...g, topPick: { ...g.topPick, bookOdds: latest.odds } }
  }

  const liveGames = live && live.games.filter((g) => g.league === league).map(merge)
  const isLive = !!(liveGames && liveGames.length > 0)
  const games = isLive ? liveGames : demoSlate.filter((g) => g.league === league)

  return (
    <div className="app">
      <header className="brand">
        <div className="logohead">
          <img className="applogo" src="/brand/badge.png" alt=""
            onError={(e) => e.currentTarget.remove()} />
          {wordmarkOk
            ? <img className="wordmark" src="/brand/wordmark-white.png" alt="skyh00k"
                onError={() => setWordmarkOk(false)} />
            : <div className="logo">skyh<span>00</span>k</div>}
        </div>
        <div className="lgswitch" role="tablist" aria-label="League">
          {Object.entries(LEAGUES).map(([key, lg]) => (
            <button key={key} role="tab" aria-selected={league === key}
              className={'lg' + (league === key ? ' on' : '')}
              onClick={() => setLeague(key)}>
              {lg.label}
            </button>
          ))}
        </div>
        <div className="tagline">
          First basket board{' '}
          {isLive
            ? <em className={'livechip' + (live.date !== new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) ? ' stale' : '')}>{live.date}</em>
            : <em className="demo">DEMO</em>}
        </div>
      </header>
      <nav className="tabs" role="tablist" aria-label="View">
        {[['slate', 'SLATE'], ['log', 'LOG'], ['model', 'MODEL']].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key}
            className={'tab' + (tab === key ? ' on' : '')}
            onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'slate' && (
        <>
          {isLive && <SummaryBar games={games} />}
          <main className="slate">
            {games.length === 0 ? (
              <div className="empty">No games on the {LEAGUES[league].label} board.</div>
            ) : (
              games.map((g) => (
                <GameCard key={g.id} game={g} slateDate={isLive ? live.date : null} />
              ))
            )}
          </main>
        </>
      )}
      {tab === 'log' && <LogTab league={league} />}
      {tab === 'model' && <ModelTab league={league} />}
      <footer className="appfoot">
        {APP_VERSION}{isLive ? ` · live slate generated ${live.generated.slice(0, 16)}Z` : ' · demo data'}
      </footer>
    </div>
  )
}
