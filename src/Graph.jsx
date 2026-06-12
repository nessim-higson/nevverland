import { useEffect, useRef, useState } from 'react'
import { PHYSICS as P, ROLES, TYPE_ROLES, labelWidth, fsFor } from './config'
import { ancestorsOf } from './layout'

// ─────────────────────────────────────────────────────────────
// Pure rendering on top of the one shared simulation. The modes
// differ only here:
//   ORGANIC   — type cascade, connecting threads visible
//   ORBS      — circle constellation, threads visible
//   STRUCTURE — same living cascade, threads INVISIBLE; the focus
//               carries a copy block that rides its physics
//   IMAGERY   — structure + imagery in real Z space: each revealed
//               project's still is born at its node and hangs at its
//               own depth behind the type (CSS perspective), so the
//               whole field parallaxes as the system re-balances
// ─────────────────────────────────────────────────────────────

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)' // slight overshoot

// Where a node's connecting threads attach: just left of the label's
// aligned edge (type modes) — the little tick the cascade hangs from.
const ANCHOR_GAP = 14

// IMAGERY: the still belongs to the work. It appears only when a
// project (leaf) takes focus, arriving from depth as the hero — a
// large, sharp element in the open field right of the type column.
const HERO_DY = -30

// Depth-of-field for type: the further a role sits from the focus,
// the softer it renders — background type genuinely reads as behind.
const ROLE_BLUR = { trail: 1.2, parent: 1.2, distant: 2, sibling: 0.7 }

function TypeNodeView({ node, role, hovered, depthCue, width, dist = 0, onHover, onClick }) {
  const t = TYPE_ROLES[role]
  // ancestors step down with generational distance — parent reads
  // clearly larger than grandparent, grandparent than root
  let fs = fsFor(role, node.label, width)
  if (role === 'parent' && dist > 1) fs = Math.max(10.5, fs - (dist - 1) * 3.5)
  const w = labelWidth(node.label, fs)
  const blur = depthCue && !hovered ? ROLE_BLUR[role] || 0 : 0

  return (
    <g
      data-node={node.id}
      transform={`translate(${node.x}, ${node.y})`}
      style={{
        opacity: hovered ? Math.min(1, t.opacity + 0.4) : t.opacity,
        filter: blur ? `blur(${blur}px)` : 'none',
        transition: 'opacity 0.4s ease, filter 0.5s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation()
        onClick(node)
      }}
    >
      {/* hover scale grows from the aligned left edge, so the column
          alignment never visually breaks */}
      <g
        style={{
          transform: hovered && role !== 'active' ? 'scale(1.1)' : 'scale(1)',
          transformOrigin: `${-ANCHOR_GAP}px 0px`,
          transition: `transform 0.45s ${SPRING}`,
        }}
      >
        {/* generous invisible hit area — small type is hard to click */}
        <rect
          x={-ANCHOR_GAP - 6}
          y={-fs}
          width={w + ANCHOR_GAP + 18}
          height={fs * 2}
          fill="transparent"
        />
        <text
          className="tlabel"
          textAnchor="start"
          dominantBaseline="central"
          fontSize={fs}
          fontWeight={t.weight}
          letterSpacing={t.ls}
          fill={role === 'active' ? '#ffffff' : '#dededb'}
          style={{ transition: `font-size 0.55s ${SPRING}` }}
        >
          {node.label}
        </text>
      </g>
    </g>
  )
}

function NodeView({ node, role, hovered, onHover, onClick }) {
  const style = ROLES[role]
  const r = style.radius
  const isActive = role === 'active'

  return (
    <g
      data-node={node.id}
      transform={`translate(${node.x}, ${node.y})`}
      style={{
        opacity: hovered ? Math.min(1, style.opacity + 0.3) : style.opacity,
        transition: `opacity 0.5s ease`,
        cursor: 'pointer',
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation()
        onClick(node)
      }}
    >
      <g
        style={{
          transform: hovered && !isActive ? 'scale(1.25)' : 'scale(1)',
          transition: `transform 0.45s ${SPRING}`,
        }}
      >
        {isActive && (
          <circle className="halo" r={r * 1.45} fill="#fff" opacity="0.06" />
        )}
        <circle
          r={r}
          fill={isActive ? '#f4f4f2' : role === 'child' ? '#e8e8e6' : '#b9bab8'}
          stroke={isActive ? 'none' : 'rgba(255,255,255,0.35)'}
          strokeWidth={isActive ? 0 : 1}
          style={{ transition: `r 0.6s ${SPRING}, fill 0.5s ease` }}
        />
        {style.labelInside ? (
          <text
            className="label inside"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={style.label}
          >
            {node.label}
          </text>
        ) : (
          <text
            className="label"
            textAnchor="middle"
            y={r + style.label + 7}
            fontSize={style.label}
            style={{ transition: `y 0.6s ${SPRING}` }}
          >
            {node.label}
          </text>
        )}
      </g>
    </g>
  )
}

// ── DEPTH mode: imagery as arrival ───────────────────────────
// The tree stays pure type. Click into a piece of work and its
// image arrives as the ENVIRONMENT — the room you're in, behind
// the words. Leave, and the room shrinks to the periphery as a
// ghost — spatial memory, capped at two. (No hover imagery: it
// proved confusing — depth answers navigation, not the cursor.)
function ImageStage({ active, innerRef }) {
  const [ghosts, setGhosts] = useState([])
  const prevActive = useRef(null)

  useEffect(() => {
    const prev = prevActive.current
    if (
      prev &&
      prev.id !== active.id &&
      prev.img &&
      prev.childIds.length === 0
    ) {
      setGhosts((g) =>
        [...g.filter((x) => x.id !== prev.id), { id: prev.id, img: prev.img }].slice(-2)
      )
    }
    prevActive.current = active
  }, [active])

  const hero = active?.img && active.childIds.length === 0 ? active : null

  return (
    <div className="stagefield" ref={innerRef}>
      {ghosts
        .filter((g) => g.id !== hero?.id)
        .map((g, i) => (
          <img
            key={g.id}
            className="ghostImg"
            src={g.img}
            alt=""
            style={{ left: i % 2 === 0 ? '12%' : '89%' }}
          />
        ))}
      {hero && <img key={`h-${hero.id}`} className="roomImg" src={hero.img} alt="" />}
    </div>
  )
}

