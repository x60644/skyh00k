"""
skyh00k — audit_slate
=====================
Grades a past slate against what actually happened. The evidence engine:
run it every morning after games settle.

Run from the data folder:
    python audit_slate.py                     # yesterday's WNBA slate
    python audit_slate.py --date 2026-08-12
    python audit_slate.py --league nba --date 2026-10-28

Reads:  slates/slate_{league}_{date}.json  (archived by build_slate.py;
        falls back to ../app/public/slate.json if its date matches)
Writes: audit_log.csv  (append-only, one row per graded game)
Prints: per-game grades + running totals across the whole log.
"""

import argparse
import datetime as dt
import json
import os
import sys
import time
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)

import pandas as pd

try:
    from nba_api.stats.endpoints import playbyplayv3
except ImportError:
    sys.exit("Missing dependency. Run:  pip install nba_api pandas")

CACHE_DIR = "cache"
LOG_PATH = "audit_log.csv"
SLEEP_SECONDS = 0.8
TIMEOUT = 75
RETRIES = 3


def with_retry(label, fn):
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


def first_basket(pbp):
    """Actual first made FG of the game -> (personId, lastName, nameI, team)."""
    p1 = pbp[pbp["period"] == 1]
    made = p1[(p1["isFieldGoal"] == 1) & (p1["shotResult"].astype(str) == "Made")]
    if made.empty:
        return None
    fb = made.iloc[0]
    return {
        "personId": int(fb["personId"]),
        "name": str(fb["playerNameI"]).split(". ")[-1],
        "nameI": fb["playerNameI"],
        "team": fb["teamTricode"],
    }


def load_slate(league, date_str):
    archive = os.path.join("slates", f"slate_{league}_{date_str}.json")
    if os.path.exists(archive):
        return json.load(open(archive, encoding="utf-8"))
    live = os.path.join("..", "app", "public", "slate.json")
    if os.path.exists(live):
        slate = json.load(open(live, encoding="utf-8"))
        if slate.get("date") == date_str and slate.get("league") == league:
            return slate
    return None


def publish_audit_json(log):
    """Publish a compact settled-history file the app's LOG tab reads (mirrors
    how build_slate.py publishes slate.json). Keyed by game_id so ANY logged
    line can be settled against the actual first scorer, not just the model's
    top pick. Generated locally on a residential IP — same as slate.json."""
    out_path = os.path.join("..", "app", "public", "audit.json")
    games = {}
    for _, r in log.iterrows():
        rank = r.get("actual_board_rank")
        has_rank = pd.notna(rank) and str(rank).strip() != ""
        games[str(r["game_id"])] = {
            "date": str(r["date"]),
            "league": str(r["league"]),
            "matchup": str(r["matchup"]),
            "actualPlayerId": int(r["actual_player_id"]),
            "actualName": str(r["actual_name"]),
            "actualTeam": str(r["actual_team"]),
            "pickPlayerId": int(r["pick_player_id"]),
            "pickName": str(r["pick_name"]),
            "pickHit": int(r["hit"]),
            "actualBoardRank": int(rank) if has_rank else None,
        }
    payload = {
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "games": games,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print(f"Published {len(games)} game(s) -> {out_path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default="wnba", choices=["nba", "wnba"])
    ap.add_argument("--date", default=None, help="YYYY-MM-DD (default: yesterday ET)")
    args = ap.parse_args()

    et_now = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=4)
    date_str = args.date or (et_now.date() - dt.timedelta(days=1)).isoformat()

    slate = load_slate(args.league, date_str)
    if slate is None:
        sys.exit(f"No archived slate found for {args.league} {date_str}.\n"
                 f"(build_slate.py archives to slates/ from v0.4 on — for older "
                 f"dates, pass --date matching the live slate.json)")

    already = set()
    if os.path.exists(LOG_PATH):
        prev = pd.read_csv(LOG_PATH, dtype={"game_id": str})
        already = set(prev["game_id"])

    rows = []
    print(f"Auditing {args.league.upper()} {date_str} — {len(slate['games'])} game(s)\n")
    for g in slate["games"]:
        gid = str(g["id"])
        if gid in already:
            print(f"  {g['away']['tri']} @ {g['home']['tri']}: already graded, skipping")
            continue
        pbp = get_pbp(gid)
        if pbp is None:
            print(f"  {g['away']['tri']} @ {g['home']['tri']}: no play-by-play yet "
                  f"(game not final?) — run again later")
            continue
        actual = first_basket(pbp)
        if actual is None:
            print(f"  {g['away']['tri']} @ {g['home']['tri']}: could not extract first basket")
            continue

        pick = g["topPick"]
        hit = int(actual["personId"] == pick["playerId"])
        roster = g["rosters"]["home"] + g["rosters"]["away"]
        ranked = sorted(roster, key=lambda r: r.get("share", 0), reverse=True)
        actual_rank = next((i + 1 for i, r in enumerate(ranked)
                            if r["playerId"] == actual["personId"]), None)

        mark = "HIT ✔" if hit else "miss"
        print(f"  {g['away']['tri']} @ {g['home']['tri']}: pick {pick['name']} "
              f"(fair {pick['fairOdds']}) | actual {actual['nameI']} ({actual['team']}) "
              f"-> {mark}" + (f" (actual was board rank {actual_rank})" if actual_rank else
                              " (actual not on board)"))

        rows.append({
            "date": date_str, "league": args.league, "game_id": gid,
            "matchup": f"{g['away']['tri']}@{g['home']['tri']}",
            "pick_name": pick["name"], "pick_player_id": pick["playerId"],
            "pick_fair": pick["fairOdds"], "pick_share": pick["share"],
            "book_odds": pick.get("bookOdds") or "",
            "actual_name": actual["nameI"], "actual_player_id": actual["personId"],
            "actual_team": actual["team"], "hit": hit,
            "actual_board_rank": actual_rank if actual_rank else "",
        })

    if rows:
        df = pd.DataFrame(rows)
        header = not os.path.exists(LOG_PATH)
        df.to_csv(LOG_PATH, mode="a", header=header, index=False)
        print(f"\nAppended {len(rows)} row(s) -> {LOG_PATH}")

    if os.path.exists(LOG_PATH):
        log = pd.read_csv(LOG_PATH)
        n, hits = len(log), int(log["hit"].sum())
        on_board = log["actual_board_rank"].notna() & (log["actual_board_rank"] != "")
        print("\n" + "=" * 52)
        print(f"RUNNING AUDIT — {n} graded picks")
        print(f"  Top-pick hit rate:        {hits}/{n}  ({hits/n:.1%})")
        print(f"  Actual scorer on board:   {int(on_board.sum())}/{n}  "
              f"({on_board.mean():.1%})")
        implied = pd.to_numeric(log["pick_fair"].astype(str).str.replace("+", ""),
                                errors="coerce")
        implied = (100 / (implied + 100)).dropna()
        if len(implied):
            print(f"  Model's own expectation:  {implied.mean():.1%} per pick")
        print("=" * 52)
        print("Judge nothing before ~50 picks — variance owns small samples.")
        publish_audit_json(log)


if __name__ == "__main__":
    main()
