import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// WORK state — four ways to live with a project's media, switchable
// in place so they can be compared on real content:
//
//   STRIP   — one continuous filmstrip, drag/throw with inertia.
//             The frames are bound by the strip itself; calm and
//             editorial. (The dominant pattern on award sites.)
//   DECK    — a physical pile. The top frame deals away to reveal
//             the next; the images literally rest on each other.
//   FIELD   — the media as a room: a canvas larger than the screen,
//             drag to roam it. Closest to the corridor metaphor —
//             you're inside the project's space, looking around.
//   COLLAGE — frames spawning out of one another (the v13 take).
//
// The navigation stays condensed to ONE WORD (top-left) — click it
// and the corridor pours back out. Esc works too.
// ─────────────────────────────────────────────────────────────

const VIEWS = ['strip', 'deck', 'field', 'collage']

/* ── STRIP: drag-to-scroll filmstrip with native inertia ────── */
function Strip({ media }) {
  const ref = useRef(null)
  const drag = useRef(null)

  return (
    <div
      className="strip"
      ref={ref}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, left: ref.current.scrollLeft }
        ref.current.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        ref.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      {media.map((m, i) => (
        <div className="sFrame" key={i} style={{ animationDelay: `${0.3 + i * 0.13}s` }}>
          {m.type === 'video' ? (
            <video src={m.src} autoPlay muted loop playsInline />
          ) : (
            <img src={m.src} alt="" draggable={false} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ── DECK: a pile — the top frame deals away to the back ────── */
function Deck({ media }) {
  const [order, setOrder] = useState(() => media.map((_, i) => i))
  const [dealing, setDealing] = useState(null)

  useEffect(() => setOrder(media.map((_, i) => i)), [media])

  const deal = () => {
    if (dealing != null) return
    const top = order[0]
    setDealing(top)
    setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]])
      setDealing(null)
    }, 480)
  }

  return (
    <div className="deck" onClick={deal}>
      {order
        .map((mi, pos) => ({ m: media[mi], mi, pos }))
        .reverse() // deepest first in DOM, top card last
        .map(({ m, mi, pos }) => (
          <div
            key={mi}
            className={`dCard ${dealing === mi ? 'dealt' : ''}`}
            style={{
              transform: `translate(calc(-50% + ${pos * 16}px), calc(-50% + ${pos * 12}px)) rotate(${(pos % 2 ? 1 : -1) * pos * 1.4}deg)`,
              zIndex: 40 - pos,
              filter: `brightness(${1 - pos * 0.13})`,
            }}
          >
            {m.type === 'video' ? (
              <video src={m.src} autoPlay muted loop playsInline />
            ) : (
              <img src={m.src} alt="" draggable={false} />
            )}
          </div>
        ))}
      <span className="deckHint">click to deal</span>
    </div>
  )
}

/* ── FIELD: the project as a room — drag to roam the canvas ─── */
function Field({ media, width, height }) {
  const ref = useRef(null)
  const pan = useRef({ x: 0, y: 0, vx: 0, vy: 0, drag: null, raf: 0 })

  // scatter the media across a canvas ~1.7x the stage
  const spots = media.map((m, i) => {
    const h = (i * 2654435761) % 1000
    return {
      left: width * (0.18 + ((h % 100) / 100) * 1.25),
      top: height * (0.22 + (((h * 7) % 100) / 100) * 0.95),
      w: Math.min(width * (i % 2 ? 0.24 : 0.32), 470),
      portrait: i % 3 !== 1,
    }
  })

  useEffect(() => {
    const p = pan.current
    const maxX = width * 0.75
    const maxY = height * 0.55
    const step = () => {
      if (!p.drag) {
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.93
        p.vy *= 0.93
      }
      p.x = Math.max(-maxX, Math.min(0, p.x))
      p.y = Math.max(-maxY, Math.min(0, p.y))
      if (ref.current) ref.current.style.transform = `translate(${p.x}px, ${p.y}px)`
      p.raf = requestAnimationFrame(step)
    }
    p.raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(p.raf)
  }, [width, height])

  return (
    <div
      className="fieldStage"
      onPointerDown={(e) => {
        const p = pan.current
        p.drag = { x: e.clientX, y: e.clientY, px: p.x, py: p.y, lx: e.clientX, ly: e.clientY }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const p = pan.current
        if (!p.drag) return
        p.vx = e.clientX - p.drag.lx
        p.vy = e.clientY - p.drag.ly
        p.drag.lx = e.clientX
        p.drag.ly = e.clientY
        p.x = p.drag.px + (e.clientX - p.drag.x)
        p.y = p.drag.py + (e.clientY - p.drag.y)
      }}
      onPointerUp={() => (pan.current.drag = null)}
      onPointerCancel={() => (pan.current.drag = null)}
    >
      <div className="fieldPlane" ref={ref}>
        {media.map((m, i) => (
          <div
            key={i}
            className="fFrame"
            style={{
              left: spots[i].left,
              top: spots[i].top,
              width: spots[i].w,
              height: spots[i].w * (spots[i].portrait ? 1.22 : 0.72),
              animationDelay: `${0.3 + i * 0.16}s`,
            }}
          >
            {m.type === 'video' ? (
              <video src={m.src} autoPlay muted loop playsInline />
            ) : (
              <img src={m.src} alt="" draggable={false} />
            )}
          </div>
        ))}
      </div>
      <span className="deckHint">drag to roam</span>
    </div>
  )
}

/* ── COLLAGE: frames spawning out of one another (v13) ──────── */
function Collage({ media, width, height, nodeId }) {
  const [frontI, setFrontI] = useState(null)
  const sizes = [0.3, 0.21, 0.26, 0.19, 0.23]
  const aspects = [1.25, 0.74, 1.1, 0.8, 1.2]
  const rots = [-2.2, 1.8, -1.1, 2.4, -1.6]
  const items = []
  let x = width * 0.38
  let prev = null
  for (let i = 0; i < media.length; i++) {
    const w = Math.min(width * sizes[i % 5], 470)
    const h = w * aspects[i % 5]
    const y = height * 0.46 + (i % 2 ? -1 : 1) * height * 0.085 + ((i * 53) % 40) - 20
    const it = {
      x, y, w, h,
      rot: rots[i % 5],
      fromX: prev ? prev.x - x : 0,
      fromY: prev ? prev.y - y : 40,
      delay: 0.35 + i * 0.22,
    }
    items.push(it)
    prev = it
    x += w * 0.62 + 26
  }
  const last = items[items.length - 1]
  const overflow = last.x + last.w / 2 - (width - 36)
  if (overflow > 0) {
    const x0 = items[0].x
    const span = last.x - x0 || 1
    for (const it of items) it.x -= overflow * ((it.x - x0) / span)
  }

  return (
    <div className="collage">
      {media.map((m, i) => {
        const it = items[i]
        return (
          <div
            key={`${nodeId}-${i}`}
            className="cItem"
            style={{
              left: it.x,
              top: it.y,
              width: it.w,
              height: it.h,
              zIndex: frontI === i ? 50 : 10 + i,
              animationDelay: `${it.delay}s`,
              '--dx': `${it.fromX}px`,
              '--dy': `${it.fromY}px`,
              '--rot': `${it.rot}deg`,
            }}
            onClick={() => setFrontI(i)}
          >
            {m.type === 'video' ? (
              <video src={m.src} autoPlay muted loop playsInline />
            ) : (
              <img src={m.src} alt="" />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function MediaStage({ node, onClose, width, height }) {
  const [view, setView] = useState('strip')
  const media = node.media || []

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!media.length) return null

  return (
    <div className="mediaStage">
      {/* the navigation, condensed to one word — the way back */}
      <div className="workHead">
        <button className="navWord" onClick={onClose}>
          <span className="navWordHint">↩</span>
          {node.label}
        </button>
        {node.copy && <p>{node.copy}</p>}
        <span className="viewSwitch">
          {VIEWS.map((v) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </span>
      </div>

      {view === 'strip' && <Strip media={media} />}
      {view === 'deck' && <Deck media={media} />}
      {view === 'field' && <Field media={media} width={width} height={height} />}
      {view === 'collage' && (
        <Collage media={media} width={width} height={height} nodeId={node.id} />
      )}
    </div>
  )
}
