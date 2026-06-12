import { useEffect, useRef, useState } from 'react'
import { PHYSICS as P, fsFor } from './config'
import Gallery3D from './Gallery3D'

// Media emission: at a project, the frames EMIT from the focus word —
// fanned on an arc around it (skipping the bottom, where the copy
// lives), anchored to the word's physics so they ride its sway.
// Clicking a frame sends it FULL SCREEN; the emitted frames condense
// into small index chips still adhered to the word — the image
// navigation is the same object as the site navigation.
const ARC_START = -200 // degrees
const ARC_SPAN = 220
const EMIT_R = 265 // ring radius while browsing
const CHIP_R = 150 // ring radius while an image is full screen

// Three emission versions (P.EMIT, switchable in the physics panel):
//   arc   — stable arc over the word, skipping the copy below
//   orbit — a full ring slowly revolving around the word
//   fan   — frames trailing away into the corridor's depth
function emitSlots(n, full, variant, t) {
  // chips always settle onto the stable arc — image nav stays still
  if (full || variant === 'arc') {
    const r = full ? CHIP_R : EMIT_R
    return Array.from({ length: n }, (_, i) => {
      const a =
        ((ARC_START + (n > 1 ? (i * ARC_SPAN) / (n - 1) : ARC_SPAN / 2)) * Math.PI) / 180
      return { ox: Math.cos(a) * r * 1.25, oy: Math.sin(a) * r * 0.9, z: -150 }
    })
  }
  if (variant === 'fan') {
    return Array.from({ length: n }, (_, i) => ({
      ox: 240 + i * 130,
      oy: -36 - i * 38,
      z: -110 - i * 175,
    }))
  }
  if (variant === 'tide') {
    // a slow current: frames drift past the word in lanes at different
    // depths, wrapping around — the work flows while the name holds
    const LOOP = 1280
    return Array.from({ length: n }, (_, i) => {
      const ox = ((t * 42 + i * (LOOP / n)) % LOOP) - LOOP / 2
      return {
        ox,
        oy: (i % 2 ? -1 : 1) * (105 + (i % 3) * 38) + Math.sin(t * 0.7 + i) * 14,
        z: -120 - (i % 3) * 150,
      }
    })
  }
  // orbit — full ellipse, revolving
  const spin = (t * 9 * Math.PI) / 180
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + spin
    return { ox: Math.cos(a) * EMIT_R * 1.3, oy: Math.sin(a) * EMIT_R * 0.85, z: -150 }
  })
}

// ─────────────────────────────────────────────────────────────
// 07 FOCAL — the corridor.
//
// The focus is the center of the screen; the structure recedes
// behind it in REAL z. Every level you descend pushes your past
// one step deeper down the corridor — your previous focus stays
// itself, just farther away: smaller by true perspective, blurred,
// dimmer. Children hover just in front of the focal plane. Clicking
// is dollying forward through the site; stepping back pulls the
// corridor toward you.
//
// x/y still come from the living d3 simulation (the tree keeps its
// organic sway); z comes from tree depth relative to the focus and
// eases between planes on every move. Mouse parallax swings the
// perspective origin, so deeper planes shear more — depth you feel
// constantly, no hover states required.
// ─────────────────────────────────────────────────────────────

const STEP_BACK = 410 // px of z per receded level
const STEP_FWD = 110  // children float just in front of the focal plane

