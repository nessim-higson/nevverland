// ─────────────────────────────────────────────────────────────
// Tuning constants — the "feel" of the organism lives here.
// ─────────────────────────────────────────────────────────────

export const PHYSICS = {
  // Node repulsion. More negative = nodes shove each other further apart.
  CHARGE: -460,
  // Repulsion range cap — without it, a freshly-expanded cluster (children
  // are born stacked on their parent) detonates across the whole screen.
  CHARGE_MAX_DISTANCE: 420,

  // Soft walls: nodes drifting past this margin are eased back on-screen.
  CONTAIN_MARGIN: 100,
  CONTAIN_STRENGTH: 0.4,

  // Resting length of each connecting line, by relationship.
  LINK_DISTANCE: {
    activeChild: 160, // active node → its children
    breadcrumb: 130,  // edges along the ancestor chain
    sibling: 125,     // parent → siblings of the active node
    distant: 140,     // edges to collapsed, far-away branches
  },

  // Children of the active node are also pulled onto a ring of this
  // radius around it, so they "bloom" outward evenly.
  CHILD_RING: 165,
  CHILD_RING_STRENGTH: 0.28,

  // Collision (no-overlap) force.
  COLLIDE_STRENGTH: 0.9,
  COLLIDE_PADDING: 18, // breathing room beyond each node's visual radius

  // Damping: d3's velocityDecay. Higher = motion settles faster /
  // feels heavier. Lower = bouncier, more elastic.
  DAMPING: 0.3,

  // How hard the active node is pulled to screen center, vs everyone else.
  CENTER_PULL_ACTIVE: 0.14,
  CENTER_PULL_OTHERS: 0.012,

  // Ancestors drift gently upward, forming a readable breadcrumb trail.
  BREADCRUMB_LIFT: 180, // px above center the ancestor chain hangs
  BREADCRUMB_PULL: 0.05,

  // Animation speed: energy injected when focus changes (0..1).
  // Higher = a bigger, livelier re-organization burst.
  ALPHA_KICK: 0.9,

  // The simulation never fully sleeps — this keeps a faint idle
  // breathing motion so the constellation feels alive. DRIFT is the
  // amplitude of the wander; at 0 the system settles to a dead stop.
  IDLE_ALPHA: 0.035,
  DRIFT: 0.24,

  // Master type scale — the headline control. 1 = the old sizing;
  // larger values make the focus dramatically dominant.
  TYPE_SCALE: 1.5,

  SPACING: 12,    // extra collision padding between labels — the
                  // anti-overlap dial (0 = touching allowed)

  // Connecting threads in the line-drawing modes (organic/orbs/depth) —
  // off shows the same living cascade held together by physics alone.
  THREADS: true,

  // FOCAL work gallery (three.js) — the shader effect on the frames.
  //   lens — barrel distortion + chromatic aberration, driven by velocity
  //   wave — the frame ripples like cloth as it moves
  //   rgb  — channel-split glitch on motion
  FX: 'lens',

  // FOCAL: how a project's media emits from its word.
  //   arc   — frames ring the word on a stable arc
  //   orbit — the ring slowly revolves around the word
  //   fan   — frames trail away INTO the corridor's depth
  EMIT: 'arc',

  // Presence: the system reacts to you before you click.
  CURSOR: 0.35,   // cursor gravity — labels lean toward (+) or away
                  // from (−) the pointer, like grass parting
  SHOCK: 8,       // click shockwave — the impulse every navigation
                  // sends rippling through the whole organism
}

// ─────────────────────────────────────────────────────────────
// TYPE mode (default) — the faithful 2007 read: no orbs, pure
// typography in cascading, left-ALIGNED columns. The cascade is a
// lattice of spring targets anchored to the active node, so the
// whole structure stays aligned while it breathes and swings.
// ─────────────────────────────────────────────────────────────
export const CASCADE = {
  COL_W: 260,        // horizontal step per level (the indent of a cascade)
  ROW_LIFT: 80,      // how far each ancestor sits above the active node
  GAP: 36,           // vertical rhythm between items in a column
  GAP_DISTANT: 28,   // tighter rhythm for collapsed far-away branches
  ACTIVE_CLEAR: 34,  // extra breathing room directly under the active label
  CHILD_DROP: 42,    // children's column starts this far below the active baseline
  STRENGTH: 0.5,     // pull toward cascade slots (higher = crisper alignment)
  LOOSE: 14,         // px of per-node horizontal wander off the column —
                     // 0 is laser-aligned, 40 is a windblown tree
  CHARGE_SCALE: 0.3, // repulsion is mostly redundant inside the lattice
  LINK_STRENGTH: 0.12, // threads stay loose so they never fight alignment
}

// Type sizes / weights / tracking per role — Helvetica Neue, sentence
// case. Tracking tightens as size grows, the classic optical rule.
// Steeper generational contrast: the focus towers, children read as a
// clear second tier, context drops away fast.
export const TYPE_ROLES = {
  active:  { fs: 46, opacity: 1.0, weight: 700, ls: '-0.015em' },
  child:   { fs: 20, opacity: 0.95, weight: 500, ls: '0.005em' },
  parent:  { fs: 15, opacity: 0.65, weight: 400, ls: '0.02em' },
  sibling: { fs: 11.5, opacity: 0.45, weight: 400, ls: '0.025em' },
  distant: { fs: 9, opacity: 0.25, weight: 400, ls: '0.03em' },
}

// Rough sentence-case label width, for hit areas and column indents.
export const labelWidth = (label, fs) => label.length * fs * 0.58

/**
 * Effective font size per role under the master TYPE_SCALE — the focus
 * takes the full scale, children a partial share, context barely moves,
 * so cranking the slider widens the hierarchy instead of zooming it.
 * Pass label+width for the active role to cap against the viewport.
 */
export function fsFor(role, label, width) {
  const base = TYPE_ROLES[role].fs
  const s = PHYSICS.TYPE_SCALE
  let f =
    role === 'active'
      ? base * s
      : role === 'child'
        ? base * (1 + (s - 1) * 0.4)
        : base * (1 + (s - 1) * 0.15)
  if (role === 'active' && label && width) {
    f = Math.min(f, (width * 0.8) / (label.length * 0.58))
  }
  return f
}

// ORBS mode — visual hierarchy by relevance. `scale` follows the spec
// ratios; `radius` is the dot size in px before hover scaling.
export const ROLES = {
  active:  { scale: 2.1,  opacity: 1.0,  radius: 50, label: 12,  labelInside: true },
  child:   { scale: 1.15, opacity: 0.95, radius: 22, label: 10.5 },
  parent:  { scale: 0.9,  opacity: 0.75, radius: 14, label: 9.5 },
  sibling: { scale: 0.7,  opacity: 0.5,  radius: 10, label: 9 },
  distant: { scale: 0.5,  opacity: 0.32, radius: 7,  label: 8.5 },
}
