// skyh00k config — edit from phone via GitHub web UI, Vercel auto-deploys.

export const APP_VERSION = 'v0.1.0'

// Demo mode: cards render from src/data/demoSlate.js.
// Flips to live data when the phase-1 pipeline lands.
export const DEMO_MODE = true

// NBA CDN endpoints (headshots + logos, hotlinked; gritty filter applied in CSS)
export const headshotUrl = (playerId) =>
  `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`
export const teamLogoUrl = (teamId) =>
  `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`

// Duotone tint per team tricode (home/away accent fallback if missing)
export const TEAM_TINTS = {
  LAL: '#8B7FF0', LAC: '#38C99C', BOS: '#4FC97F', NYK: '#F08A4B',
}
export const DEFAULT_TINTS = { home: '#8B7FF0', away: '#38C99C' }

// Verdict thresholds (edge = fair prob − implied book prob), m00nshot-style slider
export const VERDICT = {
  BET: 0.03,     // fair prob beats implied by 3+ points
  VALUE: 0.01,   // 1–3 points
  // below VALUE -> PASS
}
