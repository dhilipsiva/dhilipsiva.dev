/* ============================================================================
   graph.js — builds the constellation from WORLD's rooms + entities.
   Rooms become CLUSTERS (a hub node + entity nodes on a ring); corridors
   become hub↔hub edges. All copy still lives in world.js — this file is
   geometry only.

   >> CLAUDE CODE HANDOFF NOTES <<
   - SCALE positions hubs (room centers × SCALE). RING radii space children.
   - GRAPH.nodes: { id, kind:'hub'|'ent', x, y, glyph, color, label, clusterId,
                    lines[], badge? }  GRAPH.edges: { a, b, kind }
   - neighbors(id) returns [{node, dx, dy, dist}] for directional hops.
   ========================================================================== */

window.GRAPH = (function () {

  const SCALE = 34;            // world px per old map tile
  const RING = 150;            // base child-ring radius
  const nodes = [];
  const edges = [];
  const byId = new Map();

  const ROOM_GLYPHS = {
    atrium: '∴', built: '⊢', books: '▤', musings: '¶', talks: '⊳',
    about: '◉', now: '◷', uses: '⚙', contact: '✉'
  };

  /* hub topology = the old corridor map */
  const HUB_LINKS = [
    ['atrium', 'about'], ['atrium', 'built'], ['atrium', 'books'], ['atrium', 'now'],
    ['books', 'musings'], ['books', 'talks'],
    ['musings', 'about'], ['talks', 'built'],
    ['about', 'uses'], ['built', 'contact'],
    ['uses', 'now'], ['now', 'contact']
  ];

  function addNode(n) { nodes.push(n); byId.set(n.id, n); return n; }
  function addEdge(a, b, kind) { edges.push({ a, b, kind }); }

  /* ── hubs ────────────────────────────────────────────────────────────── */
  for (const r of WORLD.ROOMS) {
    const cx = (r.x + r.w / 2) * SCALE;
    const cy = (r.y + r.h / 2) * SCALE * 1.12;   // open up vertically
    addNode({
      id: 'hub:' + r.id, kind: 'hub', clusterId: r.id,
      x: cx, y: cy,
      glyph: ROOM_GLYPHS[r.id] || '∘',
      color: 'paper',
      label: r.name,
      lines: r.enter
    });
  }

  /* ── entity nodes on a ring around their room's hub ──────────────────── */
  for (const r of WORLD.ROOMS) {
    const hub = byId.get('hub:' + r.id);
    const ents = WORLD.ENTITIES.filter(e =>
      e.x > r.x && e.x < r.x + r.w && e.y > r.y && e.y < r.y + r.h);
    if (!ents.length) continue;

    // preserve each entity's original bearing from the room center, then
    // space them evenly to avoid overlap
    const withAngle = ents.map(e => {
      const rel = { x: e.x - (r.x + r.w / 2), y: e.y - (r.y + r.h / 2) };
      return { e, ang: Math.atan2(rel.y * 1.6, rel.x) };
    }).sort((p, q) => p.ang - q.ang);

    const n = withAngle.length;
    const radius = n > 5 ? RING + 46 : RING;
    withAngle.forEach((p, i) => {
      const ang = n === 1 ? p.ang : (withAngle[0].ang + (i / n) * Math.PI * 2);
      const id = 'ent:' + r.id + ':' + i;
      addNode({
        id, kind: 'ent', clusterId: r.id,
        x: hub.x + Math.cos(ang) * radius,
        y: hub.y + Math.sin(ang) * radius * 0.82,
        glyph: p.e.glyph, color: p.e.color,
        label: p.e.name, lines: p.e.lines, badge: p.e.badge
      });
      addEdge('hub:' + r.id, id, 'spoke');
    });

    // ring edges between consecutive children (orbiting with taps)
    if (n >= 3) for (let i = 0; i < n; i++)
      addEdge('ent:' + r.id + ':' + i, 'ent:' + r.id + ':' + ((i + 1) % n), 'ring');
  }

  /* ── hub↔hub edges ───────────────────────────────────────────────────── */
  for (const [a, b] of HUB_LINKS) addEdge('hub:' + a, 'hub:' + b, 'trunk');

  /* ── adjacency ───────────────────────────────────────────────────────── */
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    const A = byId.get(e.a), B = byId.get(e.b);
    adj.get(e.a).push(B); adj.get(e.b).push(A);
  }

  function neighbors(id) {
    const n = byId.get(id);
    return (adj.get(id) || []).map(m => {
      const dx = m.x - n.x, dy = m.y - n.y, dist = Math.hypot(dx, dy);
      return { node: m, dx: dx / dist, dy: dy / dist, dist };
    });
  }

  const clusterSize = {};
  for (const n of nodes) if (n.kind === 'ent')
    clusterSize[n.clusterId] = (clusterSize[n.clusterId] || 0) + 1;

  return { nodes, edges, byId, neighbors, clusterSize, SCALE };
})();
