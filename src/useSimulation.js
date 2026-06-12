import { useEffect, useRef, useState } from 'react'
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCollide,
  forceX,
  forceY,
} from 'd3-force'
import { PHYSICS as P, ROLES, CASCADE as C, TYPE_ROLES, labelWidth, fsFor } from './config'
import { flatten, computeRoles, ancestorsOf } from './layout'
import { NAV } from './data'

// ─────────────────────────────────────────────────────────────
// The force simulation hook.
//
// One persistent d3-force simulation lives for the whole session.
// Node objects persist too (they keep their x/y between focus
// changes), so every re-organization is a *physical* journey from
// where things are to the new equilibrium — never a layout jump.
//
// On every focus change we:
//   1. recompute each node's role (active / child / parent / …)
//   2. swap the visible node set into the simulation — newly
//      revealed children are born AT their parent's position, so
//      they visibly bloom outward from it
//   3. rebuild the forces with role-aware strengths
//   4. kick the simulation's energy (alpha) so the whole system
//      swings, overshoots slightly, and settles into the new shape
// ─────────────────────────────────────────────────────────────

/** Collision radius: visual footprint + breathing room, per mode. */
function collideRadius(node, roles, mode) {
  const role = roles.get(node.id)
  if (mode === 'type') {
    // Text nodes: guard just over the line height. This must stay well
    // under the row gaps (CASCADE.GAP and the stacked-mode rhythms), or
    // collision will permanently fight the lattice and rows zig-zag.
    return fsFor(role) * 0.8 + 2
  }
  return ROLES[role].radius + P.COLLIDE_PADDING
}

/**
 * Custom force: pulls the active node's children onto a ring around
 * the active node's CURRENT position (d3's forceRadial only knows a
 * fixed center, so we roll our own that tracks the focus as it moves).
 */
function childRingForce(getActive, getChildren, ringScale = 1) {
  function force(alpha) {
    const a = getActive()
    if (!a) return
    const ring = P.CHILD_RING * ringScale
    for (const n of getChildren()) {
      let dx = n.x - a.x
      let dy = n.y - a.y
      let dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) {
        // Degenerate case (child sitting on the focus): nudge outward
        // at its own idle-phase angle so siblings fan out evenly.
        dx = Math.cos(n.phase)
        dy = Math.sin(n.phase)
        dist = 1
      }
      const k = ((ring - dist) / dist) * P.CHILD_RING_STRENGTH * alpha
      n.vx += dx * k
      n.vy += dy * k
    }
  }
  force.initialize = () => {}
  return force
}

/**
 * Custom force: a slow per-node sinusoidal wander. Combined with a
 * non-zero alphaTarget this keeps the system breathing when idle.
 * Reads P.DRIFT live every tick, so the slider responds immediately;
 * the long wavelength makes it read as floating, not jitter.
 */
function driftForce() {
  let nodes = []
  let t = 0
  function force() {
    t += 0.006
    for (const n of nodes) {
      n.vx += Math.cos(t * n.driftSpeed + n.phase) * P.DRIFT * 0.1
      n.vy += Math.sin(t * n.driftSpeed * 1.37 + n.phase) * P.DRIFT * 0.1
    }
  }
  force.initialize = (ns) => (nodes = ns)
  return force
}

/** Small stable hash for per-node character (looseness offsets). */
function hashOf(id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997
  return h
}

/**
 * Custom force (TYPE mode): the cascade lattice. Every visible node gets
 * a spring target expressed RELATIVE to an anchor node — children hang in
 * a left-aligned column indented right of the active node, siblings share
 * the active node's own column (in their true list order), ancestors step
 * up-and-left one column per level, and collapsed branches stack tightly
 * under the ancestor they belong to. Because targets are relative, the
 * whole lattice flows when the focus moves, but its ALIGNMENT — the
 * shared left edges and vertical rhythm — always re-asserts itself.
 *
 * `specs` is an array of { node, anchor, dx, dy } built once per refocus.
 */
function cascadeForce(specs, k = C.STRENGTH) {
  function force(alpha) {
    for (const s of specs) {
      const tx = s.anchor.x + s.dx
      const ty = s.anchor.y + s.dy
      s.node.vx += (tx - s.node.x) * k * alpha
      s.node.vy += (ty - s.node.y) * k * alpha
    }
  }
  force.initialize = () => {}
  return force
}

