// ─────────────────────────────────────────────────────────────
// Pure tree → graph helpers: flattening, and deciding which
// nodes are visible (and in what role) for a given focus.
// ─────────────────────────────────────────────────────────────

/** Flatten the nav tree into nodes with parent/child pointers. */
export function flatten(tree) {
  const nodes = []
  const byId = new Map()
  ;(function walk(item, parentId, depth) {
    const n = {
      id: item.id,
      label: item.label,
      copy: item.copy || null,
      img: item.img || null,
      media: item.media || null,
      parentId,
      depth,
      childIds: (item.children || []).map((c) => c.id),
    }
    nodes.push(n)
    byId.set(n.id, n)
    ;(item.children || []).forEach((c) => walk(c, item.id, depth + 1))
  })(tree, null, 0)
  return { nodes, byId }
}

/** Root → … → node, as an array of ids (excluding the node itself). */
export function ancestorsOf(id, byId) {
  const out = []
  let cur = byId.get(id)
  while (cur && cur.parentId) {
    out.push(cur.parentId)
    cur = byId.get(cur.parentId)
  }
  return out
}

/**
 * For the current focus, decide each node's role:
 *   active   — the focus itself
 *   child    — direct children of the focus (expanded outward)
 *   parent   — ancestors of the focus (the breadcrumb trail)
 *   sibling  — same-parent neighbours of the focus
 *   distant  — collapsed summary nodes of non-active branches
 * Nodes absent from the map are hidden entirely (their branch
 * collapsed into its `distant` summary node).
 */
export function computeRoles(activeId, byId) {
  const roles = new Map()
  const active = byId.get(activeId)
  roles.set(activeId, 'active')

  for (const ancId of ancestorsOf(activeId, byId)) roles.set(ancId, 'parent')
  for (const cid of active.childIds) roles.set(cid, 'child')

  // Siblings of the focus stay visible, pushed outward.
  if (active.parentId) {
    for (const sib of byId.get(active.parentId).childIds) {
      if (!roles.has(sib)) roles.set(sib, 'sibling')
    }
  }

  // Each ancestor's other branches collapse to faded summary nodes,
  // preserving a sense of the whole site without the clutter.
  for (const ancId of ancestorsOf(activeId, byId)) {
    const anc = byId.get(ancId)
    if (!anc.parentId) continue
    for (const sib of byId.get(anc.parentId).childIds) {
      if (!roles.has(sib)) roles.set(sib, 'distant')
    }
  }

  return roles
}
