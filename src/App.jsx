import { useEffect, useRef, useState } from 'react'
import Graph from './Graph'
import DustMode from './DustMode'
import FocusSpace from './FocusSpace'
import MediaStage from './MediaStage'
import Controls from './Controls'
import { useSimulation } from './useSimulation'
import { ancestorsOf } from './layout'
import { NAV } from './data'

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
  { key: 'type', label: '01 ORGANIC' },
  { key: 'orbs', label: '02 ORBS' },
  { key: 'structure', label: '03 STRUCTURE' },
  { key: 'imagery', label: '04 IMAGERY' },
  { key: 'depth', label: '05 DEPTH' },
  { key: 'dust', label: '06 DUST' },
  { key: 'focus', label: '07 FOCAL' },
]

export default function App() {
  const [activeId, setActiveId] = useState(INITIAL_FOCUS)
  const [mode, setMode] = useState('focus')
  // bumped by the physics panel — re-kicks the simulation with the
  // freshly tuned parameters
  const [tuneV, setTuneV] = useState(0)

  // FOCAL expand/contract: arriving at a piece of WORK (a leaf with a
  // media set) lets the corridor settle, then contracts the nav into a
  // live miniature while the media takes the stage. Navigating
  // anywhere else expands it back.
  const [engaged, setEngaged] = useState(false)
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })

  // Responsive: measure immediately, then track the container — the
  // centering forces follow whatever size the stage becomes.
  useEffect(() => {
    const el = containerRef.current
    const rect = el.getBoundingClientRect()
    setDims({ width: rect.width, height: rect.height })
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setDims({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sim = useSimulation(activeId, dims.width, dims.height, mode, tuneV)

  const activeNode = sim.byId.get(activeId)
  useEffect(() => {
    if (mode !== 'focus' || !activeNode?.media) {
      setEngaged(false)
      return
    }
    const t = setTimeout(() => setEngaged(true), 900)
    return () => clearTimeout(t)
  }, [activeId, mode, activeNode])

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
      className="stage"
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
        (mode === 'dust' ? (
          <DustMode
            byId={sim.byId}
            activeId={activeId}
            width={dims.width}
            height={dims.height}
            onNavigate={navigate}
            tuneV={tuneV}
          />
        ) : mode === 'focus' ? (
          <>
            <FocusSpace
              sim={sim}
              activeId={activeId}
              width={dims.width}
              mini={engaged}
              onNavigate={navigate}
            />
            {engaged && activeNode?.media && (
              <MediaStage
                node={activeNode}
                width={dims.width}
                height={dims.height}
                onClose={() => setEngaged(false)}
              />
            )}
          </>
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
          CLICK A NODE TO NAVIGATE — CLICK THE FOCUS TO STEP BACK
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
