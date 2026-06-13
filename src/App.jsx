import { useEffect, useRef, useState } from 'react'
import Graph from './Graph'
import FocusSpace from './FocusSpace'
import RingsSpace from './RingsSpace'
import WeightSpace from './WeightSpace'
import RevealSpace from './RevealSpace'
import Controls from './Controls'
import { useSimulation } from './useSimulation'
import { ancestorsOf } from './layout'
import { NAV } from './data'
import { PHYSICS } from './config'

// Shrink type + geometry together as the viewport narrows, so the whole
// spatial composition fits a phone. ~1 above 1080px, ~0.5 on a 375 phone.
function viewportScale(w) {
  return Math.max(0.5, Math.min(1, (w - 80) / 1000))
}

// Which node has focus when the page loads (any id from data.js).
const INITIAL_FOCUS = NAV.id

// Four experiments on ONE living navigation model — all four share the
// force simulation; they differ only in what gets drawn:
//   organic   — the type cascade, connecting threads visible
//   orbs      — the circle constellation, threads visible
//   structure — the same organism with INVISIBLE connections + copy
//               blocks riding the focus
//   imagery   — structure + project stills springing forth in Z space
const MODES = [
  { key: 'focus', label: '01 FOCAL' },
  { key: 'type', label: '02 ORGANIC' },
  { key: 'orbs', label: '03 ORBS' },
  { key: 'structure', label: '04 STRUCTURE' },
  { key: 'imagery', label: '05 IMAGERY' },
  { key: 'depth', label: '06 DEPTH' },
  { key: 'rings', label: '07 RINGS' },
  { key: 'weight', label: '08 WEIGHT' },
  { key: 'reveal', label: '09 REVEAL' },
]

export default function App() {
  const [activeId, setActiveId] = useState(INITIAL_FOCUS)
  const [mode, setMode] = useState('focus')
  // bumped by the physics panel — re-kicks the simulation with the
  // freshly tuned parameters
  const [tuneV, setTuneV] = useState(0)
  // presentation mode — hide all chrome for clean capture (press H)
  const [bare, setBare] = useState(false)
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'h' || e.key === 'H') setBare((b) => !b)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Responsive: measure immediately, then track the container — the
  // centering forces follow whatever size the stage becomes.
  useEffect(() => {
    const el = containerRef.current
    const rect = el.getBoundingClientRect()
    PHYSICS.VIEWPORT_SCALE = viewportScale(rect.width)
    setDims({ width: rect.width, height: rect.height })
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      PHYSICS.VIEWPORT_SCALE = viewportScale(width)
      setDims({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sim = useSimulation(activeId, dims.width, dims.height, mode, tuneV)

  // Cross-window sync (also handy as a dev/debug hook): navigating in
  // one window steers every other open window via localStorage events.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'fb-nav' && e.newValue && sim.byId.has(e.newValue)) {
        setActiveId(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [sim.byId])

  // Click a node → focus it. Click the focus again → step back up.
  const navigate = (node) => {
    const next = node.id === activeId ? node.parentId : node.id
    if (!next) return
    setActiveId(next)
    try {
      localStorage.setItem('fb-nav', next)
    } catch {
      /* private mode etc. — sync is best-effort */
    }
  }

  const trail = [activeId, ...ancestorsOf(activeId, sim.byId)]
    .reverse()
    .map((id) => sim.byId.get(id).label)

  return (
    <div
      className={`stage ${bare ? 'bare' : ''}`}
      ref={containerRef}
      onMouseMove={(e) => {
        // feeds the cursor-gravity force — mutation only, no re-render
        sim.pointer.x = e.clientX
        sim.pointer.y = e.clientY
      }}
      onMouseLeave={() => {
        sim.pointer.x = null
        sim.pointer.y = null
      }}
    >
      {dims.width > 0 &&
        (mode === 'reveal' ? (
          <RevealSpace
            byId={sim.byId}
            activeId={activeId}
            width={dims.width}
            height={dims.height}
            onNavigate={navigate}
          />
        ) : mode === 'focus' ? (
          <FocusSpace
            sim={sim}
            activeId={activeId}
            width={dims.width}
            height={dims.height}
            onNavigate={navigate}
          />
        ) : mode === 'rings' ? (
          <RingsSpace
            sim={sim}
            activeId={activeId}
            width={dims.width}
            height={dims.height}
            onNavigate={navigate}
          />
        ) : mode === 'weight' ? (
          <WeightSpace
            sim={sim}
            activeId={activeId}
            width={dims.width}
            onNavigate={navigate}
          />
        ) : (
          <Graph
            width={dims.width}
            height={dims.height}
            sim={sim}
            activeId={activeId}
            mode={mode}
            onNavigate={navigate}
          />
        ))}

      <Controls onTune={() => setTuneV((v) => v + 1)} />

      <header className="chrome top">
        <span className="wordmark">NEVVERLAND</span>
        <span className="trail">{trail.join('  /  ')}</span>
      </header>
      <footer className="chrome bottom">
        <span className="hint">
          CLICK TO GO DEEPER — CLICK THE SPACE TO GO BACK — H FOR CLEAN VIEW
        </span>
        <span className="switch">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={mode === m.key ? 'on' : ''}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </span>
      </footer>
    </div>
  )
}
