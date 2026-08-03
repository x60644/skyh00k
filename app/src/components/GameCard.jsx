import { useState } from 'react'
import Mug from './Mug.jsx'
import Court from './Court.jsx'
import { teamLogoUrl, TEAM_TINTS, DEFAULT_TINTS } from '../config.js'

function RosterRow({ p, tint }) {
  return (
    <div className={'prow' + (p.hot ? ' hot' : '')}>
      <Mug playerId={p.playerId} name={p.name} size={30} tint={tint} ring={p.hot} />
      <div className="pbody">
        <div className="pline">
          <span>{p.name}</span>
          <span className="stats">{p.share} · {p.fg}%</span>
        </div>
        <div className="bar"><i style={{ width: `${p.share * 2}%` }} /></div>
      </div>
    </div>
  )
}

export default function GameCard({ game }) {
  const [open, setOpen] = useState(false)
  const [showPlayer, setShowPlayer] = useState(true)
  const [showTeam, setShowTeam] = useState(false)
  const [showMisses, setShowMisses] = useState(false)

  const homeTint = TEAM_TINTS[game.home.tri] || DEFAULT_TINTS.home
  const awayTint = TEAM_TINTS[game.away.tri] || DEFAULT_TINTS.away
  const pick = game.topPick
  const pickTint = pick.side === 'home' ? homeTint : awayTint

  return (
    <div className="cardwrap">
      <div className="card">
        <div className="matchup">
          <img className="tlogo" src={teamLogoUrl(game.home.teamId)} alt={game.home.name}
            onError={(e) => (e.currentTarget.style.display = 'none')} />
          <div className="team" style={{ color: homeTint }}>{game.home.tri}</div>
          <div className="at">vs</div>
          <div className="team" style={{ color: awayTint }}>{game.away.tri}</div>
          <img className="tlogo" src={teamLogoUrl(game.away.teamId)} alt={game.away.name}
            onError={(e) => (e.currentTarget.style.display = 'none')} />
          <div className="tiptime">{game.tipEt}</div>
        </div>

        <div className="tipmeter">
          <div className="tiplabels">
            <span style={{ color: homeTint }}>{game.tip.homePlayer} {game.tip.homeWinPct}%</span>
            <span style={{ color: awayTint }}>{game.tip.awayPlayer} {100 - game.tip.homeWinPct}%</span>
          </div>
          <div className="meter">
            <div style={{ width: `${game.tip.homeWinPct}%`, background: homeTint }} />
            <div style={{ width: `${100 - game.tip.homeWinPct}%`, background: awayTint }} />
          </div>
          <div className="tipcap">Jump ball</div>
        </div>

        <div className="pick">
          <div className="picktag">Top pick</div>
          <Mug playerId={pick.playerId} name={pick.name} size={56} tint={pickTint} ring />
          <div className="pickbody">
            <div className="pickrow">
              <div className="pickname">{pick.name}</div>
              <div className="pickodds">{pick.bookOdds}</div>
            </div>
            <div className="pickmeta">
              <span>Rank <b>#{pick.rank}</b></span>
              <span>Fair <b>{pick.fairOdds}</b></span>
              <span>1st shot <b>{pick.share}%</b></span>
              <span className={'verdict ' + pick.verdict.toLowerCase()}>{pick.verdict}</span>
            </div>
          </div>
        </div>

        <div className="rosters">
          <div className="side">
            <div className="sidehead">
              <img src={teamLogoUrl(game.home.teamId)} alt="" onError={(e) => e.currentTarget.remove()} />
              {game.home.name}
            </div>
            {game.rosters.home.map((p) => <RosterRow key={p.playerId} p={p} tint={homeTint} />)}
          </div>
          <div className="side">
            <div className="sidehead">
              <img src={teamLogoUrl(game.away.teamId)} alt="" onError={(e) => e.currentTarget.remove()} />
              {game.away.name}
            </div>
            {game.rosters.away.map((p) => <RosterRow key={p.playerId} p={p} tint={awayTint} />)}
          </div>
        </div>

        <div className="legend">First-shot share · first-attempt FG% — last 10 starts</div>

        <div className="foot">
          <button type="button" onClick={() => setOpen(!open)}>
            {open ? 'Collapse detail ▴' : 'Expand detail ▾'}
          </button>
        </div>
      </div>

      {open && (
        <div className="card detail">
          <div className="dhead">Court · <b>{game.shots.playerLabel}</b> — shots until first make</div>
          <div className="toggles">
            <button className={'tg' + (showPlayer ? ' on' : '')} onClick={() => setShowPlayer(!showPlayer)}>
              {game.shots.playerLabel}
            </button>
            <button className={'tg' + (showTeam ? ' on' : '')} onClick={() => setShowTeam(!showTeam)}>
              Team L10
            </button>
            <button className={'tg' + (showMisses ? ' on' : '')} onClick={() => setShowMisses(!showMisses)}>
              Show misses
            </button>
          </div>
          <div className="courtwrap">
            <Court shots={game.shots} showPlayer={showPlayer} showTeam={showTeam} showMisses={showMisses} />
          </div>
          <div className="courtcap"><span className="mk">●</span> make · ○ miss · attempts before team's first make</div>

          <div className="callouts">
            <div className="chead">Model read · factor audit</div>
            {game.callouts.map((c, i) => (
              <div className="co" key={i}>
                <span className={'tag ' + c.tag.toLowerCase()}>{c.tag}</span>
                <div>{c.text}</div>
              </div>
            ))}
          </div>

          <div className="badgesec">
            {game.badges.map((b) => (
              <div key={b.player}>
                <div className="chead">Badges — {b.player}</div>
                <div className="brow">
                  {b.items.map((it) => (
                    <div key={it.label} className={'bdg ' + it.tier}>
                      <span>{it.icon}</span>{it.label} <small>{it.note}</small>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
