// The floor waypoint graph (build prompt 0.6, 8.4): hand-placed nodes from the level data, edges both ways, shortest paths.
import { LEVEL } from '../data/level.js';

export class Nav {
  constructor() {
    this.nodes = new Map(Object.entries(LEVEL.waypoints).map(([id, p]) => [id, { id, x: p[0], z: p[1], links: [] }]));
    for (const [a, b] of LEVEL.waypointEdges) {
      const A = this.nodes.get(a), B = this.nodes.get(b), d = Math.hypot(A.x - B.x, A.z - B.z);
      A.links.push({ to: B, d }); B.links.push({ to: A, d });
    }
  }

  nearest(x, z) {
    let best = null, bd = Infinity;
    for (const n of this.nodes.values()) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
    return best;
  }

  /** The shortest node list from one node to another (Dijkstra; the graph is small and this isn't per-frame). */
  path(from, to) {
    const dist = new Map([[from, 0]]), prev = new Map(), open = new Set([from]);
    while (open.size) {
      let cur = null, cd = Infinity;
      for (const n of open) { const d = dist.get(n); if (d < cd) { cd = d; cur = n; } }
      open.delete(cur);
      if (cur === to) break;
      for (const { to: nx, d } of cur.links) {
        const nd = cd + d;
        if (nd < (dist.get(nx) ?? Infinity)) { dist.set(nx, nd); prev.set(nx, cur); open.add(nx); }
      }
    }
    if (!dist.has(to)) return [];
    const out = [to];
    for (let n = to; prev.has(n); n = prev.get(n)) out.unshift(prev.get(n));
    return out;
  }

  /** Every edge the vac's body can't fit along, for the route checks. */
  blockedEdges(world, radius, height) {
    const bad = [];
    for (const [a, b] of LEVEL.waypointEdges) {
      const A = this.nodes.get(a), B = this.nodes.get(b), len = Math.hypot(A.x - B.x, A.z - B.z), steps = Math.ceil(len / 0.05);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        if (world.penetration(A.x + (B.x - A.x) * t, A.z + (B.z - A.z) * t, radius, 0.03, height) > 0) { bad.push(`${a}-${b}`); break; }
      }
    }
    return bad;
  }
}
