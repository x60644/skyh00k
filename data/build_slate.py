"""
skyh00k — phase 1: build_slate
==============================
Reads cached PlayByPlayV3 data, computes the three IN factors per player
(+ the second-chance term), pulls today's schedule, and emits a live
slate.json the app renders directly.

Run from the data folder:
    python build_slate.py                  # today's WNBA slate
    python build_slate.py --league nba     # (from late October)
    python build_slate.py --date 2026-08-13

Output: ../app/public/slate.json  (commit + push -> Vercel redeploys)

Model per player:
    P(first basket) ~= P(team takes first shot) x first-shot share (L10)
                       x first-attempt FG% + second-chance term
    P(team takes first shot) = tipwin x 0.85 + (1 - tipwin) x 0.15
    (0.85 = measured phase-0 rate that the tip winner shoots first)
Fair odds = 100 x (1/p - 1). No book odds yet -> verdict omitted.
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
from collections import defaultdict

import pandas as pd

try:
    from nba_api.stats.endpoints import leaguegamefinder, playbyplayv3, scoreboardv2
except ImportError:
    sys.exit("Missing dependency. Run:  pip install nba_api pandas")

CACHE_DIR = "cache"
OUT_PATH = os.path.join("..", "app", "public", "slate.json")
SLEEP_SECONDS = 0.8
LEAGUE_IDS = {"nba": "00", "wnba": "10"}
DEFAULT_SEASONS = {"nba": "2025-26", "wnba": "2026"}
TIP_TO_FIRST_SHOT = 0.85  # phase-0 measured
L10 = 10


# ---------------- cache refresh ----------------

def refresh_games(season, league):
    """Always refetch the season game list so new final games are seen."""
    finder = leaguegamefinder.LeagueGameFinder(
        season_nullable=season, season_type_nullable="Regular Season",
        league_id_nullable=LEAGUE_IDS[league])
    df = finder.get_data_frames()[0]
    df.to_csv(os.path.join(CACHE_DIR, f"games_{league}_{season}.csv"), index=False)
    return df


def get_pbp(game_id):
    cache_path = os.path.join(CACHE_DIR, f"pbp3_{game_id}.csv")
    if os.path.exists(cache_path):
        return pd.read_csv(cache_path)
    try:
        pbp = playbyplayv3.PlayByPlayV3(game_id=game_id).get_data_frames()[0]
    except Exception as e:
        print(f"  ! pbp fetch failed for {game_id}: {e}")
        return None
    if pbp.empty:
        return None
    pbp.to_csv(cache_path, index=False)
    time.sleep(SLEEP_SECONDS)
    return pbp


# ---------------- factor computation ----------------

def compute_factors(game_ids):
    """One pass over cached pbp -> per-player and per-team factor tables."""
    players = defaultdict(lambda: {
        "personId": None, "team": None, "name": None,
        "first_shots": 0, "first_shots_l10": 0,
        "first_att_makes": 0, "first_att": 0,
        "first_baskets": 0, "second_chance": 0,
        "jumps_won": 0, "jumps_total": 0,
    })
    team_games = defaultdict(list)   # team -> [game_id] (chronological)
    team_tips = defaultdict(lambda: [0, 0])  # team -> [won, total]
    game_rows = []

    for gid in game_ids:
        path = os.path.join(CACHE_DIR, f"pbp3_{gid}.csv")
        if not os.path.exists(path):
            continue
        pbp = pd.read_csv(path)
        p1 = pbp[pbp["period"] == 1]
        if p1.empty:
            continue

        named = p1.dropna(subset=["playerName", "teamTricode"])
        nt = named.groupby("playerName")["teamTricode"].agg(set)
        name_team = {n: next(iter(t)) for n, t in nt.items() if len(t) == 1}

        # jump ball
        tip_team = None
        jumps = p1[p1["actionType"].astype(str).str.lower().str.contains("jump")]
        if not jumps.empty:
            desc = str(jumps.iloc[0].get("description", ""))
            m = re.search(r"Jump Ball (.+?) vs\. (.+?): [Tt]ip to (.+?)\s*$", desc)
            if m:
                j1, j2, tip_to = (s.strip() for s in m.groups())
                tip_team = name_team.get(tip_to)
                for jumper in (j1, j2):
                    jt = name_team.get(jumper)
                    if jt is None:
                        continue
                    row = named[named["playerName"] == jumper].iloc[0] \
                        if (named["playerName"] == jumper).any() else None
                    key = (jumper, jt)
                    rec = players[key]
                    rec["team"], rec["name"] = jt, jumper
                    if row is not None:
                        rec["personId"] = int(row["personId"])
                        rec["name"] = row["playerNameI"]
                    rec["jumps_total"] += 1
                    if tip_team == jt:
                        rec["jumps_won"] += 1
                if tip_team:
                    for side in set(named["teamTricode"]):
                        team_tips[side][1] += 1
                        if side == tip_team:
                            team_tips[side][0] += 1

        fga = p1[p1["isFieldGoal"] == 1]
        if fga.empty:
            continue
        fa = fga.iloc[0]
        made = fga[fga["shotResult"].astype(str) == "Made"]
        fb = made.iloc[0] if not made.empty else None

        key = (fa["playerName"], fa["teamTricode"])
        rec = players[key]
        rec["personId"] = int(fa["personId"])
        rec["team"], rec["name"] = fa["teamTricode"], fa["playerNameI"]
        rec["first_shots"] += 1
        rec["first_att"] += 1
        if str(fa["shotResult"]) == "Made":
            rec["first_att_makes"] += 1

        if fb is not None:
            kb = (fb["playerName"], fb["teamTricode"])
            rb = players[kb]
            rb["personId"] = int(fb["personId"])
            rb["team"], rb["name"] = fb["teamTricode"], fb["playerNameI"]
            rb["first_baskets"] += 1
            if kb != key:
                rb["second_chance"] += 1

        for side in set(named["teamTricode"]):
            team_games[side].append(gid)
        game_rows.append({"game_id": gid, "first_shot_key": key})

    # L10 first-shot shares
    for team, gids in team_games.items():
        last10 = set(sorted(set(gids))[-L10:])
        for row in game_rows:
            k = row["first_shot_key"]
            if k[1] == team and row["game_id"] in last10:
                players[k]["first_shots_l10"] += 1

    return players, team_games, team_tips


# ---------------- slate assembly ----------------

def today_games(league, date_str):
    sb = scoreboardv2.ScoreboardV2(game_date=date_str, league_id=LEAGUE_IDS[league])
    hdr = sb.game_header.get_data_frame()
    lines = sb.line_score.get_data_frame()
    games = []
    for _, g in hdr.iterrows():
        ls = lines[lines["GAME_ID"] == g["GAME_ID"]]
        def team_of(tid):
            r = ls[ls["TEAM_ID"] == tid]
            return (r.iloc[0]["TEAM_ABBREVIATION"], r.iloc[0]["TEAM_CITY_NAME"] + " " +
                    r.iloc[0]["TEAM_NAME"]) if not r.empty else (None, None)
        h_tri, h_name = team_of(g["HOME_TEAM_ID"])
        a_tri, a_name = team_of(g["VISITOR_TEAM_ID"])
        games.append({
            "gameId": g["GAME_ID"], "status": g.get("GAME_STATUS_TEXT", ""),
            "home": {"tri": h_tri, "name": h_name, "teamId": int(g["HOME_TEAM_ID"])},
            "away": {"tri": a_tri, "name": a_name, "teamId": int(g["VISITOR_TEAM_ID"])},
        })
    return games


def fair_odds(p):
    p = max(min(p, 0.60), 0.005)
    return f"+{round(100 * (1 / p - 1))}"


def build_game_card(g, players, team_games, team_tips, league):
    def team_players(tri):
        rows = [r for (nm, t), r in players.items() if t == tri and r["first_shots"] > 0]
        n_l10 = min(len(set(team_games.get(tri, []))), L10) or 1
        for r in rows:
            r["share_l10"] = r["first_shots_l10"] / n_l10
            r["fg1"] = (r["first_att_makes"] / r["first_att"]) if r["first_att"] else 0.42
        rows.sort(key=lambda r: (r["first_shots_l10"], r["first_shots"]), reverse=True)
        return rows[:5]

    def team_tipwin(tri):
        won, tot = team_tips.get(tri, [0, 0])
        return (won / tot) if tot >= 5 else 0.5

    h_tri, a_tri = g["home"]["tri"], g["away"]["tri"]
    tw_h, tw_a = team_tipwin(h_tri), team_tipwin(a_tri)
    h_norm = tw_h / (tw_h + tw_a) if (tw_h + tw_a) else 0.5
    p_shot_h = h_norm * TIP_TO_FIRST_SHOT + (1 - h_norm) * (1 - TIP_TO_FIRST_SHOT)

    def jumper(tri):
        cands = [r for (nm, t), r in players.items() if t == tri and r["jumps_total"] >= 2]
        if not cands:
            return tri
        best = max(cands, key=lambda r: r["jumps_total"])
        return best["name"].split(". ")[-1]

    def score_side(rows, p_team_shot, n_games):
        out = []
        for r in rows:
            p = p_team_shot * r["share_l10"] * r["fg1"]
            p += (r["second_chance"] / max(n_games, 1)) * 0.5  # damped 2nd-chance
            out.append((p, r))
        return out

    n_h = len(set(team_games.get(h_tri, []))) or 1
    n_a = len(set(team_games.get(a_tri, []))) or 1
    scored = (score_side(team_players(h_tri), p_shot_h, n_h) +
              score_side(team_players(a_tri), 1 - p_shot_h, n_a))
    if not scored:
        return None
    scored.sort(key=lambda x: x[0], reverse=True)
    p_top, top = scored[0]
    top_side = "home" if top["team"] == h_tri else "away"

    def roster_json(rows):
        return [{
            "playerId": r["personId"], "name": r["name"].split(". ")[-1],
            "share": round(100 * r["share_l10"]), "fg": round(100 * r["fg1"]),
            "hot": r is top,
        } for r in rows]

    callouts = [{"tag": "IN", "text":
                 f"{top['name']} takes {round(100 * top['share_l10'])}% of "
                 f"{top['team']} first shots over the last {min(n_h if top_side=='home' else n_a, L10)} games"}]
    if tw_h != 0.5 or tw_a != 0.5:
        callouts.append({"tag": "IN", "text":
                         f"{h_tri} wins parsed opening tips at {round(100*tw_h)}%, "
                         f"{a_tri} at {round(100*tw_a)}%"})
    sc_leader = max(scored, key=lambda x: x[1]["second_chance"])[1]
    if sc_leader["second_chance"] >= 3:
        callouts.append({"tag": "WATCH", "text":
                         f"{sc_leader['name']} has {sc_leader['second_chance']} second-chance "
                         f"first baskets — putback pathway"})

    return {
        "id": g["gameId"], "league": league, "tipEt": g["status"],
        "home": g["home"], "away": g["away"],
        "tip": {"homePlayer": jumper(h_tri), "awayPlayer": jumper(a_tri),
                "homeWinPct": round(100 * h_norm)},
        "topPick": {
            "playerId": top["personId"], "name": top["name"].split(". ")[-1],
            "side": top_side, "bookOdds": None, "fairOdds": fair_odds(p_top),
            "rank": 1, "share": round(100 * top["share_l10"]), "verdict": None,
        },
        "rosters": {"home": roster_json(team_players(h_tri)),
                    "away": roster_json(team_players(a_tri))},
        "callouts": callouts,
        "badges": [],
        "shots": None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default="wnba", choices=["nba", "wnba"])
    ap.add_argument("--date", default=None, help="YYYY-MM-DD (default: today ET)")
    args = ap.parse_args()

    os.makedirs(CACHE_DIR, exist_ok=True)
    league = args.league
    season = DEFAULT_SEASONS[league]
    et_today = (dt.datetime.utcnow() - dt.timedelta(hours=4)).date()
    date_str = args.date or et_today.isoformat()

    print(f"Refreshing {league.upper()} game list...")
    games_df = refresh_games(season, league)
    finals = games_df[games_df["WL"].notna()]["GAME_ID"].unique()
    new = [g for g in sorted(finals)
           if not os.path.exists(os.path.join(CACHE_DIR, f"pbp3_{g}.csv"))]
    print(f"Fetching {len(new)} new completed games into cache...")
    for gid in new:
        get_pbp(gid)

    print("Computing factors from cache...")
    players, team_games, team_tips = compute_factors(sorted(set(finals)))

    print(f"Pulling schedule for {date_str}...")
    todays = today_games(league, date_str)
    if not todays:
        print("No games scheduled — writing empty slate.")
    cards = [c for g in todays
             if (c := build_game_card(g, players, team_games, team_tips, league))]

    slate = {"generated": dt.datetime.utcnow().isoformat() + "Z",
             "date": date_str, "league": league, "games": cards}
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(slate, f, ensure_ascii=False, indent=1)
    print(f"\nWrote {len(cards)} game cards -> {OUT_PATH}")
    for c in cards:
        tp = c["topPick"]
        print(f"  {c['away']['tri']} @ {c['home']['tri']}: "
              f"top pick {tp['name']} (fair {tp['fairOdds']}, share {tp['share']}%)")
    print("\nCommit + push app/public/slate.json and Vercel redeploys the live board.")


if __name__ == "__main__":
    main()
