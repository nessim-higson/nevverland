import { useEffect, useRef, useState } from 'react'
import { PHYSICS as P, CASCADE as C } from './config'
import { ancestorsOf } from './layout'

// ─────────────────────────────────────────────────────────────
// 06 DUST — the site is a single substance.
//
// A fixed pool of particles IS the navigation. The same dust forms
// every word: on navigation the letters disintegrate, swarm, and
// condense into the next level's type. Nothing is ever added or
// removed — the material reorganizes. Spare particles live as
// ambient grain; the cursor wades through and the dust parts;
// clicks detonate through the field.
//
// Self-contained canvas engine (the d3 sim is parked in this mode):
// targets are sampled from rasterized Helvetica, particles are
// springs, and several panel dials map straight onto it —
// Spring → stiffness, Damping → drag, Idle drift → grain energy,
// Cursor pull → wake radius, Shockwave → click detonation.
// ─────────────────────────────────────────────────────────────

const POOL = 3400 // total particles — constant for the whole session

/** Flush-left layout for the current focus (positions + font sizes). */
function buildLayout(activeId, byId, W, H) {
  const a = byId.get(activeId)
  const trail = ancestorsOf(activeId, byId).reverse()
  const X = Math.max(70, W * 0.14)
  let y = Math.max(90, H * 0.18)
  const items = []

  for (const id of trail) {
    items.push({ node: byId.get(id), fs: 15, weight: 400, x: X, y, alpha: 0.4 })
    y += 30
  }
  y += 46

  const afs = Math.min(126, (W * 0.6) / (a.label.length * 0.6))
  items.push({ node: a, fs: afs, weight: 700, x: X, y, alpha: 1 })
  y += afs * 0.28 + 26

  const copyY = a.copy ? y : null
  if (a.copy) y += Math.min(150, Math.ceil(a.copy.length / 48) * 21 + 30)
  y += 24

  for (const cid of a.childIds) {
    items.push({ node: byId.get(cid), fs: 30, weight: 400, x: X, y, alpha: 0.85 })
    y += 54
  }
  if (a.parentId) {
    y += 20
    for (const sid of byId.get(a.parentId).childIds) {
      if (sid === activeId) continue
      items.push({ node: byId.get(sid), fs: 15, weight: 400, x: X, y, alpha: 0.35 })
      y += 28
    }
  }
  return { items, copyY, X }
}

/** Rasterize the layout's type and sample it into particle targets. */
function sampleTargets(items, W, H) {
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const ctx = off.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'alphabetic'

  const boxes = []
  for (const it of items) {
    ctx.font = `${it.weight} ${it.fs}px 'Helvetica Neue', Helvetica, Arial, sans-serif`
    ctx.fillText(it.node.label, it.x, it.y)
    const w = ctx.measureText(it.node.label).width
    boxes.push({ node: it.node, x: it.x, y: it.y - it.fs, w, h: it.fs * 1.25 })
  }

  const data = ctx.getImageData(0, 0, W, H).data
  const targets = []
  for (const it of items) {
    // adaptive sampling density: huge glyphs don't need every pixel
    const step = it.fs > 60 ? 5 : it.fs > 22 ? 4 : 2
    const w = Math.ceil(boxes.find((b) => b.node === it.node).w)
    const x0 = Math.floor(it.x)
    const y0 = Math.floor(it.y - it.fs * 1.05)
    for (let y = y0; y < it.y + it.fs * 0.3; y += step) {
      for (let x = x0; x < x0 + w + 2; x += step) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue
        if (data[(y * W + x) * 4] > 120) {
          targets.push({ x, y, alpha: it.alpha, id: it.node.id })
        }
      }
    }
  }
  return { targets, boxes }
}