/**
 * Build the cascade slot assignments for the current focus.
 * `copyClear` pushes the children column and the trailing siblings down
 * so the focus's copy block (structure/imagery modes) keeps clear air.
 */
function buildCascadeSpecs(activeId, visible, roles, byId, copyClear = 0) {
  const active = byId.get(activeId)
  const ancestors = ancestorsOf(activeId, byId) // [parent, grandparent, …]
  const specs = []

  // The children's indent must clear the active label, however long it is.
  const colW = Math.max(C.COL_W, labelWidth(active.label, fsFor('active')) + 70)

  // row rhythm scales with the (slider-driven) type sizes, so larger
  // type never outgrows its gaps and starts colliding into zig-zags
  const rowGap = Math.max(C.GAP, fsFor('child') * 1.9)
  const distGap = Math.max(C.GAP_DISTANT, fsFor('distant') * 2.4)

  for (const n of visible) {
    const role = roles.get(n.id)
    if (role === 'child') {
      // Indented column, left edges aligned, in data order.
      const i = active.childIds.indexOf(n.id)
      specs.push({
        node: n,
        anchor: active,
        dx: colW,
        dy: C.CHILD_DROP + copyClear + i * rowGap,
      })
    } else if (role === 'sibling') {
      // Same column as the active node, keeping true list order, so the
      // active item visibly sits IN its level's cascade — just larger.
      const ids = byId.get(active.parentId).childIds
      const off = ids.indexOf(n.id) - ids.indexOf(activeId)
      specs.push({
        node: n,
        anchor: active,
        dx: 0,
        dy: off * rowGap + (off > 0 ? C.ACTIVE_CLEAR + copyClear : 0),
      })
    } else if (role === 'parent') {
      // Breadcrumb chain: one column up-left per level of depth.
      const d = ancestors.indexOf(n.id) + 1
      specs.push({
        node: n,
        anchor: active,
        dx: -C.COL_W * d,
        dy: -C.ROW_LIFT * d,
      })
    } else if (role === 'distant') {
      // Collapsed branch summaries stack under whichever breadcrumb
      // ancestor (or the focus itself) shares their parent.
      const sibIds = byId.get(n.parentId).childIds
      const anchor = visible.find(
        (m) =>
          m.parentId === n.parentId &&
          (roles.get(m.id) === 'parent' || m.id === activeId)
      )
      if (!anchor) continue
      const off = sibIds.indexOf(n.id) - sibIds.indexOf(anchor.id)
      specs.push({
        node: n,
        anchor,
        dx: 0,
        // small extra clearance so the first one isn't glued to the
        // anchor's (larger) label
        dy: off * distGap + (off > 0 ? 10 : -6),
      })
    }
  }
  return specs
}

/**
 * Build slot assignments for the STACKED modes (structure / imagery):
 * ONE shared left edge, strict vertical order — breadcrumb trail above,
 * the focus, its copy, children straight beneath, then the quieter
 * siblings and collapsed branches. The physics still carries every
 * move; this only defines where things come to rest.
 */
function buildStackSpecs(activeId, visible, roles, byId, copyClear, width) {
  const active = byId.get(activeId)
  const ancestors = ancestorsOf(activeId, byId) // [parent, grandparent, …]
  const specs = []

  // everything scales off the (slider-driven) effective type sizes
  const aFs = fsFor('active', active.label, width)
  const rowGap = Math.max(C.GAP, fsFor('child') * 1.8)
  const sibGap = Math.max(30, fsFor('sibling') * 2.3)

  // LOOSE: each node leans off the column by its own stable amount —
  // 0 = laser-aligned, dial it up and the tree goes windblown.
  const lean = (id) => ((hashOf(id) % 100) / 50 - 1) * C.LOOSE

  // breadcrumb trail stacked above the focus
  ancestors.forEach((id, k) => {
    specs.push({
      node: byId.get(id),
      anchor: active,
      dx: lean(id) * 0.6,
      dy: -(aFs * 0.55 + 34 + k * 34),
    })
  })

  // children below the copy block, hanging off the shared left edge
  const kids = active.childIds.filter((id) => roles.has(id))
  const childStart = aFs * 0.55 + 26 + copyClear
  kids.forEach((id, i) => {
    specs.push({
      node: byId.get(id),
      anchor: active,
      dx: lean(id),
      dy: childStart + i * rowGap,
    })
  })
  let y = childStart + kids.length * rowGap + 30

  // siblings, then far branches — the quiet end of the column
  if (active.parentId) {
    for (const sid of byId.get(active.parentId).childIds) {
      if (sid === activeId || !roles.has(sid)) continue
      specs.push({ node: byId.get(sid), anchor: active, dx: lean(sid), dy: y })
      y += sibGap
    }
  }
  y += 18
  for (const n of visible) {
    if (roles.get(n.id) !== 'distant') continue
    specs.push({ node: n, anchor: active, dx: lean(n.id), dy: y })
    y += 27
  }

  return specs
}

