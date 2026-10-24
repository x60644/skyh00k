// skyh00k config — edit from phone via GitHub web UI, Vercel auto-deploys.

export const APP_VERSION = 'v0.9.0'
export const DEMO_MODE = true

// League registry — NBA is the live lead (2026-27 tipped off Oct 20);
// WNBA was the beta track and stays audited until its last slates grade.
export const LEAGUES = {
  nba: {
    label: 'NBA',
    headshot: (id) => `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`,
    logo: (teamId) => `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`,
  },
  wnba: {
    label: 'WNBA',
    hidden: true,   // NBA season focus — flip to false to bring WNBA back
    headshot: (id) => `https://cdn.wnba.com/headshots/wnba/latest/260x190/${id}.png`,
    logo: (teamId) => `https://cdn.wnba.com/logos/wnba/${teamId}/primary/L/logo.svg`,
  },
}
export const DEFAULT_LEAGUE = 'nba' // in-season league leads

export const headshotUrl = (league, playerId) => LEAGUES[league].headshot(playerId)
export const teamLogoUrl = (league, teamId) => LEAGUES[league].logo(teamId)

// Duotone tint per team tricode (teams without an entry fall back to
// DEFAULT_TINTS purple/teal — add more here anytime from the phone)
export const TEAM_TINTS = {
  // NBA
  LAL: '#8B7FF0', LAC: '#38C99C', BOS: '#4FC97F', NYK: '#F08A4B',
  PHI: '#4D6FE8', GSW: '#4FA3F0', MIL: '#3FA87A', DEN: '#FFC24F',
  CHI: '#E04B4B', MIA: '#F05A7E', DAL: '#4D8FE8', HOU: '#F0655E',
  OKC: '#5BB4F0', CLE: '#B04A68', SAS: '#C9C9D4', MEM: '#5D9BD3',
  // WNBA
  LVA: '#E03A3E', NYL: '#5FD4B8', IND: '#F5C242', MIN: '#7FB8E8',
}
export const DEFAULT_TINTS = { home: '#8B7FF0', away: '#38C99C' }

// Verdict thresholds (edge = fair prob − implied book prob)
export const VERDICT = { BET: 0.03, VALUE: 0.01 }

// Market rules — aligned 2026-10-24: the model + audit now target FIRST
// POINT (FTs count), matching DK's "1st Points Scorer" board (DK also still
// lists separate first-FG markets under "1st Team FG").
export const BOOK_RULES = {
  draftkings: { market: 'first_points', ftCounts: true },
  fanduel: { market: 'first_points', ftCounts: true },
}
