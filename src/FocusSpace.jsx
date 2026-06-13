import { useEffect, useRef, useState } from 'react'
import { PHYSICS as P, fsFor } from './config'
import Gallery3D from './Gallery3D'
import { ancestorsOf } from './layout'

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
function emitSlots(n, full, variant, t, vs = 1) {
  // chips always settle onto the stable arc — image nav stays still
  if (full || variant === 'arc') {
    const r = (full ? CHIP_R : EMIT_R) * vs
    return Array.from({ length: n }, (_, i) => {
      const a =
        ((ARC_START + (n > 1 ? (i * ARC_SPAN) / (n - 1) : ARC_SPAN / 2)) * Math.PI) / 180
      return { ox: Math.cos(a) * r * 1.25, oy: Math.sin(a) * r * 0.9, z: -150 }
    })
  }
  if (variant === 'fan') {
    return Array.from({ length: n }, (_, i) => ({
      ox: (240 + i * 130) * vs,
      oy: (-36 - i * 38) * vs,
      z: -110 - i * 175,
    }))
  }
  if (variant === 'tide') {
    // a slow current: frames drift past the word in lanes at different
    // depths, wrapping around — the work flows while the name holds
    const LOOP = 1280 * vs
    return Array.from({ length: n }, (_, i) => {
      const ox = ((t * 42 + i * (LOOP / n)) % LOOP) - LOOP / 2
      return {
        ox,
        oy: ((i % 2 ? -1 : 1) * (105 + (i % 3) * 38) + Math.sin(t * 0.7 + i) * 14) * vs,
        z: -120 - (i % 3) * 150,
      }
    })
  }
  // orbit — full ellipse, revolving
  const spin = (t * 9 * Math.PI) / 180
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + spin
    return { ox: Math.cos(a) * EMIT_R * 1.3 * vs, oy: Math.sin(a) * EMIT_R * 0.85 * vs, z: -150 }
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
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      const a = byId.get(activeId)
      if (a?.parentId) onNavigate(byId.get(a.parentId)) // Esc = back out
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeId, byId, onNavigate])

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
  const vs = P.VIEWPORT_SCALE
  const slots = media
    ? emitSlots(media.length, fullI != null, P.EMIT, performance.now() / 1000, vs)
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

  // THE SPATIAL LAW: click a node to go deeper, click the VOID to back
  // out one level (the world pulls back, the parent rushes to center).
  const onVoid = (e) => {
    if (e.target.closest('.flabel, .eFrame, .froomImg')) return // hit a node
    if (full) {
      setFullI(null)
      return
    }
    if (active.parentId) onNavigate(byId.get(active.parentId))
  }

  // WORK VIEW: you've arrived at an actual piece of work. The navigation
  // steps aside — the focus word + path demote to a quiet corner header —
  // and the imagery takes the stage as the hero.
  const workView = !!media
  const trail = ancestorsOf(activeId, byId).reverse().map((id) => byId.get(id))

  return (
    <>
      {workView && (
        <Gallery3D
          key={`gl-${activeId}`}
          media={media}
          startIndex={fullI ?? 0}
          width={width}
          height={height ?? window.innerHeight}
          onIndex={(i) => setFullI(i)}
        />
      )}

    <div
      className="focusSpace"
      ref={spaceRef}
      onClick={onVoid}
      style={{ pointerEvents: workView ? 'none' : 'auto' }}
    >
      {/* WORK VIEW: nav demoted to a corner header so imagery heroes */}
      {workView && (
        <div className="workHeader" key={`wh-${activeId}`}>
          <nav className="crumbs">
            {trail.map((n) => (
              <span key={n.id} className="crumbItem">
                <button onClick={() => onNavigate(n)}>{n.label}</button>
                <i>/</i>
              </span>
            ))}
          </nav>
          <h2 className="workTitle">{active.label}</h2>
          {active.copy && <p className="workBlurb">{active.copy}</p>}
          <button
            className="workBack"
            onClick={() => active.parentId && onNavigate(byId.get(active.parentId))}
          >
            ↑ Back
          </button>
        </div>
      )}

      {/* the end of the corridor: a media-less leaf's image, deepest plane */}
      {!workView && room && (
        <img key={`room-${room.id}`} className="froomImg" src={room.img} alt="" />
      )}

      {!workView && visibleNodes.map((n) => {
        if (n.x == null) return null
        const role = roles.get(n.id)

        // Hide the parent navigation as you expand: you're immersed in
        // the current focus + its children, floating in space. Siblings
        // and far branches vanish entirely; only the IMMEDIATE parent
        // lingers — a faint, deep way-back, almost dissolved.
        if (role === 'sibling' || role === 'distant') return null
        const isWayBack = role === 'parent' && n.id === active.parentId
        if (role === 'parent' && !isWayBack) return null

        let z, blur, opacity
        if (isWayBack) {
          // the level you came from — receded behind you, but legible
          // enough to read as the door back; brightens on hover
          z = -STEP_BACK * 1.05
          blur = hoverId === n.id ? 0 : 1.5
          opacity = hoverId === n.id ? 0.85 : 0.34
        } else if (role === 'active') {
          z = 0
          blur = 0
          opacity = 1
        } else {
          // children float just in front of the focal plane
          z = STEP_FWD
          blur = 0
          opacity = hoverId === n.id ? 1 : 0.9
        }

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
                className={`flabel ${role === 'active' ? 'activeL' : ''} ${isWayBack ? 'wayback' : ''} ${hoverId === n.id ? 'hot' : ''}`}
                style={{ fontSize: fsOf(role) }}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => clickNode(n)}
              >
                {isWayBack && <span className="backArrow">↑ </span>}
                {n.label}
              </span>
            </div>
          </div>
        )
      })}

      {/* the focus carries its copy on the focal plane */}
      {!workView && active?.copy && active.x != null && (
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
