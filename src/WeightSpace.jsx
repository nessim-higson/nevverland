import { useState } from 'react'
import { fsFor } from './config'

// ─────────────────────────────────────────────────────────────
// 09 WEIGHT — recession with no z, no blur, no opacity tricks.
//
// One flat plane. Hierarchy is carried ENTIRELY by typography:
// the focus is enormous and bold; everything else thins as it gets
// further from your attention — children medium, your path light,
// far branches ultralight whispers. Distance becomes weight.
// Hovering a word tenses it (the weight snaps up a step) — the
// purest possible version of this navigation.
// ─────────────────────────────────────────────────────────────

const STYLE = {
  active:  { w: 700, op: 1 },
  child:   { w: 500, op: 0.95 },
  parent:  { w: 200, op: 0.8 },
  sibling: { w: 200, op: 0.55 },
  distant: { w: 100, op: 0.4 },
}

export default function WeightSpace({ sim, activeId, width, onNavigate }) {
  const { visibleNodes, roles, byId } = sim
  const [hoverId, setHoverId] = useState(null)
  const active = byId.get(activeId)
  const room = active?.img && active.childIds.length === 0 ? active : null

  const fsOf = (role, dist) =>
    role === 'active'
      ? fsFor('active', active.label, width) * 1.15
      : role === 'child'
        ? fsFor('child') * 1.15
        : role === 'parent'
          ? Math.max(14, 26 - dist * 5)
          : role === 'sibling'
            ? 15
            : 12

  return (
    <div className="weightSpace">
      {room && (
        <img key={`wroom-${room.id}`} className="ringsRoom" src={room.img} alt="" />
      )}

      {visibleNodes.map((n) => {
        if (n.x == null) return null
        const role = roles.get(n.id)
        const dist = Math.max(0, active.depth - n.depth)
        const s = STYLE[role]
        const hot = hoverId === n.id
        return (
          <span
            key={n.id}
            data-node={n.id}
            className={`wlabel ${role === 'active' ? 'activeL' : ''}`}
            style={{
              transform: `translate3d(${n.x}px, ${n.y}px, 0) translate(-50%, -50%)`,
              fontSize: fsOf(role, dist),
              // distance from attention = lightness; hover tenses it
              fontWeight: hot && role !== 'active' ? Math.min(700, s.w + 200) : s.w,
              opacity: hot ? Math.min(1, s.op + 0.3) : s.op,
            }}
            onMouseEnter={() => setHoverId(n.id)}
            onMouseLeave={() => setHoverId(null)}
            onClick={() => onNavigate(n)}
          >
            {n.label}
          </span>
        )
      })}

      {active?.copy && active.x != null && (
        <div
          key={`wc-${activeId}`}
          className="fcopy"
          style={{
            transform: `translate3d(${active.x}px, ${active.y + fsOf('active', 0) * 0.62 + 16}px, 0) translateX(-50%)`,
          }}
        >
          {active.copy}
        </div>
      )}
    </div>
  )
}
