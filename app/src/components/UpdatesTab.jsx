import { MODEL_UPDATES } from '../data/modelUpdates.js'

// tag -> display label + style class (colors defined in styles.css)
const TAGS = {
  FIX:         'u-fix',
  DATA:        'u-data',
  MARKET:      'u-market',
  CALIBRATION: 'u-cal',
  DIAGNOSTIC:  'u-diag',
  PENDING:     'u-pending',
}

const fmtDate = (d) => d === 'next'
  ? 'NEXT'
  : new Date(d + 'T12:00:00').toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric' })

export default function UpdatesTab() {
  return (
    <section className="updates">
      <div className="updintro">
        <h2>Model updates</h2>
        <p>How the first-point model is being refined against live audit
          results — newest first. Each change is driven by what the graded
          picks actually show.</p>
      </div>
      <ol className="utimeline">
        {MODEL_UPDATES.map((u, i) => {
          const cls = TAGS[u.tag] || ''
          return (
            <li key={i} className={'uitem ' + cls}>
              <div className="uhead">
                <span className={'utag ' + cls}>{u.tag}</span>
                <span className="udate">{fmtDate(u.date)}</span>
                {u.version && <span className="uver">{u.version}</span>}
              </div>
              <h3 className="utitle">{u.title}</h3>
              <p className="udetail">{u.detail}</p>
              {u.result && <p className="uresult">{u.result}</p>}
            </li>
          )
        })}
      </ol>
      <p className="updfoot">
        Model picks are tracked on the AUDIT tab; the formula itself is broken
        down on the MODEL tab.
      </p>
    </section>
  )
}
