import { useEffect, useState } from 'react'
import { supa } from '../lib/supa.js'

const fmtET = (iso) => iso
  ? new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
  : ''

// Queues a pipeline run in Supabase; the laptop's run_watch task (every
// ~15 min) picks it up. The button can't run the pipeline itself —
// stats.nba.com blocks cloud IPs, so the run must happen on the laptop.

// A queued/running request older than this is treated as dead — the laptop
// was asleep when it was tapped, or a run died before marking itself done.
// The watcher sweeps leftover pending/running rows on its next awake pass, so
// the UI just needs to stop showing a stuck QUEUED state and free the button.
const STALE_MS = 30 * 60 * 1000

export default function RunNow() {
  const [state, setState] = useState('idle')   // idle|queued|running|err
  const [at, setAt] = useState(null)

  useEffect(() => {
    if (!supa) return
    let alive = true
    supa.from('run_requests').select('status,created_at')
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (!alive || !data || !data.length) return
        const row = data[0]
        const age = Date.now() - new Date(row.created_at).getTime()
        if (age > STALE_MS) return   // stale -> leave idle so the button frees up
        setState(row.status === 'running' ? 'running' : 'queued')
        setAt(row.created_at)
      })
    return () => { alive = false }
  }, [])

  if (!supa) return null

  async function queue() {
    if (state === 'queued' || state === 'running') return
    const { error } = await supa.from('run_requests').insert({ league: 'nba' })
    if (error) { setState('err'); return }
    setState('queued')
    setAt(new Date().toISOString())
  }

  return (
    <div className="runwrap">
      <button type="button" className={'runbtn' + (state === 'queued' || state === 'running' ? ' busy' : '')}
        onClick={queue}>
        {state === 'running' ? 'RUNNING…' : state === 'queued' ? 'QUEUED' : 'RUN NOW'}
      </button>
      {state === 'queued' && (
        <span className="runmsg">queued {fmtET(at)} ET — laptop picks it up
          within ~15 min while awake</span>
      )}
      {state === 'running' && <span className="runmsg">pipeline running on the laptop…</span>}
      {state === 'err' && <span className="runmsg">queue failed — check Supabase</span>}
    </div>
  )
}
