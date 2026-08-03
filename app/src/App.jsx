import GameCard from './components/GameCard.jsx'
import { demoSlate } from './data/demoSlate.js'
import { APP_VERSION, DEMO_MODE } from './config.js'

export default function App() {
  return (
    <div className="app">
      <header className="brand">
        <div className="logo">skyh<span>00</span>k</div>
        <div className="tagline">First basket board {DEMO_MODE && <em className="demo">DEMO</em>}</div>
      </header>
      <main className="slate">
        {demoSlate.map((g) => <GameCard key={g.id} game={g} />)}
      </main>
      <footer className="appfoot">{APP_VERSION} · demo data — live pipeline coming with phase 1</footer>
    </div>
  )
}
