import { useState } from 'react'
import { PHYSICS as P, CASCADE as C } from './config'

// ─────────────────────────────────────────────────────────────
// The physics panel. Sliders write straight into the live tuning
// objects (config.PHYSICS / config.CASCADE) and re-kick the
// simulation, so every parameter is felt immediately. Defaults are
// captured at load for one-click reset.
// ─────────────────────────────────────────────────────────────

const PARAMS = [
  { obj: P, key: 'TYPE_SCALE', label: 'Type scale', min: 0.7, max: 2.4, step: 0.05 },
  { obj: P, key: 'CHARGE', label: 'Repulsion', min: -1200, max: -50, step: 10 },
  { obj: C, key: 'STRENGTH', label: 'Spring', min: 0.05, max: 1.2, step: 0.05 },
  { obj: P, key: 'DAMPING', label: 'Damping', min: 0.1, max: 0.7, step: 0.02 },
  { obj: P, key: 'ALPHA_KICK', label: 'Energy', min: 0.2, max: 1, step: 0.05 },
  { obj: P, key: 'DRIFT', label: 'Idle drift', min: 0, max: 0.8, step: 0.02 },
  { obj: C, key: 'LOOSE', label: 'Looseness', min: 0, max: 48, step: 2 },
  { obj: C, key: 'GAP', label: 'Rhythm', min: 26, max: 72, step: 2 },
  { obj: P, key: 'SPACING', label: 'Spacing', min: 0, max: 48, step: 2 },
  { obj: P, key: 'CURSOR', label: 'Cursor pull', min: -0.8, max: 0.8, step: 0.05 },
  { obj: P, key: 'SHOCK', label: 'Shockwave', min: 0, max: 20, step: 1 },
]

const DEFAULTS = PARAMS.map((p) => p.obj[p.key])

export default function Controls({ onTune }) {
  const [open, setOpen] = useState(true)
  // local mirror purely to re-render slider labels
  const [, setV] = useState(0)

  const set = (param, value) => {
    param.obj[param.key] = value
    setV((v) => v + 1)
    onTune()
  }

  const reset = () => {
    PARAMS.forEach((p, i) => (p.obj[p.key] = DEFAULTS[i]))
    setV((v) => v + 1)
    onTune()
  }

  return (
    <aside className={`tune ${open ? 'open' : ''}`}>
      <button className="tuneHead" onClick={() => setOpen((o) => !o)}>
        Physics {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="tuneBody">
          <div className="tuneRow tuneVariants">
            <span className="tuneLabel">Emission</span>
            {['arc', 'orbit', 'fan'].map((v) => (
              <button
                key={v}
                className={P.EMIT === v ? 'on' : ''}
                onClick={() => {
                  P.EMIT = v
                  setV((x) => x + 1)
                  onTune()
                }}
              >
                {v}
              </button>
            ))}
          </div>
          {PARAMS.map((p) => (
            <label key={p.key} className="tuneRow">
              <span className="tuneLabel">{p.label}</span>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={p.obj[p.key]}
                onChange={(e) => set(p, +e.target.value)}
              />
              <span className="tuneVal">
                {Number(p.obj[p.key]).toFixed(p.step < 1 ? 2 : 0)}
              </span>
            </label>
          ))}
          <button className="tuneReset" onClick={reset}>
            Reset
          </button>
        </div>
      )}
    </aside>
  )
}
