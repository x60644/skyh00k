import { headshotUrl } from '../config.js'

export default function Mug({ league, playerId, name, size = 30, tint, ring = false }) {
  const initials = name.split(/\s|-/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className={'mug' + (ring ? ' ring' : '')}
      style={{ width: size, height: size, '--tint': tint }}
    >
      <div className="fb">{initials}</div>
      <img src={headshotUrl(league, playerId)} alt="" loading="lazy"
        onError={(e) => e.currentTarget.remove()} />
      <div className="tintlayer" />
      <div className="dots" />
    </div>
  )
}
