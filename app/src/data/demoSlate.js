// Placeholder slate — same shape the live pipeline will emit.
// Each game carries a league key; the header toggle filters on it.

export const demoSlate = [
  // ---------- WNBA (live beta track) ----------
  {
    id: 'demo-lva-nyl', league: 'wnba', tipEt: '9:00 ET',
    home: { tri: 'LVA', name: 'Aces', teamId: 1611661319 },
    away: { tri: 'NYL', name: 'Liberty', teamId: 1611661313 },
    tip: { homePlayer: 'Wilson', awayPlayer: 'Jones', homeWinPct: 55 },
    topPick: {
      playerId: 1628932, name: 'Wilson', side: 'home',
      bookOdds: '+380', fairOdds: '+340', rank: 1, share: 41, verdict: 'VALUE',
    },
    rosters: {
      home: [
        { playerId: 1628932, name: 'Wilson', share: 41, fg: 51, hot: true },
        { playerId: 1629669, name: 'Young', share: 22, fg: 44 },
        { playerId: 1627668, name: 'Gray', share: 16, fg: 40 },
        { playerId: 1631002, name: 'Evans', share: 12, fg: 38 },
        { playerId: 1628276, name: 'Stokes', share: 9, fg: 47 },
      ],
      away: [
        { playerId: 1627670, name: 'Stewart', share: 30, fg: 46 },
        { playerId: 1629483, name: 'Ionescu', share: 27, fg: 41 },
        { playerId: 1627669, name: 'Jones', share: 20, fg: 52 },
        { playerId: 1628886, name: 'Cloud', share: 13, fg: 37 },
        { playerId: 1628869, name: 'Fiebich', share: 10, fg: 43 },
      ],
    },
    callouts: [
      { tag: 'IN', text: 'Wilson takes 41% of LVA first shots — highest share in the league' },
      { tag: 'WATCH', text: 'NYL concedes first baskets to opposing bigs at 1.4× league rate' },
    ],
    badges: [
      { player: 'Wilson', items: [
        { icon: '🎯', label: 'First Look', note: '40%+ first-shot share', tier: 'gold' },
        { icon: '⚡', label: 'Instant Offense', note: 'scores first at 2× rate', tier: 'gold' },
      ]},
    ],
    shots: {
      playerLabel: 'Wilson L10',
      player: { makes: [[220,340],[260,360],[190,310],[250,410],[300,330]],
                misses: [[280,290],[210,260]] },
      team:   { makes: [[250,415],[150,300],[340,290],[250,240]],
                misses: [[100,330],[380,260]] },
    },
  },
  {
    id: 'demo-ind-min', league: 'wnba', tipEt: '7:30 ET',
    home: { tri: 'IND', name: 'Fever', teamId: 1611661325 },
    away: { tri: 'MIN', name: 'Lynx', teamId: 1611661324 },
    tip: { homePlayer: 'Boston', awayPlayer: 'Smith', homeWinPct: 48 },
    topPick: {
      playerId: 1642294, name: 'Clark', side: 'home',
      bookOdds: '+500', fairOdds: '+520', rank: 2, share: 29, verdict: 'PASS',
    },
    rosters: {
      home: [
        { playerId: 1642294, name: 'Clark', share: 29, fg: 39, hot: true },
        { playerId: 1641715, name: 'Boston', share: 24, fg: 54 },
        { playerId: 1628935, name: 'Mitchell', share: 23, fg: 42 },
        { playerId: 1630168, name: 'Hull', share: 13, fg: 44 },
        { playerId: 1627711, name: 'Howard', share: 11, fg: 40 },
      ],
      away: [
        { playerId: 1628966, name: 'Collier', share: 34, fg: 49 },
        { playerId: 1629478, name: 'McBride', share: 21, fg: 43 },
        { playerId: 1631021, name: 'Smith', share: 18, fg: 50 },
        { playerId: 1629670, name: 'Hiedeman', share: 15, fg: 38 },
        { playerId: 1630162, name: 'Juhász', share: 12, fg: 45 },
      ],
    },
    callouts: [
      { tag: 'IN', text: 'Collier leads MIN with 34% first-shot share and a 49% first-attempt FG%' },
      { tag: 'WATCH', text: 'IND has scored the game\'s first basket in 8 of its last 11' },
    ],
    badges: [
      { player: 'Collier', items: [
        { icon: '🎯', label: 'First Look', note: '30%+ first-shot share', tier: 'gold' },
      ]},
    ],
    shots: {
      playerLabel: 'Clark L10',
      player: { makes: [[250,220],[150,260],[330,250]],
                misses: [[250,180],[90,290],[280,240]] },
      team:   { makes: [[250,410],[200,300],[320,320]],
                misses: [[250,230],[400,290]] },
    },
  },
  // ---------- NBA (season tips late October) ----------
  {
    id: 'demo-lal-lac', league: 'nba', tipEt: '10:30 ET',
    home: { tri: 'LAL', name: 'Lakers', teamId: 1610612747 },
    away: { tri: 'LAC', name: 'Clippers', teamId: 1610612746 },
    tip: { homePlayer: 'Ayton', awayPlayer: 'Zubac', homeWinPct: 78 },
    topPick: {
      playerId: 1629029, name: 'Dončić', side: 'home',
      bookOdds: '+470', fairOdds: '+410', rank: 1, share: 38, verdict: 'VALUE',
    },
    rosters: {
      home: [
        { playerId: 1629029, name: 'Dončić', share: 38, fg: 44, hot: true },
        { playerId: 1630559, name: 'Reaves', share: 18, fg: 41 },
        { playerId: 2544,    name: 'James', share: 17, fg: 47 },
        { playerId: 1628966, name: 'Ayton', share: 15, fg: 52 },
        { playerId: 1629060, name: 'Hachimura', share: 12, fg: 45 },
      ],
      away: [
        { playerId: 201935,  name: 'Harden', share: 31, fg: 36 },
        { playerId: 202695,  name: 'Leonard', share: 24, fg: 46 },
        { playerId: 1626181, name: 'Powell', share: 19, fg: 43 },
        { playerId: 1627826, name: 'Zubac', share: 14, fg: 55 },
        { playerId: 201587,  name: 'Batum', share: 5, fg: 33 },
      ],
    },
    callouts: [
      { tag: 'IN', text: 'Ayton wins the jump vs Zubac in 78% of head-to-heads (n=9)' },
      { tag: 'IN', text: 'Dončić takes 38% of LAL first shots over L10, no other Laker above 18%' },
      { tag: 'WATCH', text: 'LAC concedes first baskets to opposing guards at 1.3× league rate (n=41)' },
    ],
    badges: [
      { player: 'Dončić', items: [
        { icon: '🎯', label: 'First Look', note: '40%+ first-shot share', tier: 'gold' },
        { icon: '🧊', label: 'Cold Open', note: '<35% on first attempts', tier: 'cold' },
      ]},
      { player: 'Ayton', items: [
        { icon: '🪝', label: 'Tip Titan', note: '70%+ jump wins', tier: 'gold' },
      ]},
    ],
    shots: {
      playerLabel: 'Dončić L10',
      player: { makes: [[110,300],[250,250],[330,245],[255,400],[180,255],[240,235]],
                misses: [[90,260],[285,230],[410,300],[230,380]] },
      team:   { makes: [[250,420],[205,430],[300,410],[60,400],[440,390],[250,300],[150,270]],
                misses: [[340,270],[130,330],[255,215]] },
    },
  },
  {
    id: 'demo-bos-nyk', league: 'nba', tipEt: '7:00 ET',
    home: { tri: 'BOS', name: 'Celtics', teamId: 1610612738 },
    away: { tri: 'NYK', name: 'Knicks', teamId: 1610612752 },
    tip: { homePlayer: 'Queta', awayPlayer: 'Towns', homeWinPct: 41 },
    topPick: {
      playerId: 1628973, name: 'Brunson', side: 'away',
      bookOdds: '+550', fairOdds: '+520', rank: 1, share: 33, verdict: 'PASS',
    },
    rosters: {
      home: [
        { playerId: 1627759, name: 'Brown', share: 29, fg: 45 },
        { playerId: 1628401, name: 'White', share: 22, fg: 40 },
        { playerId: 1630573, name: 'Hauser', share: 18, fg: 42 },
        { playerId: 1629684, name: 'Pritchard', share: 17, fg: 44 },
        { playerId: 1630202, name: 'Queta', share: 9, fg: 58 },
      ],
      away: [
        { playerId: 1628973, name: 'Brunson', share: 33, fg: 43, hot: true },
        { playerId: 1626157, name: 'Towns', share: 26, fg: 49 },
        { playerId: 1628969, name: 'Bridges', share: 18, fg: 44 },
        { playerId: 1628384, name: 'Anunoby', share: 14, fg: 41 },
        { playerId: 1628404, name: 'Hart', share: 6, fg: 47 },
      ],
    },
    callouts: [
      { tag: 'IN', text: 'Towns wins the opening jump at 59% overall; Queta at 44%' },
      { tag: 'WATCH', text: 'BOS opens with a 3PT attempt on 52% of first possessions — league high' },
    ],
    badges: [
      { player: 'Brunson', items: [
        { icon: '🎯', label: 'First Look', note: '30%+ first-shot share', tier: 'gold' },
      ]},
    ],
    shots: {
      playerLabel: 'Brunson L10',
      player: { makes: [[240,380],[210,340],[270,300],[150,320]],
                misses: [[300,260],[240,230]] },
      team:   { makes: [[250,415],[180,290],[320,280],[70,390]],
                misses: [[250,220],[420,310]] },
    },
  },
]
