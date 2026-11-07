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

function RosterRow({ league, p, tint, isModel, isSelected, onSelect }) {
  return (
    <button type="button" aria-pressed={isSelected}
      className={'prow' + (p.hot ? ' hot' : '') + (isSelected ? ' sel' : '')}
      onClick={onSelect}>
      <Mug league={league} playerId={p.playerId} name={p.name} size={30} tint={tint} ring={p.hot} />
      <div className="pbody">
        <div className="pline">
          <span className="pn">
            {p.name}{p.pos ? <em className="pos">{p.pos}</em> : null}
            {isModel && <em className="modeldot" title="Model's pick">★</em>}
          </span>
          <span className={'stats' + (p.thin ? ' thin' : '')}
            title={p.att != null ? `${p.att} games with a first shot` : undefined}>
            {p.fairOdds ? <b className="rodds">{p.fairOdds}</b> : null}
            {' '}{p.share}% · {p.fg != null ? `${p.fg}%` : '—'}{p.thin ? '*' : ''}
          </span>
        </div>
        <div className="bar"><i style={{ width: `${Math.min(p.share * 2, 100)}%` }} /></div>
      </div>
    </button>
  )
}

export default function GameCard({ game, slateDate }) {
  const [open, setOpen] = useState(false)
  const [showPlayer, setShowPlayer] = useState(true)
  const [showTeam, setShowTeam] = useState(false)
  const [showMisses, setShowMisses] = useState(false)
  const [entering, setEntering] = useState(false)
  const [oddsInput, setOddsInput] = useState('')
  const [localBook, setLocalBook] = useState({})   // playerId -> entered odds (this session)
  const [saveState, setSaveState] = useState('')

  const lg = game.league
  const homeTint = TEAM_TINTS[game.home.tri] || DEFAULT_TINTS.home
  const awayTint = TEAM_TINTS[game.away.tri] || DEFAULT_TINTS.away
  const model = game.topPick

  const roster = [
    ...game.rosters.home.map((p) => ({ ...p, side: 'home' })),
    ...game.rosters.away.map((p) => ({ ...p, side: 'away' })),
  ]
  const [selId, setSelId] = useState(model.playerId)
  const isModel = selId === model.playerId
  const selP = roster.find((p) => p.playerId === selId) ||
    roster.find((p) => p.playerId === model.playerId) || roster[0]

  // Selected player's model numbers come straight from the slate (the model
  // scored everyone); fall back to the top-pick fields when it's the model's.
  const selFair = isModel ? model.fairOdds : (selP.fairOdds || null)
  const selRank = isModel ? model.rank : (selP.rank ?? null)
  const selTint = selP.side === 'home' ? homeTint : awayTint
  const book = localBook[selP.playerId] || (isModel ? model.bookOdds : null)
  const verdict = book && selFair ? verdictFor(selFair, book) : null
  const why = isModel ? model.why : null
  const hasDetail = !!(game.shots || (game.callouts && game.callouts.length) ||
    (game.badges && game.badges.length))
  const isLiveGame = !game.id.startsWith('demo-')

  async function saveLine() {
    const t = oddsInput.trim()
    const clean = t.startsWith('+') || t.startsWith('-') ? t : '+' + t
    if (!/^[+-]\d{3,5}$/.test(clean)) { setSaveState('bad'); return }
    setLocalBook((m) => ({ ...m, [selP.playerId]: clean }))
    setEntering(false)
    setOddsInput('')
    if (supa && isLiveGame) {
      setSaveState('saving')
      const { error } = await supa.from('lines').insert({
        slate_date: slateDate, league: lg, game_id: game.id,
        player_id: selP.playerId, player_name: selP.name, book: 'dk', odds: clean,
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

        <div className={'pick' + (isModel ? '' : ' userpick')}>
          <div className="picktag">{isModel ? 'Top pick' : 'Your pick'}</div>
          <Mug league={lg} playerId={selP.playerId} name={selP.name} size={56} tint={selTint} ring />
          <div className="pickbody">
            <div className="pickrow">
              <div className="pickname">
                {selP.name}{selP.pos ? <em className="pos big">{selP.pos}</em> : null}
              </div>
              <div className="pickodds">{book || selFair || '—'}</div>
            </div>
            <div className="pickmeta">
              {selRank != null && <span>Rank <b>#{selRank}</b></span>}
              {book
                ? (selFair && <span>Fair <b>{selFair}</b></span>)
                : (selFair && <span className="modelchip">model fair odds</span>)}
              <span>1st shot <b>{selP.share}%</b></span>
              {selP.fg != null && <span>make <b>{selP.fg}%</b></span>}
              {verdict &&
                <span className={'verdict ' + verdict.toLowerCase()}>{verdict}</span>}
            </div>
            {!isModel && (
              <div className="modelnote">
                Model's pick: <b>{model.name}</b> {model.fairOdds}
                <button type="button" onClick={() => setSelId(model.playerId)}>↺ back to model</button>
              </div>
            )}
            {why && <div className="whyline">{why}</div>}
            {!selFair && (
              <div className="linemsg">Per-player model odds refresh on the next slate build.</div>
            )}
            {isLiveGame && (
              entering ? (
                <div className="lineentry">
                  <input value={oddsInput} inputMode="numeric"
                    placeholder={`book odds for ${selP.name} e.g. +630`}
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

        <div className="selecthint">Tap any player below to model their first-point odds · <span className="modeldot">★</span> = model's call</div>

        <div className="rosters">
          <div className="side">
            <div className="sidehead">
              <img src={teamLogoUrl(lg, game.home.teamId)} alt="" onError={(e) => e.currentTarget.remove()} />
              {game.home.name}
            </div>
            <div className="colhead"><span>player</span><span>odds · 1st shot · make</span></div>
            {game.rosters.home.map((p) => (
              <RosterRow key={p.playerId} league={lg} p={p} tint={homeTint}
                isModel={p.playerId === model.playerId}
                isSelected={p.playerId === selId}
                onSelect={() => setSelId(p.playerId)} />
            ))}
          </div>
          <div className="side">
            <div className="sidehead">
              <img src={teamLogoUrl(lg, game.away.teamId)} alt="" onError={(e) => e.currentTarget.remove()} />
              {game.away.name}
            </div>
            <div className="colhead"><span>player</span><span>odds · 1st shot · make</span></div>
            {game.rosters.away.map((p) => (
              <RosterRow key={p.playerId} league={lg} p={p} tint={awayTint}
                isModel={p.playerId === model.playerId}
                isSelected={p.playerId === selId}
                onSelect={() => setSelId(p.playerId)} />
            ))}
          </div>
        </div>

        <div className="legend">ODDS = model fair odds · 1ST SHOT = how often they take
          the team's opening shot (last 10) · MAKE = how often their own first shot
          of a game goes in · * = small sample</div>

        {hasDetail && (
          <div className="foot">
            <button type="button" onClick={() => setOpen(!open)}>
              {open ? 'Collapse detail ▴' : 'Why this pick — shot chart, factors & badges ▾'}
            </button>
          </div>
        )}
      </div>

      {open && hasDetail && (
        <div className="card detail">
          <div className="detailintro">
            <div className="dihead">What's in here</div>
            <ul>
              {game.shots && (
                <li><b>Court</b> — every early-game shot <b>{game.shots.playerLabel}</b> took
                  before their team's first make, and whether it fell. Toggle the player,
                  their team's last-10, or show misses.</li>
              )}
              {game.callouts && game.callouts.length > 0 && (
                <li><b>Model read</b> — the factors behind the call.{' '}
                  <span className="tag in">IN</span> helps the pick,{' '}
                  <span className="tag watch">WATCH</span> is a caution.</li>
              )}
              {game.badges && game.badges.length > 0 && (
                <li><b>Badges</b> — notable streaks or flags on these players.</li>
              )}
            </ul>
          </div>

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
              <div className="courtcap">Each dot is one early shot ·{' '}
                <span className="mk">●</span> made · ○ missed · the court is the model's pick, {game.shots.playerLabel}</div>
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
