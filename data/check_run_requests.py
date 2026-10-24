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


def main():
    url, key = load_creds()
    if not (url and key):
        return 0
    try:
        if "--complete" in sys.argv:
            rest(url, key, "PATCH", "run_requests?status=eq.running",
                 {"status": "done"})
            return 0
        pending = rest(url, key, "GET",
                       "run_requests?status=eq.pending&select=id&limit=1")
        if not pending:
            return 0
        now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        rest(url, key, "PATCH", "run_requests?status=eq.pending",
             {"status": "running", "picked_up_at": now})
        print(f"run request claimed at {now}")
        return 3
    except Exception as e:
        # never block the scheduler on a network hiccup
        print(f"check_run_requests: skipped ({e.__class__.__name__})")
        return 0


if __name__ == "__main__":
    sys.exit(main())
