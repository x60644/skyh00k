"""
skyh00k — phase 0 data exploration (v2: PlayByPlayV3)
=====================================================
Answers the three questions before any model gets built:

  Q1. How often does the team that wins the opening tip score the first basket?
  Q2. How concentrated is first-shot share within a team's starters?
  Q3. What do the base rates imply about fair first-basket odds?

Run (from the data folder):
    python phase0_explore.py --limit 25    # quick test
    python phase0_explore.py               # full 2025-26 season (~30-45 min)

Caches to ./cache/ — safe to interrupt and rerun, it resumes where it left off.
"first basket" = first made FIELD GOAL (the books' standard market).
"""

import argparse
import os
import re
import sys
import time

import pandas as pd

try:
    from nba_api.stats.endpoints import leaguegamefinder, playbyplayv3
except ImportError:
    sys.exit("Missing dependency. Run:  pip install nba_api pandas")

CACHE_DIR = "cache"

LEAGUE_IDS = {"nba": "00", "wnba": "10"}
DEFAULT_SEASONS = {"nba": "2025-26", "wnba": "2026"}
SLEEP_SECONDS = 0.8  # be polite to stats.nba.com

REQUIRED_COLS = {"period", "actionType", "isFieldGoal", "shotResult",
                 "playerName", "playerNameI", "teamTricode", "description"}


def get_season_games(season: str, league: str) -> pd.DataFrame:
    cache_path = os.path.join(CACHE_DIR, f"games_{league}_{season}.csv")
    if os.path.exists(cache_path):
        return pd.read_csv(cache_path, dtype={"GAME_ID": str})
    finder = leaguegamefinder.LeagueGameFinder(
        season_nullable=season,
        season_type_nullable="Regular Season",
        league_id_nullable=LEAGUE_IDS[league],
    )
    df = finder.get_data_frames()[0]
    df.to_csv(cache_path, index=False)
    return df


def get_pbp(game_id: str) -> pd.DataFrame | None:
    cache_path = os.path.join(CACHE_DIR, f"pbp3_{game_id}.csv")
    if os.path.exists(cache_path):
        return pd.read_csv(cache_path)
    try:
        pbp = playbyplayv3.PlayByPlayV3(game_id=game_id).get_data_frames()[0]
    except Exception as e:
        print(f"  ! pbp fetch failed for {game_id}: {e}")
        return None
    pbp.to_csv(cache_path, index=False)
    time.sleep(SLEEP_SECONDS)
    return pbp


def check_columns(pbp: pd.DataFrame) -> bool:
    missing = REQUIRED_COLS - set(pbp.columns)
    if missing:
        print("\n!! Column mismatch — the endpoint returned different names.")
        print(f"   Missing: {sorted(missing)}")
        print(f"   Actual columns: {list(pbp.columns)}")
        print("   Paste this output into the chat and I'll adjust the script.")
        return False
    return True


