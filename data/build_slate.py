"""
skyh00k — phase 1 pipeline (v0.5)
=================================
Computes model factors from cached PlayByPlayV3, enriches with roster
positions, positional-concession rates, badges, and the top pick's shot
chart, merges any book lines entered via the app (Supabase), and emits
slate.json + a dated archive.

Run from the data folder:
    python build_slate.py                  # today's NBA slate
    python build_slate.py --league wnba
    python build_slate.py --date 2026-10-21

Supabase (optional): set env vars SUPABASE_URL and SUPABASE_KEY to bake
entered lines + verdicts into the slate. Without them, lines stay
app-side only.
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import warnings
from collections import defaultdict

warnings.filterwarnings("ignore", category=DeprecationWarning)

import pandas as pd

# Windows consoles/pipes default to cp1252, which can't encode marks like
# the HIT check — the model's FIRST hit (2026-10-23) crashed the audit here.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

try:
    from nba_api.stats.endpoints import (leaguegamefinder, playbyplayv3,
                                         scoreboardv2, commonteamroster)
except ImportError:
    sys.exit("Missing dependency. Run:  pip install nba_api pandas")

CACHE_DIR = "cache"
OUT_PATH = os.path.join("..", "app", "public", "slate.json")
SLEEP_SECONDS = 0.8
LEAGUE_IDS = {"nba": "00", "wnba": "10"}
DEFAULT_SEASONS = {"nba": "2026-27", "wnba": "2026"}
# Prior season seeds factors at the start of a new season; the L10 windows
# roll forward naturally as new games land (game IDs sort chronologically
# across seasons: 00225... < 00226...). Traded players start thin on their
# new team because factors key on (playerName, teamTricode).
PRIOR_SEASONS = {"nba": "2025-26", "wnba": None}
TIP_TO_FIRST_SHOT = 0.85
TIMEOUT = 75          # stats.nba.com throttles cloud IPs; default 30s is too tight
RETRIES = 3
L10 = 10
FG_PRIOR, FG_PRIOR_N = 0.47, 5
VERDICT_BET, VERDICT_VALUE = 0.03, 0.01


def with_retry(label, fn):
    """Call fn() up to RETRIES times with backoff; raise on final failure."""
    for attempt in range(1, RETRIES + 1):
        try:
            return fn()
        except Exception as e:
            if attempt == RETRIES:
                raise
            wait = 20 * attempt
            print(f"  ! {label} attempt {attempt} failed ({e.__class__.__name__}); "
                  f"retrying in {wait}s...")
            time.sleep(wait)


# ---------------- fetch / cache ----------------

def refresh_games(season, league):
    df = with_retry("game list", lambda: leaguegamefinder.LeagueGameFinder(
        season_nullable=season, season_type_nullable="Regular Season",
        league_id_nullable=LEAGUE_IDS[league], timeout=TIMEOUT).get_data_frames()[0])
    df.to_csv(os.path.join(CACHE_DIR, f"games_{league}_{season}.csv"), index=False)
    return df


def load_prior_games(league):
    """Prior-season game list, from cache when possible (one fetch otherwise)."""
    prior = PRIOR_SEASONS.get(league)
    if not prior:
        return None
    cache_path = os.path.join(CACHE_DIR, f"games_{league}_{prior}.csv")
    if os.path.exists(cache_path):
        return pd.read_csv(cache_path, dtype={"GAME_ID": str})
    print(f"Prior season {prior} game list not cached — fetching once...")
    return refresh_games(prior, league)


def finals_of(df):
    """Completed game IDs from a game-list frame; safe on empty/new seasons."""
    if df is None or df.empty or "WL" not in df.columns:
        return []
    return df[df["WL"].notna()]["GAME_ID"].astype(str).unique().tolist()


def get_pbp(game_id):
    cache_path = os.path.join(CACHE_DIR, f"pbp3_{game_id}.csv")
    if os.path.exists(cache_path):
        return pd.read_csv(cache_path)
    try:
        pbp = with_retry(f"pbp {game_id}", lambda: playbyplayv3.PlayByPlayV3(
            game_id=game_id, timeout=TIMEOUT).get_data_frames()[0])
    except Exception as e:
        print(f"  ! pbp fetch failed for {game_id}: {e}")
        return None
    if pbp.empty:
        return None
    pbp.to_csv(cache_path, index=False)
    time.sleep(SLEEP_SECONDS)
    return pbp


def get_roster_positions(team_id, season, league):
    """personId -> position ('G','F','C','G-F',...) for one team, cached.
    Cache is season-keyed so a new season forces a one-time refetch (trades)."""
    cache_path = os.path.join(CACHE_DIR, f"roster_{league}_{season}_{team_id}.csv")
    if os.path.exists(cache_path):
        df = pd.read_csv(cache_path)
    else:
        try:
            df = with_retry(f"roster {team_id}", lambda: commonteamroster.CommonTeamRoster(
                team_id=team_id, season=season, timeout=TIMEOUT,
                league_id_nullable=LEAGUE_IDS[league]).get_data_frames()[0])
        except Exception as e:
            print(f"  ! roster fetch failed for team {team_id}: {e}")
            return {}
        df.to_csv(cache_path, index=False)
        time.sleep(SLEEP_SECONDS)
    out = {}
    for _, r in df.iterrows():
        pos = str(r.get("POSITION", "") or "").strip()
        if pos:
            out[int(r["PLAYER_ID"])] = pos
    return out


# ---------------- factor computation ----------------

def compute_factors(game_ids, game_dates=None):
    players = defaultdict(lambda: {
        "personId": None, "team": None, "name": None,
        "first_shots": 0, "first_shots_l10": 0,
        "first_att_makes": 0, "first_att": 0,
        "first_baskets": 0, "second_chance": 0,
        "jumps_won": 0, "jumps_total": 0,
    })
    team_games = defaultdict(list)
    team_tips = defaultdict(lambda: [0, 0])
    game_rows = []   # per-game: first shot key, first basket person/team, conceder
    game_dates = game_dates or {}
    # team-level profile stats (the MODEL tab's matchup table)
    team_stats = defaultdict(lambda: {
        "g": 0, "first_shot": 0, "first_score": 0,
        "fa_makes": 0, "fa_n": 0, "fga2fg_sum": 0, "fga2fg_n": 0,
    })
    team_log = defaultdict(list)   # chronological per-team game log
    h2h = defaultdict(lambda: defaultdict(int))   # sorted (a,b) -> winner name -> wins

    for gid in game_ids:
        path = os.path.join(CACHE_DIR, f"pbp3_{gid}.csv")
        if not os.path.exists(path):
            continue
        pbp = pd.read_csv(path)
        p1 = pbp[pbp["period"] == 1]
        if p1.empty:
            continue

        named = p1.dropna(subset=["playerName", "teamTricode"])
        teams_in_game = sorted(set(named["teamTricode"]))
        nt = named.groupby("playerName")["teamTricode"].agg(set)
        name_team = {n: next(iter(t)) for n, t in nt.items() if len(t) == 1}

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
                    key = (jumper, jt)
                    rec = players[key]
                    rec["team"], rec["name"] = jt, jumper
                    if (named["playerName"] == jumper).any():
                        row = named[named["playerName"] == jumper].iloc[0]
                        rec["personId"] = int(row["personId"])
                        rec["name"] = row["playerNameI"]
                    rec["jumps_total"] += 1
                    if tip_team == jt:
                        rec["jumps_won"] += 1
                if tip_team:
                    for side in teams_in_game:
                        team_tips[side][1] += 1
                        if side == tip_team:
                            team_tips[side][0] += 1
                    # jump winner = the JUMPER whose team gained possession
                    # (tip_to is the receiver, often a third player)
                    winner = j1 if name_team.get(j1) == tip_team else \
                             j2 if name_team.get(j2) == tip_team else None
                    if winner:
                        h2h[tuple(sorted((j1, j2)))][winner] += 1

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

        fb_info = None
        if fb is not None:
            kb = (fb["playerName"], fb["teamTricode"])
            rb = players[kb]
            rb["personId"] = int(fb["personId"])
            rb["team"], rb["name"] = fb["teamTricode"], fb["playerNameI"]
            rb["first_baskets"] += 1
            if kb != key:
                rb["second_chance"] += 1
            conceder = next((t for t in teams_in_game
                             if t != fb["teamTricode"]), None)
            fb_info = {"personId": int(fb["personId"]),
                       "team": fb["teamTricode"], "conceder": conceder}

        # per-team profile stats + game log entry
        for side in teams_in_game:
            opp = next((t for t in teams_in_game if t != side), "")
            ts = team_stats[side]
            ts["g"] += 1
            took_first = fa["teamTricode"] == side
            scored_first = fb is not None and fb["teamTricode"] == side
            if took_first:
                ts["first_shot"] += 1
            if scored_first:
                ts["first_score"] += 1
            tfga = fga[fga["teamTricode"] == side]
            if not tfga.empty:
                ts["fa_n"] += 1
                if str(tfga.iloc[0]["shotResult"]) == "Made":
                    ts["fa_makes"] += 1
                made_mask = (tfga["shotResult"].astype(str) == "Made").tolist()
                if True in made_mask:
                    ts["fga2fg_sum"] += made_mask.index(True) + 1
                    ts["fga2fg_n"] += 1
            team_log[side].append({
                "gid": gid, "date": game_dates.get(gid, ""), "opp": opp,
                "tip": (tip_team == side) if tip_team else None,
                "firstShotUs": bool(took_first),
                "fb": (fb["playerNameI"].split(". ")[-1] if fb is not None else None),
                "fbUs": bool(scored_first),
            })

        for side in teams_in_game:
            team_games[side].append(gid)
        game_rows.append({"game_id": gid, "first_shot_key": key, "fb": fb_info})

    for team, gids in team_games.items():
        last10 = set(sorted(set(gids))[-L10:])
        for row in game_rows:
            k = row["first_shot_key"]
            if k[1] == team and row["game_id"] in last10:
                players[k]["first_shots_l10"] += 1

    return players, team_games, team_tips, game_rows, team_stats, team_log, h2h


def positional_concessions(game_rows, pos_map):
    """conceding team -> {pos: count}, plus league totals. pos = G/F/C."""
    by_team = defaultdict(lambda: defaultdict(int))
    league = defaultdict(int)
    total = 0
    for row in game_rows:
        fb = row["fb"]
        if not fb or not fb["conceder"]:
            continue
        pos = pos_map.get(fb["personId"], "")
        p = pos[0] if pos else None   # primary position letter
        if p not in ("G", "F", "C"):
            continue
        by_team[fb["conceder"]][p] += 1
        league[p] += 1
        total += 1
    return by_team, league, total


# ---------------- badges ----------------

def compute_badges(rows, n_games):
    out = []
    for r in rows:
        items = []
        if r["jumps_total"] >= 8 and r["jumps_won"] / r["jumps_total"] >= 0.65:
            items.append({"icon": "🪝", "label": "Tip Titan",
                          "note": f"{round(100*r['jumps_won']/r['jumps_total'])}% jump wins",
                          "tier": "gold"})
        if r["share_l10"] >= 0.35 and r["first_shots"] >= 5:
            items.append({"icon": "🎯", "label": "First Look",
                          "note": f"{round(100*r['share_l10'])}% first-shot share", "tier": "gold"})
        if r["first_baskets"] >= 5 and n_games >= 10 and r["first_baskets"] / n_games >= 0.15:
            items.append({"icon": "⚡", "label": "Instant Offense",
                          "note": f"{r['first_baskets']} first baskets", "tier": "gold"})
        if r["second_chance"] >= 3:
            items.append({"icon": "🧹", "label": "Glass First",
                          "note": f"{r['second_chance']} putback first baskets", "tier": ""})
        if r["first_att"] >= 8 and r["first_att_makes"] / r["first_att"] < 0.35:
            items.append({"icon": "🧊", "label": "Cold Open",
                          "note": "<35% on first attempts", "tier": "cold"})
        if items:
            out.append({"player": r["name"].split(". ")[-1], "items": items})
    out.sort(key=lambda b: len(b["items"]), reverse=True)
    return out[:3]


# ---------------- shot chart ----------------

def legacy_to_svg(x, y):
    """xLegacy/yLegacy (hoop at 0,0; tenths of feet) -> our 500x470 court."""
    try:
        sx = 250 + float(x)
        sy = 416 - float(y)
    except (TypeError, ValueError):
        return None
    if not (0 <= sx <= 500 and 90 <= sy <= 468):
        return None
    return [round(sx), round(sy)]


def shot_chart(team, top_person_id, team_games):
    gids = sorted(set(team_games.get(team, [])))[-L10:]
    player = {"makes": [], "misses": []}
    teamsh = {"makes": [], "misses": []}
    for gid in gids:
        path = os.path.join(CACHE_DIR, f"pbp3_{gid}.csv")
        if not os.path.exists(path):
            continue
        p1 = pd.read_csv(path)
        p1 = p1[p1["period"] == 1]
        fga = p1[(p1["isFieldGoal"] == 1) & (p1["teamTricode"] == team)]
        for _, s in fga.iterrows():
            made = str(s["shotResult"]) == "Made"
            pt = legacy_to_svg(s.get("xLegacy"), s.get("yLegacy"))
            if pt is None:
                continue
            bucket = "makes" if made else "misses"
            if int(s["personId"]) == top_person_id:
                player[bucket].append(pt)
            teamsh[bucket].append(pt)
            if made:
                break   # stop at team's first make
    for d in (player, teamsh):
        d["makes"], d["misses"] = d["makes"][:25], d["misses"][:25]
    return player, teamsh


# ---------------- lines (Supabase, optional) ----------------

def fetch_lines(league, date_str):
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if not (url and key):
        return []
    try:
        from supabase import create_client
        supa = create_client(url, key)
        res = (supa.table("lines").select("*")
               .eq("league", league).eq("slate_date", date_str)
               .order("created_at").execute())
        return res.data or []
    except Exception as e:
        print(f"  ! Supabase lines fetch skipped: {e}")
        return []


def odds_to_prob(odds_str):
    try:
        o = int(str(odds_str).replace("+", ""))
        return 100 / (o + 100) if o > 0 else abs(o) / (abs(o) + 100)
    except (TypeError, ValueError):
        return None


def verdict_for(fair_str, book_str):
    fp, bp = odds_to_prob(fair_str), odds_to_prob(book_str)
    if fp is None or bp is None:
        return None
    edge = fp - bp
    if edge >= VERDICT_BET:
        return "BET"
    if edge >= VERDICT_VALUE:
        return "VALUE"
    return "PASS"


# ---------------- slate assembly ----------------

def today_games(league, date_str):
    sb = with_retry("schedule", lambda: scoreboardv2.ScoreboardV2(
        game_date=date_str, league_id=LEAGUE_IDS[league], timeout=TIMEOUT))
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


def build_game_card(g, players, team_games, team_tips, league,
                    pos_map, conc_team, conc_league, conc_total, lines,
                    team_stats=None, team_log=None, h2h=None):
    team_stats = team_stats or {}
    team_log = team_log or {}
    h2h = h2h or {}
    def team_players(tri):
        rows = [r for (nm, t), r in players.items() if t == tri and r["first_shots"] > 0]
        n_l10 = min(len(set(team_games.get(tri, []))), L10) or 1
        for r in rows:
            r["share_l10"] = r["first_shots_l10"] / n_l10
            r["fg1"] = (r["first_att_makes"] + FG_PRIOR * FG_PRIOR_N) / (r["first_att"] + FG_PRIOR_N)
        rows.sort(key=lambda r: (r["first_shots_l10"], r["first_shots"]), reverse=True)
        return rows[:5]

    def team_tipwin(tri):
        won, tot = team_tips.get(tri, [0, 0])
        return (won / tot) if tot >= 5 else 0.5

    h_tri, a_tri = g["home"]["tri"], g["away"]["tri"]
    tw_h, tw_a = team_tipwin(h_tri), team_tipwin(a_tri)
    h_norm = tw_h / (tw_h + tw_a) if (tw_h + tw_a) else 0.5
    p_shot_h = h_norm * TIP_TO_FIRST_SHOT + (1 - h_norm) * (1 - TIP_TO_FIRST_SHOT)

    def jumper_rec(tri):
        """(parse-key name, record) of the team's most frequent jumper."""
        cands = [(nm, r) for (nm, t), r in players.items()
                 if t == tri and r["jumps_total"] >= 2]
        if not cands:
            return None, None
        return max(cands, key=lambda x: x[1]["jumps_total"])

    def jumper(tri):
        _, best = jumper_rec(tri)
        return best["name"].split(". ")[-1] if best else tri

    def team_profile(tri, opp_tri):
        """The MODEL tab's matchup-table row for one team."""
        ts = team_stats.get(tri)
        if not ts or not ts["g"]:
            return None
        g_n = ts["g"]
        jkey, jrec = jumper_rec(tri)
        okey, _ = jumper_rec(opp_tri)
        h2h_out = None
        if jkey and okey:
            rec = h2h.get(tuple(sorted((jkey, okey))))
            if rec:
                w = rec.get(jkey, 0)
                h2h_out = {"w": w, "l": sum(rec.values()) - w}
        won, tot = team_tips.get(tri, [0, 0])
        return {
            "tri": tri, "games": g_n,
            "jumper": jrec["name"].split(". ")[-1] if jrec else tri,
            "jumperTipPct": round(100 * jrec["jumps_won"] / jrec["jumps_total"])
                            if jrec and jrec["jumps_total"] else None,
            "jumperTips": jrec["jumps_total"] if jrec else 0,
            "teamTipPct": round(100 * won / tot) if tot else None,
            "firstShotPct": round(100 * ts["first_shot"] / g_n),
            "firstScorePct": round(100 * ts["first_score"] / g_n),
            "firstAttFgPct": round(100 * ts["fa_makes"] / ts["fa_n"])
                             if ts["fa_n"] else None,
            "fgaToFirstFg": round(ts["fga2fg_sum"] / ts["fga2fg_n"], 1)
                            if ts["fga2fg_n"] else None,
            "h2h": h2h_out,
        }

    def last10(tri):
        return [{"date": e["date"], "opp": e["opp"], "tip": e["tip"],
                 "firstShotUs": e["firstShotUs"], "fb": e["fb"], "fbUs": e["fbUs"]}
                for e in team_log.get(tri, [])[-10:]][::-1]   # newest first

    def score_side(rows, p_team_shot, n_games):
        return [(p_team_shot * r["share_l10"] * r["fg1"]
                 + (r["second_chance"] / max(n_games, 1)) * 0.5, r) for r in rows]

    n_h = len(set(team_games.get(h_tri, []))) or 1
    n_a = len(set(team_games.get(a_tri, []))) or 1
    h_rows, a_rows = team_players(h_tri), team_players(a_tri)
    scored = score_side(h_rows, p_shot_h, n_h) + score_side(a_rows, 1 - p_shot_h, n_a)
    if not scored:
        return None
    scored.sort(key=lambda x: x[0], reverse=True)
    p_top, top = scored[0]
    top_side = "home" if top["team"] == h_tri else "away"

    def pos_of(r):
        return pos_map.get(r["personId"] or -1, "")

    def roster_json(rows):
        return [{
            "playerId": r["personId"], "name": r["name"].split(". ")[-1],
            "pos": pos_of(r),
            "share": round(100 * r["share_l10"]), "fg": round(100 * r["fg1"]),
            "att": int(r["first_att"]), "thin": bool(r["first_att"] < 3),
            "hot": r is top,
        } for r in rows]

    callouts = [{"tag": "IN", "text":
                 f"{top['name']} takes {round(100 * top['share_l10'])}% of "
                 f"{top['team']} first shots over the last "
                 f"{min(n_h if top_side == 'home' else n_a, L10)} games"}]
    if tw_h != 0.5 or tw_a != 0.5:
        callouts.append({"tag": "IN", "text":
                         f"{h_tri} wins parsed opening tips at {round(100*tw_h)}%, "
                         f"{a_tri} at {round(100*tw_a)}%"})

    # positional concessions: does either team over-concede to the pick's position?
    if conc_total:
        league_share = {p: conc_league[p] / conc_total for p in conc_league}
        pos_names = {"G": "guards", "F": "forwards", "C": "centers"}
        for tri, opp_rows in ((h_tri, a_rows), (a_tri, h_rows)):
            team_conc = conc_team.get(tri, {})
            n_conc = sum(team_conc.values())
            if n_conc < 8:
                continue
            for p, cnt in team_conc.items():
                ratio = (cnt / n_conc) / league_share.get(p, 1)
                if ratio >= 1.25:
                    hit_pick = any(pos_of(r).startswith(p) for _, r in
                                   [(0, x) for x in opp_rows[:2]])
                    tag = "IN" if hit_pick else "WATCH"
                    callouts.append({"tag": tag, "text":
                                     f"{tri} concedes first baskets to opposing "
                                     f"{pos_names[p]} at {ratio:.1f}× league rate "
                                     f"(n={n_conc})"})
    sc_leader = max(scored, key=lambda x: x[1]["second_chance"])[1]
    if sc_leader["second_chance"] >= 3:
        callouts.append({"tag": "WATCH", "text":
                         f"{sc_leader['name']} has {sc_leader['second_chance']} "
                         f"second-chance first baskets — putback pathway"})

    badges = compute_badges(
        [dict(r) for r in h_rows + a_rows],
        max(n_h, n_a))

    player_shots, team_shots = shot_chart(top["team"], top["personId"], team_games)
    shots = None
    if player_shots["makes"] or player_shots["misses"]:
        shots = {"playerLabel": f"{top['name'].split('. ')[-1]} L10",
                 "player": player_shots, "team": team_shots}

    # merge entered book line for the top pick, latest wins
    book, verdict = None, None
    for ln in lines:
        if str(ln.get("game_id")) == str(g["gameId"]) and \
           int(ln.get("player_id") or -1) == (top["personId"] or -2):
            book = ln.get("odds")
    fair = fair_odds(p_top)
    if book:
        verdict = verdict_for(fair, book)

    return {
        "id": g["gameId"], "league": league, "tipEt": g["status"],
        "home": g["home"], "away": g["away"],
        "tip": {"homePlayer": jumper(h_tri), "awayPlayer": jumper(a_tri),
                "homeWinPct": round(100 * h_norm)},
        "topPick": {
            "playerId": top["personId"], "name": top["name"].split(". ")[-1],
            "pos": pos_of(top), "side": top_side,
            "bookOdds": book, "fairOdds": fair,
            "rank": 1, "share": round(100 * top["share_l10"]), "verdict": verdict,
        },
        "rosters": {"home": roster_json(h_rows), "away": roster_json(a_rows)},
        "profile": {"home": team_profile(h_tri, a_tri),
                    "away": team_profile(a_tri, h_tri)},
        "last10": {"home": last10(h_tri), "away": last10(a_tri)},
        "callouts": callouts,
        "badges": badges,
        "shots": shots,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default="nba", choices=["nba", "wnba"])
    ap.add_argument("--date", default=None, help="YYYY-MM-DD (default: today ET)")
    args = ap.parse_args()

    os.makedirs(CACHE_DIR, exist_ok=True)
    league, season = args.league, DEFAULT_SEASONS[args.league]
    et_today = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=4)).date()
    date_str = args.date or et_today.isoformat()

    print(f"Refreshing {league.upper()} {season} game list...")
    games_df = refresh_games(season, league)
    prior_df = load_prior_games(league)
    finals = sorted(set(finals_of(prior_df) + finals_of(games_df)))
    n_cur = len(finals_of(games_df))
    print(f"Factor base: {len(finals)} completed games "
          f"({n_cur} from {season}, {len(finals) - n_cur} prior-season seed)")
    new = [g for g in finals
           if not os.path.exists(os.path.join(CACHE_DIR, f"pbp3_{g}.csv"))]
    print(f"Fetching {len(new)} new completed games into cache...")
    for gid in new:
        get_pbp(gid)

    print("Fetching rosters for positions...")
    pos_map = {}
    team_src = pd.concat([d for d in (prior_df, games_df) if d is not None and not d.empty])
    tri_team = team_src.drop_duplicates("TEAM_ID")[["TEAM_ID", "TEAM_ABBREVIATION"]]
    for _, t in tri_team.iterrows():
        pos_map.update(get_roster_positions(int(t["TEAM_ID"]), season, league))

    print("Computing factors from cache...")
    game_dates = {}
    if "GAME_DATE" in team_src.columns:
        for _, r in team_src.drop_duplicates("GAME_ID").iterrows():
            game_dates[str(r["GAME_ID"])] = str(r["GAME_DATE"])
    (players, team_games, team_tips, game_rows,
     team_stats, team_log, h2h) = compute_factors(finals, game_dates)
    conc_team, conc_league, conc_total = positional_concessions(game_rows, pos_map)

    print(f"Pulling schedule for {date_str}...")
    todays = today_games(league, date_str)
    lines = fetch_lines(league, date_str)
    if lines:
        print(f"Merged {len(lines)} entered line(s) from Supabase.")

    cards = [c for g in todays
             if (c := build_game_card(g, players, team_games, team_tips, league,
                                      pos_map, conc_team, conc_league, conc_total,
                                      lines, team_stats, team_log, h2h))]

    # carry forward book odds from an earlier same-date build (e.g. odds
    # injected by hand) when no Supabase line replaced them — a rebuild
    # should never silently wipe odds off the board
    old_archive = os.path.join("slates", f"slate_{league}_{date_str}.json")
    if os.path.exists(old_archive):
        try:
            prev = {str(g["id"]): g["topPick"]
                    for g in json.load(open(old_archive, encoding="utf-8")).get("games", [])}
            for c in cards:
                tp, old = c["topPick"], prev.get(str(c["id"]))
                if (not tp["bookOdds"]) and old and old.get("bookOdds") \
                        and old.get("playerId") == tp["playerId"]:
                    tp["bookOdds"] = old["bookOdds"]
                    tp["verdict"] = verdict_for(tp["fairOdds"], old["bookOdds"])
        except (json.JSONDecodeError, OSError, KeyError):
            pass

    slate = {"generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
             "date": date_str, "league": league, "games": cards}
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(slate, f, ensure_ascii=False, indent=1)
    os.makedirs("slates", exist_ok=True)
    archive = os.path.join("slates", f"slate_{league}_{date_str}.json")
    with open(archive, "w", encoding="utf-8") as f:
        json.dump(slate, f, ensure_ascii=False, indent=1)

    print(f"\nWrote {len(cards)} game cards -> {OUT_PATH}")
    print(f"Archived -> {archive}")
    for c in cards:
        tp = c["topPick"]
        extra = f", book {tp['bookOdds']} -> {tp['verdict']}" if tp["bookOdds"] else ""
        print(f"  {c['away']['tri']} @ {c['home']['tri']}: top pick {tp['name']} "
              f"{tp['pos'] and '(' + tp['pos'] + ')'} fair {tp['fairOdds']}, "
              f"share {tp['share']}%{extra}")


if __name__ == "__main__":
    main()
