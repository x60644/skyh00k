"""skyh00k — same-day availability + starting fives.

Two live signals the nightly factor history can't provide on its own:

  * fetch_out_players()  — today's OUT/Doubtful list, league-wide, from ESPN's
    public injuries feed. Catches a same-day scratch (a player who suited up
    last game but is ruled out tonight — e.g. Austin Reaves) that the
    multi-game recent-absence guard in build_slate can't see.

  * last_game_starters() — each team's five starters from their most recent
    completed game's box score (nba_api START_POSITION). The best projection of
    tonight's starting five available before lineups post ~30 min pre-tip.
    Backtest: the actual first scorer is in the prior game's starting fives
    ~76% of the time. Since the first point is always scored by someone on the
    floor at the opening tip, restricting the board to starters is both what the
    UI should show and more correct for this market.

Everything here FAILS OPEN: any network/parse error returns empty/None so a
slate is never blanked by an availability hiccup. Stdlib + pandas + nba_api
only; ESPN is read over urllib with no credentials and no user data.
"""
import json
import os
import time
import unicodedata
import urllib.request
from collections import defaultdict

import pandas as pd

ESPN_INJURIES = ("https://site.api.espn.com/apis/site/v2/sports/"
                 "basketball/nba/injuries")
# ESPN team abbreviations that differ from NBA tricodes.
ESPN_TO_NBA = {"UTAH": "UTA", "GS": "GSW", "NO": "NOP", "WSH": "WAS",
               "NY": "NYK", "SA": "SAS"}
# Statuses that mean "not playing tonight". Day-To-Day / Questionable / Probable
# players usually play, so they stay on the board.
OUT_STATUSES = {"out", "doubtful"}
BOX_DIR = os.path.join("cache", "box")
TIMEOUT = 20


def _norm(s):
    """Accent-fold + lowercase + keep letters only (for cross-source matching)."""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return "".join(c for c in s.lower() if c.isalpha())


def name_key(first, last):
    """(first initial, folded last name) — stable across ESPN and NBA feeds."""
    fi = _norm(first)[:1]
    # drop generational suffixes so "Jr."/"III" never break a match
    last = " ".join(w for w in str(last).split()
                    if w.lower().strip(".") not in ("jr", "sr", "ii", "iii", "iv", "v"))
    return (fi, _norm(last))


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.load(r)


def fetch_out_players():
    """nba_tricode -> set of name_key() for players OUT/Doubtful today.
    Empty dict on any failure (fail open: no same-day gate applied)."""
    try:
        data = _get(ESPN_INJURIES)
    except Exception as e:
        print(f"  ! ESPN injuries fetch failed ({e.__class__.__name__}); "
              f"same-day OUT gate skipped")
        return {}
    out = defaultdict(set)
    for blk in data.get("injuries", []):
        for it in blk.get("injuries", []):
            if str(it.get("status", "")).strip().lower() not in OUT_STATUSES:
                continue
            ath = it.get("athlete", {})
            abbr = (ath.get("team", {}) or {}).get("abbreviation", "")
            tri = ESPN_TO_NBA.get(abbr, abbr)
            if tri:
                out[tri].add(name_key(ath.get("firstName", ""),
                                      ath.get("lastName", "")))
    return dict(out)


def _read_box(gid):
    path = os.path.join(BOX_DIR, f"box_{gid}.csv")
    if os.path.exists(path):
        return pd.read_csv(path)
    from nba_api.stats.endpoints import boxscoretraditionalv3
    try:
        df = boxscoretraditionalv3.BoxScoreTraditionalV3(
            game_id=str(gid), timeout=75).get_data_frames()[0]
    except Exception as e:
        print(f"  ! box score fetch failed for {gid} ({e.__class__.__name__})")
        return None
    os.makedirs(BOX_DIR, exist_ok=True)
    df.to_csv(path, index=False)
    time.sleep(0.8)
    return df


def last_game_starters(gid):
    """{teamTricode: {personId: 'First Last'}} for the five starters on each side
    of a completed game. START_POSITION is exactly G/F/C for starters (bench is
    blank, which survives a CSV round-trip as the string 'nan'). None on failure."""
    if not gid:
        return {}
    df = _read_box(gid)
    if df is None or "position" not in df.columns:
        return {}
    pos = df["position"].astype(str).str.strip()
    st = df[pos.isin(["G", "F", "C"])]
    out = {}
    for tri, grp in st.groupby("teamTricode"):
        out[str(tri)] = {int(r["personId"]): f"{r['firstName']} {r['familyName']}"
                         for _, r in grp.iterrows()}
    return out