def extract_game_facts(pbp: pd.DataFrame) -> dict | None:
    p1 = pbp[pbp["period"] == 1]
    if p1.empty:
        return None

    facts = {}

    # Descriptions reference bare LAST names ("Tip to Thompson"), so map
    # playerName (last name) -> team. If both teams have that last name in
    # this game, treat the tip as unparseable rather than guess.
    named = p1.dropna(subset=["playerName", "teamTricode"])
    name_teams = named.groupby("playerName")["teamTricode"].agg(set)
    name_team = {n: next(iter(t)) for n, t in name_teams.items() if len(t) == 1}

    # Opening jump ball: description ends "...: Tip to <last name>"
    jumps = p1[p1["actionType"].astype(str).str.lower().str.contains("jump")]
    facts["tip_win_team"] = None
    facts["tip_to_player"] = None
    if not jumps.empty:
        desc = str(jumps.iloc[0].get("description", ""))
        m = re.search(r"[Tt]ip to (.+?)\s*$", desc)
        if m:
            tip_to = m.group(1).strip()
            facts["tip_to_player"] = tip_to
            facts["tip_win_team"] = name_team.get(tip_to)

    # First FG attempt (made or missed)
    fga = p1[p1["isFieldGoal"] == 1]
    if fga.empty:
        return None
    first_att = fga.iloc[0]
    facts["first_shot_player"] = first_att["playerNameI"]
    facts["first_shot_team"] = first_att["teamTricode"]
    facts["first_shot_made"] = int(str(first_att["shotResult"]) == "Made")

    # First made FG = the first basket
    made = fga[fga["shotResult"].astype(str) == "Made"]
    if made.empty:
        return None
    fb = made.iloc[0]
    facts["first_basket_player"] = fb["playerNameI"]
    facts["first_basket_team"] = fb["teamTricode"]
    return facts


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default="nba", choices=["nba", "wnba"])
    ap.add_argument("--season", default=None,
                    help="defaults: nba 2025-26, wnba 2026")
    ap.add_argument("--limit", type=int, default=0, help="cap games for a quick test")
    args = ap.parse_args()

    os.makedirs(CACHE_DIR, exist_ok=True)

    season = args.season or DEFAULT_SEASONS[args.league]
    games = get_season_games(season, args.league)
    game_ids = sorted(games["GAME_ID"].unique())
    if args.limit:
        game_ids = game_ids[: args.limit]
    print(f"{args.league.upper()} season {season}: {len(game_ids)} games to process\n")

    rows = []
    checked = False
    for i, gid in enumerate(game_ids, 1):
        pbp = get_pbp(gid)
        if pbp is None:
            continue
        if not checked:
            if not check_columns(pbp):
                return
            checked = True
        facts = extract_game_facts(pbp)
        if facts:
            facts["game_id"] = gid
            rows.append(facts)
        if i % 50 == 0:
            print(f"  processed {i}/{len(game_ids)} games...")

    df = pd.DataFrame(rows)
    out_path = os.path.join(CACHE_DIR, f"first_basket_facts_{args.league}_{season}.csv")
    df.to_csv(out_path, index=False)
    n = len(df)
    print(f"\nExtracted facts for {n} games -> {out_path}")
    if n == 0:
        return

    print("\n" + "=" * 60)
    print("Q1 — DOES THE TIP MATTER?")
    print("=" * 60)
    has_tip = df.dropna(subset=["tip_win_team"])
    print(f"Games with a parsed opening tip: {len(has_tip)}/{n}")
    if len(has_tip):
        tip_first_shot = (has_tip["tip_win_team"] == has_tip["first_shot_team"]).mean()
        tip_first_basket = (has_tip["tip_win_team"] == has_tip["first_basket_team"]).mean()
        print(f"Tip winner takes the game's first shot:      {tip_first_shot:6.1%}")
        print(f"Tip winner's team scores the first basket:   {tip_first_basket:6.1%}")
    shooter_scores = (df["first_shot_player"] == df["first_basket_player"]).mean()
    print(f"Game's first SHOOTER scores the first basket:{shooter_scores:6.1%}")
    print(f"First shot of the game goes in:              {df['first_shot_made'].mean():6.1%}")

    print("\n" + "=" * 60)
    print("Q2 — HOW CONCENTRATED IS FIRST-SHOT SHARE?")
    print("=" * 60)
    shares = (
        df.groupby(["first_shot_team", "first_shot_player"])
        .size()
        .rename("first_shots")
        .reset_index()
    )
    team_totals = shares.groupby("first_shot_team")["first_shots"].transform("sum")
    shares["share"] = shares["first_shots"] / team_totals
    top_share = shares.groupby("first_shot_team")["share"].max()
    print(f"Median team's TOP option takes {top_share.median():.1%} of first shots")
    print(f"Most concentrated:  {top_share.idxmax()} ({top_share.max():.1%})")
    print(f"Least concentrated: {top_share.idxmin()} ({top_share.min():.1%})")
    print("\nTop 15 first-shot takers league-wide:")
    for _, r in shares.sort_values("first_shots", ascending=False).head(15).iterrows():
        print(f"  {r['first_shot_player']:<20} {r['first_shot_team']}  "
              f"{int(r['first_shots']):>3} first shots  ({r['share']:.0%} of team)")

    print("\n" + "=" * 60)
    print("Q3 — WHAT DO BASE RATES IMPLY ABOUT FAIR ODDS?")
    print("=" * 60)
    fb_counts = df["first_basket_player"].value_counts()
    games_per_team = max(n * 2 / (13 if args.league == "wnba" else 30), 1)
    print("Top 10 first-basket scorers — empirical rate and fair odds:")
    for player, cnt in fb_counts.head(10).items():
        rate = min(cnt / games_per_team, 0.35)
        fair = (1 / rate - 1) * 100
        print(f"  {player:<20} {cnt:>3} first baskets  "
              f"~{rate:.1%} of team games  fair ~+{fair:.0f}")
    print("\nCompare against book prices (typically +400 to +1200 with heavy")
    print("vig). Start recording real lines in the Line Book once preseason")
    print("props post — that's the only path to legitimately testing edge.")


if __name__ == "__main__":
    main()
