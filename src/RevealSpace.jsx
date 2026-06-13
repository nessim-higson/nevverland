import { useEffect, useState } from 'react'
import Gallery3D from './Gallery3D'
import { ancestorsOf } from './layout'

// ─────────────────────────────────────────────────────────────
// 09 REVEAL — progressive drill-down. The legible paradigm.
//
// Only ONE layer is ever on screen: the path behind you (a compact
// breadcrumb), where you are (the focus), and where you can go (its
// children, as a clean non-overlapping list). Click a child and the
// level you were on collapses into the breadcrumb while the next
// level rises in. No siblings or distant branches clutter the
// canvas — overlap is structurally impossible. Deterministic flex
// layout (no physics fighting the type); motion lives in the
// collapse + staggered reveal between states.
//
// A leaf with media opens the WebGL gallery, the breadcrumb + title
// still readable on top.
// ─────────────────────────────────────────────────────────────

export default function RevealSpace({ byId, activeId, width, height, onNavigate }) {
  const [fullI, setFullI] = useState(null)
  useEffect(() => setFullI(null), [activeId])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && (fullI != null ? setFullI(null) : back())
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const active = byId.get(activeId)
  const trail = ancestorsOf(activeId, byId).reverse().map((id) => byId.get(id)) // root … parent
  const children = active.childIds.map((id) => byId.get(id))
  const isLeaf = children.length === 0
  const media = isLeaf && active.media ? active.media : null
  const parentId = active.parentId

  const back = () => parentId && onNavigate(byId.get(parentId))

  return (
    <div className="reveal">
      {/* a leaf's media plays full-bleed behind the readable header */}
      {media && (
        <Gallery3D
          key={`gl-${activeId}`}
          media={media}
          startIndex={fullI ?? 0}
          width={width}
          height={height ?? window.innerHeight}
          onIndex={setFullI}
        />
      )}

      <div className={`revealCol ${media ? 'overMedia' : ''}`}>
        {/* breadcrumb — the collapsed layers behind you, each tappable */}
        <nav className="crumbs" key={`cr-${activeId}`}>
          {trail.map((n, i) => (
            <span key={n.id} className="crumbItem" style={{ animationDelay: `${i * 50}ms` }}>
              <button onClick={() => onNavigate(n)}>{n.label}</button>
              <i>/</i>
            </span>
          ))}
        </nav>

        {/* where you are — click the title to step back up */}
        <button
          className="revealTitle"
          onClick={back}
          disabled={!parentId}
          style={{ cursor: parentId ? 'pointer' : 'default' }}
        >
          {active.label}
        </button>

        {active.copy && (
          <p className="revealCopy" key={`copy-${activeId}`}>
            {active.copy}
          </p>
        )}

        {/* where you can go — a clean, staggered, non-overlapping list */}
        {!isLeaf && (
          <ul className="revealList" key={`list-${activeId}`}>
            {children.map((c, i) => (
              <li key={c.id} style={{ animationDelay: `${120 + i * 70}ms` }}>
                <button onClick={() => onNavigate(c)}>
                  <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                  <span className="lbl">{c.label}</span>
                  {c.media && <span className="tag">work</span>}
                  <span className="arrow">→</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* a leaf with no media still confirms where you are */}
        {isLeaf && !media && active.copy == null && (
          <p className="revealCopy">—</p>
        )}
      </div>
    </div>
  )
}