/**
 * Custom force: soft viewport walls. Anything drifting past the margin
 * is eased back in, proportional to how far out it strayed — no hard
 * clamping, so returns feel as springy as everything else.
 */
function containForce(width, height) {
  let nodes = []
  function force(alpha) {
    const m = P.CONTAIN_MARGIN
    for (const n of nodes) {
      if (n.x < m) n.vx += (m - n.x) * P.CONTAIN_STRENGTH * alpha
      if (n.x > width - m) n.vx -= (n.x - (width - m)) * P.CONTAIN_STRENGTH * alpha
      if (n.y < m) n.vy += (m - n.y) * P.CONTAIN_STRENGTH * alpha
      if (n.y > height - m) n.vy -= (n.y - (height - m)) * P.CONTAIN_STRENGTH * alpha
    }
  }
  force.initialize = (ns) => (nodes = ns)
  return force
}

/**
 * Custom force: cursor gravity. Labels near the pointer lean toward it
 * (or away, if the dial goes negative) with a soft falloff — the
 * organism notices your presence before you click anything. Reads
 * P.CURSOR live, so the slider responds immediately.
 */
function pointerForce(pointer) {
  let nodes = []
  const R = 300
  function force() {
    if (!P.CURSOR || pointer.x == null) return
    for (const n of nodes) {
      const dx = pointer.x - n.x
      const dy = pointer.y - n.y
      const d = Math.hypot(dx, dy)
      if (d > R || d < 2) continue
      const k = P.CURSOR * (1 - d / R) * 0.18
      n.vx += (dx / d) * k
      n.vy += (dy / d) * k
    }
  }
  force.initialize = (ns) => (nodes = ns)
  return force
}

