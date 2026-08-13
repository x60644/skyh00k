import { useState } from 'react'
import Mug from './Mug.jsx'
import Court from './Court.jsx'
import { teamLogoUrl, TEAM_TINTS, DEFAULT_TINTS, VERDICT } from '../config.js'
import { supa } from '../lib/supa.js'

function oddsToProb(str) {
  const o = parseInt(String(str).replace('+', ''), 10)
  if (Number.isNaN(o)) return null
  return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100)
}

export function verdictFor(fair, book) {
  const fp = oddsToProb(fair), bp = oddsToProb(book)
  if (fp == null || bp == null) return null
  const edge = fp - bp
  if (edge >= VERDICT.BET) return 'BET'
  if (edge >= VERDICT.VALUE) return 'VALUE'
  return 'PASS'
}

function RosterRow({ league, p, tint }) {
  return (
    <div className={'prow' + (p.hot ? ' hot' : '')}>
      <Mug league={league} playerId={p.playerId} name={p.name} size={30} tint={tint} ring={p.hot} />
      <div className="pbody">
        <div className="pline">
          <span>{p.name}{p.pos ? <em className="pos">{p.pos}</em> : null}</span>
          <span className={'stats' + (p.thin ? ' thin' : '')}
            title={p.att != null ? `${p.att} first attempts` : undefined}>
            {p.share} · {p.fg}%{p.thin ? '*' : ''}
          </span>
        </div>
        <div className="bar"><i style={{ width: `${Math.min(p.share * 2, 100)}%` }} /></div>
      </div>
    </div>
  )
}

export default function GameCard({ game, slateDate }) {
  const [open, setOpen] = useState(false)
  const [showPlayer, setShowPlayer] = useState(true)
  const [showTeam, setShowTeam] = useState(false)
  const [showMisses, setShowMisses] = useState(false)
  const [entering, setEntering] = useState(false)
  const [oddsInput, setOddsInput] = useState('')
  const [localBook, setLocalBook] = useState(null)
  const [saveState, setSaveState] = useState('')

  const lg = game.league
  const homeTint = TEAM_TINTS[game.home.tri] || DEFAULT_TINTS.home
  const awayTint = TEAM_TINTS[game.away.tri] || DEFAULT_TINTS.away
  const pick = game.topPick
  const pickTint = pick.side === 'home' ? homeTint : awayTint
  const book = localBook || pick.bookOdds
  const verdict = book ? verdictFor(pick.fairOdds, book) : null
  const hasDetail = !!(game.shots || (game.callouts && game.callouts.length) ||
    (game.badges && game.badges.length))
  const isLiveGame = !game.id.startsWith('demo-')

  async function saveLine() {
    const clean = oddsInput.trim().startsWith('+') || oddsInput.trim().startsWith('-')
      ? oddsInput.trim() : '+' + oddsInput.trim()
    if (!/^[+-]\d{3,5}$/.test(clean)) { setSaveState('bad'); return }
    setLocalBook(clean)
    setEntering(false)
    setOddsInput('')
    if (supa && isLiveGame) {
      setSaveState('saving')
      const { error } = await supa.from('lines').insert({
        slate_date: slateDate, league: lg, game_id: game.id,
        player_id: pick.playerId, player_name: pick.name, book: 'dk', odds: clean,
      })
      setSaveState(error ? 'err' : 'ok')
    } else {
      setSaveState(supa ? '' : 'local')
    }
  }

  return (
    <div className="cardwrap" id={'g-' + game.id}>
      <div className="card">
        <div className="matchup">
          <img className="tlogo" src={teamLogoUrl(lg, game.home.teamId)} alt={game.home.name}
            onError={(e) => (e.currentTarget.style.display = 'none')} />
          <div className="team" style={{ color: homeTint }}>{game.home.tri}</div>
          <div className="at">vs</div>
          <div className="team" style={{ color: awayTint }}>{game.away.tri}</div>
          <img className="tlogo" src={teamLogoUrl(lg, game.away.teamId)} alt={game.away.name}
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
          <Mug league={lg} playerId={pick.playerId} name={pick.name} size={56} tint={pickTint} ring />
          <div className="pickbody">
            <div className="pickrow">
              <div className="pickname">
                {pick.name}{pick.pos ? <em className="pos big">{pick.pos}</em> : null}
              </div>
              <div className="pickodds">{book || pick.fairOdds}</div>
            </div>
            <div className="pickmeta">
              <span>Rank <b>#{pick.rank}</b></span>
              {book
                ? <span>Fair <b>{pick.fairOdds}</b></span>
                : <span className="modelchip">model fair odds</span>}
              <span>1st shot <b>{pick.share}%</b></span>
              {verdict &&
                <span className={'verdict ' + verdict.toLowerCase()}>{verdict}</span>}
            </div>
            {isLiveGame && (
              entering ? (
                <div className="lineentry">
                  <input value={oddsInput} inputMode="numeric"
                    placeholder="book odds e.g. +630"
                    onChange={(e) => { setOddsInput(e.target.value); setSaveState('') }}
                    onKeyDown={(e) => e.key === 'Enter' && saveLine()} autoFocus />
                  <button type="button" onClick={saveLine}>Save</button>
                  <button type="button" className="ghost"
                    onClick={() => { setEntering(false); setSaveState('') }}>✕</button>
                </div>
              ) : (
                <button type="button" className="linebtn"
                  onClick={() => setEntering(true)}>
                  {book ? 'Update book line' : '+ Enter book line'}
                </button>
              )
            )}
            {saveState === 'bad' && <div className="linemsg">Format: +630</div>}
            {saveState === 'saving' && <div className="linemsg">Saving…</div>}
            {saveState === 'ok' && <div className="linemsg ok">Saved to Line Book ✔</div>}
            {saveState === 'err' && <div className="linemsg">Save failed — shown locally only</div>}
            {saveState === 'local' && <div className="linemsg">Supabase not configured — shown locally only</div>}
          </div>
        </div>

        <div className="rosters">
          <div className="side">
            <div className="sidehead">
              <img src={teamLogoUrl(lg, game.home.teamId)} alt="" onError={(e) => e.currentTarget.remove()} />
              {game.home.name}
            </div>
            {game.rosters.home.map((p) => (
              <RosterRow key={p.playerId} league={lg} p={p} tint={homeTint} />
            ))}
          </div>
          <div className="side">
            <div className="sidehead">
              <img src={teamLogoUrl(lg, game.away.teamId)} alt="" onError={(e) => e.currentTarget.remove()} />
              {game.away.name}
            </div>
            {game.rosters.away.map((p) => (
              <RosterRow key={p.playerId} league={lg} p={p} tint={awayTint} />
            ))}
          </div>
        </div>

        <div className="legend">First-shot share · first-attempt FG% — last 10 games · * thin sample</div>

        {hasDetail && (
          <div className="foot">
            <button type="button" onClick={() => setOpen(!open)}>
              {open ? 'Collapse detail ▴' : 'Expand detail ▾'}
            </button>
          </div>
        )}
      </div>

      {open && hasDetail && (
        <div className="card detail">
          {game.shots && (
            <>
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
            </>
          )}

          {game.callouts && game.callouts.length > 0 && (
            <div className="callouts">
              <div className="chead">Model read · factor audit</div>
              {game.callouts.map((c, i) => (
                <div className="co" key={i}>
                  <span className={'tag ' + c.tag.toLowerCase()}>{c.tag}</span>
                  <div>{c.text}</div>
                </div>
              ))}
            </div>
          )}

          {game.badges && game.badges.length > 0 && (
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
          )}
        </div>
      )}
    </div>
  )
}