export default function DustMode({ byId, activeId, width, height, onNavigate, tuneV }) {
  const canvasRef = useRef(null)
  const state = useRef(null)
  const [hoverId, setHoverId] = useState(null)
  const [copy, setCopy] = useState(null)

  // particle pool — created once, lives for the whole session
  if (!state.current) {
    state.current = {
      parts: Array.from({ length: POOL }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: 0,
        vy: 0,
        a: 0.1, // current alpha, eases toward its role
        ta: 0.12,
        tx: null,
        ty: null,
        id: null,
      })),
      boxes: [],
      mouse: { x: -9999, y: -9999 },
      click: null,
      hover: null,
    }
  }

  // Re-target the dust whenever the focus (or stage size) changes:
  // every word's pixels become destinations, randomly dealt across the
  // pool so the swarm crosses itself mid-flight.
  useEffect(() => {
    if (!width || !height) return
    const s = state.current
    const active = byId.get(activeId)
    const { items, copyY, X } = buildLayout(activeId, byId, width, height)
    const { targets, boxes } = sampleTargets(items, width, height)
    s.boxes = boxes
    setCopy(active.copy && copyY ? { text: active.copy, x: X, y: copyY } : null)

    // shuffle targets, deal one per particle; the rest become free grain
    for (let i = targets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[targets[i], targets[j]] = [targets[j], targets[i]]
    }
    s.parts.forEach((p, i) => {
      const t = targets[i % POOL] && i < targets.length ? targets[i] : null
      if (t) {
        p.tx = t.x
        p.ty = t.y
        p.ta = t.alpha
        p.id = t.id
      } else {
        p.tx = null
        p.ty = null
        p.ta = 0.1
        p.id = null
      }
    })

    // click detonation — the impulse the new structure condenses out of
    if (s.click && P.SHOCK > 0) {
      for (const p of s.parts) {
        const dx = p.x - s.click.x
        const dy = p.y - s.click.y
        const d = Math.hypot(dx, dy) || 1
        const imp = P.SHOCK * 0.9 * Math.min(1, 260 / d)
        p.vx += (dx / d) * imp
        p.vy += (dy / d) * imp
      }
      s.click = null
    }
  }, [activeId, width, height, byId, tuneV])

  // The engine: spring → target, drag, grain energy, cursor wake.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !width || !height) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    let raf
    const tick = () => {
      const s = state.current
      const stiff = 0.02 + C.STRENGTH * 0.09 // Spring dial
      const drag = 1 - (0.06 + P.DAMPING * 0.16) // Damping dial
      const grain = P.DRIFT * 0.5 // Idle drift dial
      const wakeR = 60 + Math.abs(P.CURSOR) * 120 // Cursor dial
      const wakeK = (P.CURSOR >= 0 ? -1 : 1) * (0.4 + Math.abs(P.CURSOR))

      ctx.clearRect(0, 0, width, height)

      for (const p of s.parts) {
        if (p.tx != null) {
          p.vx += (p.tx - p.x) * stiff
          p.vy += (p.ty - p.y) * stiff
        } else {
          // free grain — slow brownian wander, eased back on screen
          p.vx += (Math.random() - 0.5) * grain
          p.vy += (Math.random() - 0.5) * grain
          if (p.x < 0 || p.x > width) p.vx += p.x < 0 ? 0.4 : -0.4
          if (p.y < 0 || p.y > height) p.vy += p.y < 0 ? 0.4 : -0.4
        }

        // the cursor wades through the dust
        const mdx = p.x - s.mouse.x
        const mdy = p.y - s.mouse.y
        const md = Math.hypot(mdx, mdy)
        if (md < wakeR && md > 0.5) {
          const k = ((wakeR - md) / wakeR) * wakeK
          p.vx -= (mdx / md) * k
          p.vy -= (mdy / md) * k
        }

        p.vx *= drag
        p.vy *= drag
        p.x += p.vx
        p.y += p.vy

        // alpha eases toward role; hovered word's dust brightens
        const boost = p.id && p.id === s.hover ? 1.35 : 1
        p.a += (Math.min(1, p.ta * boost) - p.a) * 0.08

        ctx.globalAlpha = p.a
        ctx.fillStyle = '#eaeaea'
        ctx.fillRect(p.x, p.y, 1.7, 1.7)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [width, height])

  const hit = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    return state.current.boxes.find(
      (b) => x >= b.x - 8 && x <= b.x + b.w + 12 && y >= b.y - 6 && y <= b.y + b.h
    )
  }

  const active = byId.get(activeId)
  const room = active?.img && active.childIds.length === 0 ? active : null

  return (
    <div className="dustWrap">
      {room && (
        <div className="stagefield">
          <img key={room.id} className="roomImg" src={room.img} alt="" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="dust"
        style={{ width, height, cursor: hoverId ? 'pointer' : 'default' }}
        onMouseMove={(e) => {
          const r = canvasRef.current.getBoundingClientRect()
          state.current.mouse.x = e.clientX - r.left
          state.current.mouse.y = e.clientY - r.top
          const b = hit(e)
          state.current.hover = b ? b.node.id : null
          setHoverId(b ? b.node.id : null)
        }}
        onMouseLeave={() => {
          state.current.mouse.x = -9999
          state.current.mouse.y = -9999
          state.current.hover = null
          setHoverId(null)
        }}
        onClick={(e) => {
          const b = hit(e)
          if (!b) return
          const r = canvasRef.current.getBoundingClientRect()
          state.current.click = { x: e.clientX - r.left, y: e.clientY - r.top }
          onNavigate(b.node)
        }}
      />
      {copy && (
        <p key={activeId} className="nodeCopy dustCopy" style={{ left: copy.x, top: copy.y }}>
          {copy.text}
        </p>
      )}
    </div>
  )
}
