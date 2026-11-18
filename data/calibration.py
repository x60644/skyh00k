"""skyh00k — audit-calibrated fair odds.

The structured formula ranks players acceptably, but its raw probabilities are
miscalibrated (they under-sum per game and over-peak on the favorite), so
fair_odds(raw_p) ran far too long — a clear favorite priced +1200 when the book
had +450. This maps a player's board RANK to how often the actual first scorer
has historically landed at that rank (data/audit_log.csv), smoothed to a
monotone non-increasing curve via pool-adjacent-violators. The modeled players'
calibrated probabilities sum to the empirical on-board coverage (~0.72); the
rest is the off-board field.

Ranking is UNCHANGED — only the displayed fair odds and the verdict edges that
derive from them. Regenerated nightly by audit_slate after it grades.

The window starts at the roster-fix date: earlier boards ranked stale rosters
(traded players never score) and would poison the calibration.
"""
import json

import pandas as pd

SINCE = "2026-11-06"   # roster-fix cutoff; matches AUDIT_SINCE in the app
RMAX = 10              # ranks beyond this reuse the last (smallest) bucket
MIN_N = 40             # below this many graded games, don't calibrate (too noisy)


def _isotonic_decreasing(y):
    """Pool-adjacent-violators -> monotone non-increasing fit (equal weights)."""
    blocks = [[float(v), 1] for v in y]
    changed = True
    while changed:
        changed = False
        i = 0
        while i < len(blocks) - 1:
            if blocks[i][0] < blocks[i + 1][0]:          # violates non-increasing
                w = blocks[i][1] + blocks[i + 1][1]
                v = (blocks[i][0] * blocks[i][1] +
                     blocks[i + 1][0] * blocks[i + 1][1]) / w
                blocks[i] = [v, w]
                del blocks[i + 1]
                changed = True
            else:
                i += 1
    out = []
    for v, w in blocks:
        out += [v] * w
    return out


def build_calibration(log_path, out_path):
    """Read the audit log and write per-league rank->prob tables to out_path.
    Returns the tables dict (empty if there isn't enough graded history)."""
    try:
        df = pd.read_csv(log_path, dtype={"game_id": str})
    except (OSError, pd.errors.EmptyDataError):
        return {}
    df = df[df["date"] >= SINCE].copy()
    df["abr"] = pd.to_numeric(df["actual_board_rank"], errors="coerce")
    tables = {}
    for league, g in df.groupby("league"):
        n = len(g)
        if n < MIN_N:
            continue
        rates = [(g["abr"] == r).sum() / n for r in range(1, RMAX + 1)]
        iso = _isotonic_decreasing(rates)
        # drop trailing ranks never seen scoring first, so the clamp reuses the
        # last *positive* bucket instead of a 0 that would fall back to raw odds
        while len(iso) > 1 and iso[-1] == 0:
            iso.pop()
        tables[str(league)] = {
            "generated": pd.Timestamp.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "n": int(n), "since": SINCE,
            "coverage": round(sum(iso), 4),
            "ranks": {str(r + 1): round(float(iso[r]), 4) for r in range(len(iso))},
        }
    if tables:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(tables, f, ensure_ascii=False, indent=1)
    return tables


def load_calibration(path, league):
    """Return {rank(int): prob(float)} for a league, or None if unavailable."""
    try:
        d = json.load(open(path, encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    t = d.get(league)
    if not t or not t.get("ranks"):
        return None
    return {int(k): float(v) for k, v in t["ranks"].items()}


def calibrated_prob(rank, table):
    """Historical first-scorer probability for a board rank (clamped to RMAX)."""
    if not table:
        return None
    return table.get(min(rank, max(table)))
