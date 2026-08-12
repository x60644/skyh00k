"""Print the first period-1 rows of one cached game so we can see
exactly how PlayByPlayV3 formats the opening jump ball.
Run from the data folder AFTER phase0_explore has cached games:
    python debug_tip.py
"""
import glob
import pandas as pd

files = sorted(glob.glob("cache/pbp3_*.csv"))
if not files:
    raise SystemExit("No cached play-by-play files found. Run phase0_explore.py first.")

pbp = pd.read_csv(files[0])
print(f"File: {files[0]}")
print(f"Columns: {list(pbp.columns)}\n")

p1 = pbp[pbp["period"] == 1].head(12)
cols = [c for c in ["actionNumber", "actionType", "subType", "description",
                    "playerNameI", "teamTricode", "isFieldGoal", "shotResult"]
        if c in pbp.columns]
pd.set_option("display.width", 200)
pd.set_option("display.max_colwidth", 80)
print(p1[cols].to_string(index=False))
