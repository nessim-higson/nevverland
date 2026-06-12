import { useEffect, useRef, useState } from 'react'
import { fsFor } from './config'

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

export default function FocusSpace({ sim, activeId, width, mini, onNavigate }) {
  const { visibleNodes, roles, byId } = sim
  const spaceRef = useRef(null)
  const [hoverId, setHoverId] = useState(null)

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
  const room = active?.img && active.childIds.length === 0 ? active : null

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

  return (
    <div className={`focusSpace ${mini ? 'mini' : ''}`} ref={spaceRef}>
      {/* the end of the corridor: a leaf's image, deepest plane */}
      {room && (
        <img key={`room-${room.id}`} className="froomImg" src={room.img} alt="" />
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
                onClick={() => onNavigate(n)}
              >
                {n.label}
              </span>
            </div>
          </div>
        )
      })}

      {/* the focus carries its copy on the focal plane */}
      {active?.copy && active.x != null && (
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
  )
}
