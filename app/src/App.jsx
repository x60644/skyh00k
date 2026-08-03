import { useState } from 'react'
import GameCard from './components/GameCard.jsx'
import { demoSlate } from './data/demoSlate.js'
import { APP_VERSION, DEMO_MODE, DEFAULT_LEAGUE, LEAGUES } from './config.js'

export default function App() {
  const [league, setLeague] = useState(DEFAULT_LEAGUE)
  const games = demoSlate.filter((g) => g.league === league)

  return (
    <div className="app">
      <header className="brand">
        <div className="logo">skyh<span>00</span>k</div>
        <div className="lgswitch" role="tablist" aria-label="League">
          {Object.entries(LEAGUES).map(([key, lg]) => (
            <button
              key={key}
              role="tab"
              aria-selected={league === key}
              className={'lg' + (league === key ? ' on' : '')}
              onClick={() => setLeague(key)}
            >
              {lg.label}
            </button>
          ))}
        </div>
        <div className="tagline">
          First basket board {DEMO_MODE && <em className="demo">DEMO</em>}
        </div>
      </header>
      <main className="slate">
        {games.length === 0 ? (
          <div className="empty">No games on the {LEAGUES[league].label} board.</div>
        ) : (
          games.map((g) => <GameCard key={g.id} game={g} />)
        )}
      </main>
      <footer className="appfoot">
        {APP_VERSION} · demo data — live pipeline coming with phase 1
      </footer>
    </div>
  )
}