export default function FocusSpace({ sim, activeId, width, height, onNavigate }) {
  const { visibleNodes, roles, byId } = sim
  const spaceRef = useRef(null)
  const [hoverId, setHoverId] = useState(null)
  const [fullI, setFullI] = useState(null) // which media is full screen

  useEffect(() => setFullI(null), [activeId])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setFullI(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // orbit and tide keep moving even when the simulation is becalmed
  const [, setSpin] = useState(0)
  useEffect(() => {
    let raf
    const loop = () => {
      if (P.EMIT === 'orbit' || P.EMIT === 'tide') setSpin((s) => s + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // parallax: deeper planes swing harder as the mouse moves
  useEffect(() => {
    const onMove = (e) => {
      const nx = e.clientX / window.innerWidth - 0.5
      const ny = e.clientY / window.innerHeight - 0.5
      if (spaceRef.current) {
        spaceRef.current.style.perspectiveOrigin = `${50 + nx * 16}% ${46 + ny * 11}%`
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const active = byId.get(activeId)
  const isLeaf = active.childIds.length === 0
  const media = isLeaf && active.media ? active.media : null
  // media-less leaves keep the corridor-end room image
  const room = !media && active?.img && isLeaf ? active : null
  const slots = media
    ? emitSlots(media.length, fullI != null, P.EMIT, performance.now() / 1000)
    : []
  const full = media && fullI != null ? media[fullI] : null

  const fsOf = (role) =>
    role === 'active'
      ? fsFor('active', active.label, width)
      : role === 'parent'
        ? 38 // ancestors keep former-focus size — perspective shrinks them
        : role === 'child'
          ? fsFor('child')
          : role === 'sibling'
            ? 15
            : 13

  // at a leaf with media, clicking the focus word closes the full
  // image first; a second click steps back up as usual
  const clickNode = (n) => {
    if (n.id === activeId && full) {
      setFullI(null)
      return
    }
    onNavigate(n)
  }

  return (
    <>
      {/* the WORK gallery: the strip of frames in WebGL, shader bending
          with throw velocity; the nav stays drawn above it */}
      {full && (
        <Gallery3D
          key={`gl-${activeId}`}
          media={media}
          startIndex={fullI}
          width={width}
          height={height ?? window.innerHeight}
          onIndex={(i) => setFullI(i)}
        />
      )}

    <div className="focusSpace" ref={spaceRef}>
      {/* the end of the corridor: a leaf's image, deepest plane */}
      {room && (
        <img key={`room-${room.id}`} className="froomImg" src={room.img} alt="" />
      )}

      {/* the work's frames, emitted from the focus word itself */}
      {media && active.x != null && (
        <div
          className="emitWrap"
          style={{ transform: `translate3d(${active.x}px, ${active.y}px, 0)` }}
        >
          {media.map((m, i) => {
            const s = slots[i]
            const big = i % 2 === 0
            const w = full ? 64 : big ? 200 : 160
            const h = full ? 64 : w * (big ? 1.24 : 0.78)
            return (
              <div
                key={`${activeId}-em-${i}`}
                className={`eFrame ${fullI === i ? 'current' : ''} ${P.EMIT === 'tide' && fullI == null ? 'flow' : ''}`}
                style={{
                  width: w,
                  height: h,
                  zIndex: 20 + i,
                  transform: `translate(calc(-50% + ${s.ox}px), calc(-50% + ${s.oy}px)) translateZ(${s.z}px)`,
                  animationDelay: `${0.25 + i * 0.14}s`,
                }}
                onClick={() => setFullI(i)}
              >
                {m.type === 'video' ? (
                  <video src={m.src} autoPlay muted loop playsInline />
                ) : (
                  <img src={m.src} alt="" draggable={false} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {visibleNodes.map((n) => {
        if (n.x == null) return null
        const role = roles.get(n.id)
        // plane = tree depth relative to the focus: your past recedes
        const plane = Math.max(-3, Math.min(1, n.depth - active.depth))
        const z = plane >= 0 ? plane * STEP_FWD : plane * STEP_BACK
        const blur = plane < 0 ? -plane * 1.7 : 0
        const opacity =
          plane < 0
            ? Math.max(0.3, 1 + plane * 0.26)
            : role === 'active'
              ? 1
              : 0.92

        return (
          <div
            key={n.id}
            className="fnode"
            style={{ transform: `translate3d(${n.x}px, ${n.y}px, 0)` }}
          >
            <div
              className="fnodeInner"
              style={{
                transform: `translateZ(${z}px)`,
                filter: blur ? `blur(${blur}px)` : 'none',
                opacity,
              }}
            >
              <span
                data-node={n.id}
                className={`flabel ${role === 'active' ? 'activeL' : ''} ${hoverId === n.id ? 'hot' : ''}`}
                style={{ fontSize: fsOf(role) }}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => clickNode(n)}
              >
                {n.label}
              </span>
            </div>
          </div>
        )
      })}

      {/* the focus carries its copy on the focal plane */}
      {active?.copy && active.x != null && !full && (
        <div
          key={activeId}
          className="fcopy"
          style={{
            transform: `translate3d(${active.x}px, ${active.y + fsOf('active') * 0.62 + 16}px, 0) translateX(-50%)`,
          }}
        >
          {active.copy}
        </div>
      )}
    </div>
    </>
  )
}
