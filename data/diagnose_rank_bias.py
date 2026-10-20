"""
skyh00k — rank-bias diagnostic (offline, no network)
====================================================
Investigates the 0-for-N top-pick streak. Reads audit_log.csv plus the
archived slates in slates/ and reports:

  1. Where actual first-basket scorers land on the board (hit rate by rank)
  2. Actual hits vs the model's own predicted probabilities (binomial check)
  3. Whether top picks systematically carry thinner first-attempt samples
     than ranks 2-3 (the suspected small-sample crowning bias)
  4. Share vs outcome: do higher-share picks actually hit more?

Report only — makes no changes. Run from the data folder:
    python diagnose_rank_bias.py
"""

import glob
import json
import math
import os

import pandas as pd

LOG_PATH = "audit_log.csv"
SLATES_GLOB = os.path.join("slates", "slate_*.json")


def binom_p_zero(probs):
    """P(zero hits) if every pick independently hit at its model prob."""
    out = 1.0
    for p in probs:
        out *= (1 - p)
    return out


def main():
    if not os.path.exists(LOG_PATH):
        raise SystemExit("No audit_log.csv found — run audit_slate.py first.")
    log = pd.read_csv(LOG_PATH, dtype={"game_id": str})
    n = len(log)
    hits = int(log["hit"].sum())
    print("=" * 60)
    print(f"RANK-BIAS DIAGNOSTIC — {n} graded picks, {hits} top-pick hits")
    print("=" * 60)

    # ---- 1. actual scorer's board rank distribution ----
    rank = pd.to_numeric(log["actual_board_rank"], errors="coerce")
    on_board = rank.notna()
    print(f"\n1) WHERE THE ACTUAL SCORER LANDED (board = 10 shown players)")
    print(f"   On board: {int(on_board.sum())}/{n} ({on_board.mean():.0%})  "
          f"off board: {int((~on_board).sum())}")
    dist = rank.value_counts().sort_index()
    for r, c in dist.items():
        bar = "#" * int(c)
        print(f"   rank {int(r):>2}: {int(c):>2}  {bar}")
    if on_board.any():
        print(f"   Mean rank when on board: {rank.mean():.1f}  "
              f"(uniform-over-board would be ~5.5)")
        top3 = (rank <= 3).sum()
        print(f"   Scorer in board top-3: {int(top3)}/{n} ({top3/n:.0%})")

    # ---- 2. model's own expectation vs reality ----
    fair = pd.to_numeric(log["pick_fair"].astype(str).str.replace("+", "", regex=False),
                         errors="coerce")
    probs = (100 / (fair + 100)).dropna()
    exp_hits = probs.sum()
    p0 = binom_p_zero(probs)
    print(f"\n2) MODEL EXPECTATION VS REALITY")
    print(f"   Model's own mean pick prob: {probs.mean():.1%}")
    print(f"   Expected hits at model probs: {exp_hits:.1f}   Actual: {hits}")
    print(f"   P(zero hits | model is right): {p0:.2%}")
    verdict = ("VARIANCE-PLAUSIBLE" if p0 > 0.05 else
               "IMPROBABLE — model probabilities and/or pick selection are off")
    print(f"   Verdict: {verdict}")

    # ---- 3 & 4. pull per-pick features from archived slates ----
    recs = []
    for path in sorted(glob.glob(SLATES_GLOB)):
        try:
            slate = json.load(open(path, encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        for g in slate.get("games", []):
            roster = (g["rosters"]["home"] + g["rosters"]["away"])
            ranked = sorted(roster, key=lambda r: r.get("share", 0), reverse=True)
            for i, r in enumerate(ranked):
                recs.append({
                    "game_id": str(g["id"]), "rank": i + 1,
                    "playerId": r.get("playerId"), "share": r.get("share", 0),
                    "fg": r.get("fg"), "att": r.get("att"),
                    "thin": r.get("thin"),
                    "is_pick": bool(r.get("hot")),
                })
    board = pd.DataFrame(recs)
    if board.empty or "att" not in board.columns:
        print("\n(archived slates carry no att/thin fields — skipping 3 & 4)")
        return
    board = board.merge(
        log[["game_id", "actual_player_id", "hit"]], on="game_id", how="inner")
    board["scored"] = board["playerId"] == board["actual_player_id"]
    graded = board[board["att"].notna()]

    print(f"\n3) SAMPLE THINNESS BY BOARD RANK (graded games only)")
    for r in (1, 2, 3, 4, 5):
        seg = graded[graded["rank"] == r]
        if seg.empty:
            continue
        print(f"   rank {r}: mean first-att sample {seg['att'].mean():4.1f}, "
              f"thin(<3 att) {seg['thin'].mean():.0%}, "
              f"mean share {seg['share'].mean():4.1f}%, "
              f"scored-first rate {seg['scored'].mean():.0%}  (n={len(seg)})")
    picks = graded[graded["is_pick"]]
    r23 = graded[graded["rank"].isin([2, 3])]
    if not picks.empty and not r23.empty:
        print(f"\n   Top picks:  mean att {picks['att'].mean():.1f}, "
              f"thin {picks['thin'].mean():.0%}")
        print(f"   Ranks 2-3:  mean att {r23['att'].mean():.1f}, "
              f"thin {r23['thin'].mean():.0%}")
        thinner = picks["att"].mean() < r23["att"].mean()
        print(f"   Thin-crowning bias: "
              f"{'CONFIRMED — picks carry thinner samples' if thinner else 'not supported'}")

    print(f"\n4) SHARE VS OUTCOME (does displayed share predict scoring first?)")
    for lo, hi in ((0, 14), (15, 29), (30, 44), (45, 100)):
        seg = graded[(graded["share"] >= lo) & (graded["share"] <= hi)]
        if len(seg) < 5:
            continue
        print(f"   share {lo:>2}-{hi:<3}%: scored-first {seg['scored'].mean():5.1%} "
              f"over n={len(seg)} player-games")
    print("\nReport only — no model changes made. Discuss before surgery.")


if __name__ == "__main__":
    main()
