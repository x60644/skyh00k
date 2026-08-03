export default function Court({ shots, showPlayer, showTeam, showMisses }) {
  const Dot = ([x, y], i, cls) => (
    <circle key={cls + i} className={'dot ' + cls} cx={x} cy={y} r="7" />
  )
  return (
    <svg className="half" viewBox="0 0 500 470" role="img" aria-label="Half-court shot chart">
      <line className="courtline" x1="0" y1="468" x2="500" y2="468" />
      <rect className="courtline" x="170" y="278" width="160" height="190" />
      <circle className="courtline" cx="250" cy="278" r="60" />
      <circle className="courtline" cx="250" cy="416" r="7.5" />
      <line className="courtline" x1="220" y1="428" x2="280" y2="428" />
      <line className="courtline" x1="30" y1="468" x2="30" y2="328" />
      <line className="courtline" x1="470" y1="468" x2="470" y2="328" />
      <path className="courtline" d="M 30 328 A 237.5 237.5 0 0 1 470 328" />
      {showPlayer && shots.player.makes.map((p, i) => Dot(p, i, 'make'))}
      {showPlayer && showMisses && shots.player.misses.map((p, i) => Dot(p, i, 'miss'))}
      {showTeam && shots.team.makes.map((p, i) => Dot(p, i, 'make team'))}
      {showTeam && showMisses && shots.team.misses.map((p, i) => Dot(p, i, 'miss team'))}
    </svg>
  )
}
