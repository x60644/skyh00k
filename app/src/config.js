// skyh00k config — edit from phone via GitHub web UI, Vercel auto-deploys.

export const APP_VERSION = 'v0.2.0'
export const DEMO_MODE = true

// League registry — WNBA is the live beta track; NBA tips late October.
export const LEAGUES = {
  nba: {
    label: 'NBA',
    headshot: (id) => `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`,
    logo: (teamId) => `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`,
  },
  wnba: {
    label: 'WNBA',
    headshot: (id) => `https://cdn.wnba.com/headshots/wnba/latest/260x190/${id}.png`,
    logo: (teamId) => `https://cdn.wnba.com/logos/wnba/${teamId}/primary/L/logo.svg`,
  },
}
export const DEFAULT_LEAGUE = 'wnba' // in-season league leads

export const headshotUrl = (league, playerId) => LEAGUES[league].headshot(playerId)
export const teamLogoUrl = (league, teamId) => LEAGUES[league].logo(teamId)

// Duotone tint per team tricode
export const TEAM_TINTS = {
  // NBA
  LAL: '#8B7FF0', LAC: '#38C99C', BOS: '#4FC97F', NYK: '#F08A4B',
  // WNBA
  LVA: '#B8B8C4', NYL: '#5FD4B8', IND: '#F5C242', MIN: '#7FB8E8',
}
export const DEFAULT_TINTS = { home: '#8B7FF0', away: '#38C99C' }

// Verdict thresholds (edge = fair prob − implied book prob)
export const VERDICT = { BET: 0.03, VALUE: 0.01 }

// Market rules by book — DK settles first FIELD GOAL (FTs don't count);
// FD settles first POINTS (FTs count). Model's base output is first FG.
export const BOOK_RULES = {
  draftkings: { market: 'first_fg', ftCounts: false },
  fanduel: { market: 'first_points', ftCounts: true },
}
