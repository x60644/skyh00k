// Placeholder slate — same shape the live pipeline will emit.
// stats: share = first-shot share % (L10), fg = first-attempt FG%.

export const demoSlate = [
  {
    id: 'demo-lal-lac',
    tipEt: '10:30 ET',
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
      { tag: 'WATCH', text: "When LAL's first shot misses, Ayton scores next on 24% of putback chances" },
    ],
    badges: [
      { player: 'Dončić', items: [
        { icon: '🎯', label: 'First Look', note: '40%+ first-shot share', tier: 'gold' },
        { icon: '🧊', label: 'Cold Open', note: '<35% on first attempts', tier: 'cold' },
      ]},
      { player: 'Ayton', items: [
        { icon: '🪝', label: 'Tip Titan', note: '70%+ jump wins', tier: 'gold' },
        { icon: '🧹', label: 'Glass First', note: 'putback threat', tier: '' },
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
    id: 'demo-bos-nyk',
    tipEt: '7:00 ET',
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