export default function Graph({ width, height, sim, activeId, mode, onNavigate }) {
  const { visibleNodes, links, roles, byId } = sim
  const [hoverId, setHoverId] = useState(null)
  const fieldRef = useRef(null)
  const planeRef = useRef(null)

  // DEPTH: moving the mouse parallaxes the type plane against the room
  // behind it — depth you feel by moving, no hover states involved.
  useEffect(() => {
    if (mode !== 'depth') return
    const onMove = (e) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2
      const ny = (e.clientY / window.innerHeight - 0.5) * 2
      if (fieldRef.current)
        fieldRef.current.style.transform = `translate(${nx * -28}px, ${ny * -20}px) scale(1.06)`
      if (planeRef.current)
        planeRef.current.style.transform = `translate(${nx * 9}px, ${ny * 7}px)`
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (fieldRef.current) fieldRef.current.style.transform = ''
      if (planeRef.current) planeRef.current.style.transform = ''
    }
  }, [mode])

  // threads are a live dial — organic held together by physics alone
  // is its own version worth looking at
  const showLines =
    (mode === 'type' || mode === 'orbs' || mode === 'depth') && P.THREADS
  const showCopy = mode === 'structure' || mode === 'imagery' || mode === 'depth'
  const showImages = mode === 'imagery'
  const depthCue = mode === 'structure' || mode === 'imagery' || mode === 'depth'
  const Node = mode === 'orbs' ? NodeView : TypeNodeView

  // In type modes threads attach at each label's tick mark, not its center.
  const ax = (n) => (mode === 'orbs' ? n.x : n.x - ANCHOR_GAP)

  // Edges along root → … → active form the breadcrumb spine.
  const ancestors = ancestorsOf(activeId, byId)
  const trail = new Set([activeId, ...ancestors])
  const active = byId.get(activeId)

  // IMAGERY: descending a level dollies the camera — the type plane
  // eases toward the glass faster than the image field behind it, so
  // depth between type and background grows as you go in.
  const depth = ancestors.length
  const dolly = showImages
    ? {
        transform: `scale(${1 + depth * 0.055})`,
        transformOrigin: '46% 42%',
        transition: 'transform 1s cubic-bezier(0.3, 1, 0.4, 1)',
      }
    : undefined
  const dollyBg = showImages
    ? {
        transform: `scale(${1 + depth * 0.02})`,
        transformOrigin: '46% 42%',
        transition: 'transform 1s cubic-bezier(0.3, 1, 0.4, 1)',
      }
    : undefined

  // The hero: only when the focus is a leaf (an actual piece of work)
  // with a still — never ambient, never faded behind every item.
  const hero =
    showImages && active?.img && active.childIds.length === 0 && active.x != null

  return (
    <div className="graphWrap">
      {showImages && (
        <div className="zspace" style={dollyBg}>
          {hero && (
            <div
              key={`hero-${active.id}`}
              className="heroWrap"
              style={{
                left: active.x + Math.min(width * 0.34, 480),
                top: active.y + HERO_DY,
              }}
            >
              <img src={active.img} alt="" />
            </div>
          )}
        </div>
      )}

      {mode === 'depth' && <ImageStage active={active} innerRef={fieldRef} />}

      <div className="typePlane" style={dolly} ref={planeRef}>
      <svg width={width} height={height} className="graph">
        {showLines &&
          links.map((l) => {
            const s = typeof l.source === 'object' ? l.source : byId.get(l.source)
            const t = typeof l.target === 'object' ? l.target : byId.get(l.target)
            if (!s || !t || s.x == null || t.x == null) return null
            const onTrail = trail.has(s.id) && trail.has(t.id)
            const lit = hoverId === s.id || hoverId === t.id
            return (
              <line
                key={`${s.id}-${t.id}`}
                x1={ax(s)}
                y1={s.y}
                x2={ax(t)}
                y2={t.y}
                stroke="#fff"
                strokeWidth={onTrail ? 1 : 0.75}
                opacity={lit ? 0.5 : onTrail ? 0.3 : 0.12}
                style={{ transition: 'opacity 0.35s ease' }}
              />
            )
          })}

        {visibleNodes.map((n) => (
          <Node
            key={n.id}
            node={n}
            role={roles.get(n.id)}
            hovered={hoverId === n.id}
            depthCue={depthCue}
            width={width}
            dist={Math.max(0, active.depth - n.depth)}
            onHover={setHoverId}
            onClick={onNavigate}
          />
        ))}
      </svg>

      {/* STRUCTURE / IMAGERY: the focus carries its copy block — it
          rides the node's physics, so the paragraph drifts and settles
          with the system instead of sitting in a layout */}
      {showCopy && active?.copy && active.x != null && (
        <p
          key={activeId}
          className="nodeCopy"
          style={{
            left: active.x,
            top: active.y + fsFor('active', active.label, width) * 0.62 + 10,
          }}
        >
          {active.copy}
        </p>
      )}
      </div>
    </div>
  )
}
