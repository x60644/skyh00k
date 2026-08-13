import Mug from './Mug.jsx'
import { teamLogoUrl, TEAM_TINTS, DEFAULT_TINTS } from '../config.js'

export default function SummaryBar({ games }) {
  if (!games || games.length < 2) return null
  return (
    <nav className="sumbar" aria-label="Games at a glance">
      {games.map((g) => {
        const pick = g.topPick
        const tint = pick.side === 'home'
          ? (TEAM_TINTS[g.home.tri] || DEFAULT_TINTS.home)
          : (TEAM_TINTS[g.away.tri] || DEFAULT_TINTS.away)
        return (
          <a key={g.id} className="sumchip" href={'#g-' + g.id}>
            <span className="sumteams">
              <img src={teamLogoUrl(g.league, g.away.teamId)} alt={g.away.tri}
                onError={(e) => e.currentTarget.remove()} />
              <img src={teamLogoUrl(g.league, g.home.teamId)} alt={g.home.tri}
                onError={(e) => e.currentTarget.remove()} />
            </span>
            <Mug league={g.league} playerId={pick.playerId} name={pick.name}
              size={22} tint={tint} />
            <span className="sumname">{pick.name}</span>
            <span className="sumodds">{pick.bookOdds || pick.fairOdds}</span>
          </a>
        )
      })}
    </nav>
  )
}