export function useSimulation(activeId, width, height, mode = 'type', tuneV = 0) {
  // Re-render trigger: the sim mutates node x/y in place each tick;
  // bumping this counter tells React to re-read those positions.
  const [, setTick] = useState(0)

  const ref = useRef(null)
  if (!ref.current) {
    const { nodes, byId } = flatten(NAV)
    for (const n of nodes) {
      // Per-node phase and speed seed the idle drift so no two nodes
      // wobble in sync. Positions are seeded in the effect below, once
      // the container has been measured.
      n.phase = Math.random() * Math.PI * 2
      n.driftSpeed = 0.5 + Math.random()
      n.everShown = false
    }
    ref.current = {
      sim: forceSimulation([]).stop(),
      nodes,
      byId,
      roles: new Map(),
      seeded: false,
      pointer: { x: null, y: null },
      prevFocus: null,
    }
  }

  const { sim, nodes, byId } = ref.current

  useEffect(() => {
    if (!width || !height) return

    // DUST runs its own canvas engine — park the d3 simulation.
    if (mode === 'dust') {
      sim.stop()
      return
    }

    // STRUCTURE and IMAGERY build on the organic cascade physics —
    // they differ only in rendering (no lines, copy blocks, z-space
    // imagery), so they share the 'type' force configuration. FOCAL
    // uses the centered ring physics (like orbs): focus at center,
    // children orbiting, ancestors lifted — depth happens at render.
    const centered = mode === 'focus' || mode === 'rings' || mode === 'weight'
    const phys = mode === 'orbs' || centered ? 'orbs' : 'type'

    const cx = width / 2
    const cy = height / 2

    // First run with real dimensions: everyone starts loosely clustered
    // at center, so the opening state blooms outward from the middle.
    if (!ref.current.seeded) {
      for (const n of nodes) {
        n.x = width / 2 + (Math.random() - 0.5) * 60
        n.y = height / 2 + (Math.random() - 0.5) * 60
      }
      ref.current.seeded = true
    }

    const roles = computeRoles(activeId, byId)
    ref.current.roles = roles
    const roleOf = (n) => roles.get(n.id)

    const visible = nodes.filter((n) => roles.has(n.id))

    // Newly revealed nodes are born at their parent's position (plus a
    // tiny jitter so the collision force can separate them) — this is
    // what makes children visibly grow OUT of the node you clicked.
    for (const n of visible) {
      if (!n.everShown) {
        const p = n.parentId ? byId.get(n.parentId) : null
        if (p && p.everShown) {
          n.x = p.x + (Math.random() - 0.5) * 40
          n.y = p.y + (Math.random() - 0.5) * 40
        }
        n.everShown = true
      }
    }

    // One link per visible parent→child pair, tagged by relationship
    // so the link force can give each kind its own resting length.
    const links = []
    for (const n of visible) {
      if (!n.parentId || !roles.has(n.parentId)) continue
      const childRole = roleOf(n)
      const kind =
        childRole === 'child' ? 'activeChild'
        : childRole === 'active' || childRole === 'parent' ? 'breadcrumb'
        : childRole === 'sibling' ? 'sibling'
        : 'distant'
      links.push({ source: n.parentId, target: n.id, kind })
    }

    ref.current.links = links

    // Detach the previous focus's forces BEFORE swapping the node set:
    // d3 re-initializes every attached force inside sim.nodes(), and the
    // old accessors still close over the previous role map / link list
    // (which may reference nodes that just became hidden).
    for (const f of ['charge', 'link', 'collide', 'x', 'y', 'ring', 'drift', 'contain', 'pointer']) {
      sim.force(f, null)
    }

    sim.nodes(visible)
    sim.velocityDecay(P.DAMPING) // damping → motion settles elegantly

    // Repulsion: bigger (more relevant) nodes push harder, carving out
    // space proportional to their visual weight. In TYPE mode it's dialed
    // way down — the cascade lattice owns the spacing there.
    const chargeScale = phys === 'type' ? C.CHARGE_SCALE : 1
    sim.force(
      'charge',
      forceManyBody()
        .strength((n) => P.CHARGE * ROLES[roleOf(n)].scale * chargeScale)
        .distanceMax(P.CHARGE_MAX_DISTANCE)
    )

    // Links: spring each connected pair toward its resting distance.
    // Loose in TYPE mode — the threads are drawn, but alignment leads.
    sim.force(
      'link',
      forceLink(links)
        .id((n) => n.id)
        .distance((l) => P.LINK_DISTANCE[l.kind])
        .strength(phys === 'type' ? C.LINK_STRENGTH : 0.6)
    )

    // Collision: nobody overlaps, with padding for labels.
    sim.force(
      'collide',
      forceCollide((n) =>
        centered
          ? // these modes render text labels — guard their width
            labelWidth(n.label, fsFor(roleOf(n))) * 0.42 + 6 + P.SPACING * 0.5
          : collideRadius(n, roles, phys) + (phys === 'type' ? P.SPACING * 0.25 : 0)
      )
        .strength(P.COLLIDE_STRENGTH)
        .iterations(2)
    )

    // Centering: the active node is pulled firmly to center — it drags
    // everything connected to it along, which is exactly the "active
    // node pulls the system into a new equilibrium" feel. Everyone
    // else gets only a whisper of gravity so the cloud stays on screen.
    // Focus placement. Organic cascade: left-of-center, shifting right
    // with depth to keep the breadcrumb staircase in frame. Stacked
    // modes: a fixed left column, leaving the right field open for the
    // imagery hero.
    const stacked = mode === 'structure' || mode === 'imagery'
    const depth = ancestorsOf(activeId, byId).length
    const focusX = stacked
      ? Math.max(190, width * 0.18)
      : phys === 'type'
        ? cx - C.COL_W * 0.5 + C.COL_W * depth * 0.45
        : cx
    const focusY = stacked
      ? cy - 30
      : phys === 'type'
        ? cy - 40 + depth * C.ROW_LIFT * 0.4
        : cy
    sim.force(
      'x',
      forceX(focusX).strength((n) =>
        roleOf(n) === 'active' ? P.CENTER_PULL_ACTIVE : P.CENTER_PULL_OTHERS
      )
    )
    sim.force(
      'y',
      forceY((n) =>
        // Ancestors hang above center → a readable breadcrumb trail.
        roleOf(n) === 'parent' && phys !== 'type'
          ? cy - P.BREADCRUMB_LIFT
          : focusY
      ).strength((n) => {
        const r = roleOf(n)
        if (r === 'active') return P.CENTER_PULL_ACTIVE
        if (r === 'parent') return P.BREADCRUMB_PULL
        return P.CENTER_PULL_OTHERS
      })
    )

    if (phys === 'type') {
      // The cascade lattice owns the shape: aligned columns, true list
      // order, breadcrumb staircase. (Replaces the orb ring force.)
      // Modes with copy blocks (stacked + depth) — estimate the copy's
      // height so the cascade flows around it instead of through it.
      const activeNode = byId.get(activeId)
      const copyClear =
        (stacked || mode === 'depth') && activeNode.copy
          ? Math.min(150, Math.ceil(activeNode.copy.length / 48) * 21 + 26)
          : 0
      // Stacked modes run a stiffer spring — the simulation stops dead
      // when idle there, so rows must reach their slots before the
      // energy runs out or the column freezes mid-zigzag.
      const specs = stacked
        ? buildStackSpecs(activeId, visible, roles, byId, copyClear, width)
        : buildCascadeSpecs(activeId, visible, roles, byId, copyClear)

      sim.force('ring', cascadeForce(specs, stacked ? Math.max(C.STRENGTH, 0.5) : C.STRENGTH))
    } else {
      // Children bloom onto a ring around the (moving) focus. The
      // centered text modes need a wider ring — labels, not dots.
      sim.force(
        'ring',
        childRingForce(
          () => byId.get(activeId),
          () => visible.filter((n) => roleOf(n) === 'child'),
          centered ? 1.5 : 1
        )
      )
    }

    // Idle breathing + soft screen-edge walls. Drift is a live dial:
    // at 0 the system settles to a dead stop (no jitter on static
    // type); above 0 every mode floats.
    sim.force('drift', driftForce())
    sim.force('contain', containForce(width, height))
    sim.force('pointer', pointerForce(ref.current.pointer))

    // Click shockwave: a one-time radial impulse from the new focus —
    // every navigation is felt through the whole organism, near nodes
    // shoved hard, far nodes nudged, springs pulling it all back.
    const focusNode = byId.get(activeId)
    if (
      P.SHOCK > 0 &&
      ref.current.prevFocus &&
      ref.current.prevFocus !== activeId &&
      focusNode.x != null
    ) {
      for (const n of visible) {
        if (n === focusNode || n.x == null) continue
        const dx = n.x - focusNode.x
        const dy = n.y - focusNode.y
        const d = Math.hypot(dx, dy) || 1
        const imp = P.SHOCK * Math.min(1, 220 / d)
        n.vx += (dx / d) * imp
        n.vy += (dy / d) * imp
      }
    }
    ref.current.prevFocus = activeId

    sim.on('tick', () => setTick((t) => t + 1))

    // Inject energy for the re-organization, then decay toward either a
    // faint idle simmer (drift on → alive) or a dead stop (drift at 0).
    sim
      .alpha(P.ALPHA_KICK)
      .alphaTarget(P.DRIFT > 0.015 ? P.IDLE_ALPHA : 0)
      .restart()

    // Paint the new role assignments immediately — d3's internal timer
    // is rAF-driven, so in a background tab the first tick (and thus the
    // first re-render) could otherwise be deferred indefinitely.
    setTick((t) => t + 1)

    return () => sim.on('tick', null)
  }, [activeId, width, height, mode, tuneV])

  // Stop the simulation for real on unmount.
  useEffect(() => () => sim.stop(), [])

  return {
    visibleNodes: nodes.filter((n) => ref.current.roles.has(n.id)),
    links: ref.current.links || [],
    roles: ref.current.roles,
    byId,
    // mutated by the stage's mousemove — feeds the cursor-gravity force
    pointer: ref.current.pointer,
  }
}
