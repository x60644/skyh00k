"""
skyh00k — run-now watcher helper (stdlib only, fail-quiet)
==========================================================
Called by run_watch.bat every ~15 minutes. Checks the Supabase
run_requests table for a pending "run now" tapped in the app.

Exit codes:
  0  nothing to do (no pending request, or Supabase not configured)
  3  pending request found and claimed -> the bat should run run_daily.bat

Modes:
  python check_run_requests.py             # claim pending -> exit 3
  python check_run_requests.py --complete  # mark running -> done

Credentials: SUPABASE_URL / SUPABASE_KEY env vars, or data/supabase.env
(gitignored, KEY=VALUE lines — same values as the Vercel env vars).
"""

import datetime as dt
import json
import os
import sys
import urllib.request


def load_creds():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if url and key:
        return url, key
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "supabase.env")
    if os.path.exists(env_path):
        vals = {}
        for line in open(env_path, encoding="utf-8"):
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip()
        return vals.get("SUPABASE_URL"), vals.get("SUPABASE_KEY")
    return None, None


def rest(url, key, method, path, body=None):
    req = urllib.request.Request(
        url.rstrip("/") + "/rest/v1/" + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            "apikey": key, "Authorization": f"Bearer {key}",
            "Content-Type": "application/json", "Prefer": "return=representation",
        })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode() or "[]")


# A pending request older than this is abandoned (the laptop was asleep when
# it was tapped) — retire it instead of firing a surprise pipeline run hours
# or days later. Mirrors the app's own stale-request handling.
STALE_MINUTES = 60


def parse_ts(s):
    try:
        return dt.datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def main():
    url, key = load_creds()
    if not (url and key):
        # loud on purpose — a missing data/supabase.env is why the RUN NOW
        # button silently never gets picked up (run_watch redirects us to nul,
        # so it also checks for the file and logs the warning itself).
        print("check_run_requests: no Supabase creds (data/supabase.env missing)")
        return 0
    try:
        if "--complete" in sys.argv:
            rest(url, key, "PATCH", "run_requests?status=eq.running",
                 {"status": "done"})
            return 0
        pending = rest(url, key, "GET",
                       "run_requests?status=eq.pending&select=id,created_at"
                       "&order=created_at.asc")
        if not pending:
            return 0
        now = dt.datetime.now(dt.timezone.utc)
        fresh, stale = [], []
        for r in pending:
            ts = parse_ts(r.get("created_at", ""))
            age_min = (now - ts).total_seconds() / 60 if ts else 1e9
            (stale if age_min > STALE_MINUTES else fresh).append(r["id"])
        if stale:
            ids = ",".join(str(i) for i in stale)
            rest(url, key, "PATCH", f"run_requests?id=in.({ids})",
                 {"status": "done"})
            print(f"retired {len(stale)} stale run request(s)")
        if not fresh:
            return 0
        ids = ",".join(str(i) for i in fresh)
        stamp = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        rest(url, key, "PATCH", f"run_requests?id=in.({ids})",
             {"status": "running", "picked_up_at": stamp})
        print(f"claimed {len(fresh)} run request(s) at {stamp}")
        return 3
    except Exception as e:
        # never block the scheduler on a network hiccup
        print(f"check_run_requests: skipped ({e.__class__.__name__}: {e})")
        return 0


if __name__ == "__main__":
    sys.exit(main())
