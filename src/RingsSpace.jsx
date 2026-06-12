import { useEffect, useRef, useState } from 'react'
import { fsFor } from './config'

// ─────────────────────────────────────────────────────────────
// 08 RINGS — the corridor seen HEAD-ON.
//
// Instead of your past receding behind you (07), it ENCIRCLES you:
// the focus holds the center, its children float on the inner ring,
// and each level you came from is a wider, fainter ring around
// everything — root outermost. Recession as encirclement.
//
// The simulation still owns the angles (everything sways); the rings
// own the radii — each node is projected onto its level's circle at
// render, so the structure breathes without ever losing its orbits.
// Every navigation fires a sonar pulse from the center.
// ─────────────────────────────────────────────────────────────

const RING_STEP = 165 // radius added per level of distance

export default function RingsSpace({ sim, activeId, width, height, onNavigate }) {
  const { visibleNodes, roles, byId } = sim
  const [hoverId, setHoverId] = useState(null)
  const cx = width / 2
  const cy = height / 2 - 20

  const active = byId.get(activeId)
  const room = active?.img && active.childIds.length === 0 ? active : null

  // project a node onto its level's ring, keeping its simulated angle
  const place = (n, ringR) => {
    let dx = n.x - cx
    let dy = n.y - cy
    const d = Math.hypot(dx, dy) || 1
    return { x: cx + (dx / d) * ringR, y: cy + (dy / d) * ringR * 0.82 }
  }

  const fsOf = (role, dist) =>
    role === 'active'
      ? fsFor('active', active.label, width)
      : role === 'child'
        ? fsFor('child')
        : role === 'parent'
          ? Math.max(13, 24 - dist * 5)
          : role === 'sibling'
            ? 14
            : 11.5

  return (
    <div className="ringsSpace">
      {room && (
        <img key={`rroom-${room.id}`} className="ringsRoom" src={room.img} alt="" />
      )}

      {/* sonar pulse — every navigation is felt from the center */}
      <div key={`pulse-${activeId}`} className="pulse" style={{ left: cx, top: cy }} />

      {visibleNodes.map((n) => {
        if (n.x == null) return null
        const role = roles.get(n.id)
        const dist = Math.max(0, active.depth - n.depth) // levels away (ancestors)
        let x = n.x
        let y = n.y
        let opacity = 1
        if (role === 'active') {
          x = cx
          y = cy
        } else if (role === 'child') {
          ;({ x, y } = place(n, RING_STEP * 1.32))
          opacity = 0.9
        } else if (role === 'sibling') {
          ;({ x, y } = place(n, RING_STEP * 2.15))
          opacity = 0.42
        } else if (role === 'parent') {
          ;({ x, y } = place(n, RING_STEP * (1 + dist) * 1.45))
          opacity = Math.max(0.22, 0.55 - dist * 0.15)
        } else {
          // distant branches share their level's outer ring
          ;({ x, y } = place(n, RING_STEP * 2.9))
          opacity = 0.2
        }

        return (
          <span
            key={n.id}
            data-node={n.id}
            className={`rlabel ${role === 'active' ? 'activeL' : ''} ${hoverId === n.id ? 'hot' : ''}`}
            style={{
              transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`,
              fontSize: fsOf(role, dist),
              fontWeight: role === 'active' ? 700 : 400,
              opacity,
            }}
            onMouseEnter={() => setHoverId(n.id)}
            onMouseLeave={() => setHoverId(null)}
            onClick={() => onNavigate(n)}
          >
            {n.label}
          </span>
        )
      })}

      {active?.copy && (
        <div
          key={`rc-${activeId}`}
          className="fcopy"
          style={{
            transform: `translate3d(${cx}px, ${cy + fsOf('active', 0) * 0.62 + 16}px, 0) translateX(-50%)`,
          }}
        >
          {active.copy}
        </div>
      )}
    </div>
  )
}
