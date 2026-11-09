// A 3D grid of the house for the hose: which cells are solid, and A* through the ones that aren't. Built once from the
// collision boxes. Everything is inflated by the hose's thickness, so a path that's free here keeps the tube out of things.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';

const H = TUNING.hose, S = H.cell;
// the grid covers the house, whatever its size, with a little to spare round the outside
const XS = LEVEL.rooms.flatMap((r) => [r.min[0], r.max[0]]), ZS = LEVEL.rooms.flatMap((r) => [r.min[1], r.max[1]]);
const OX = Math.min(...XS) - 0.2, OY = 0, OZ = Math.min(...ZS) - 0.2; // the corner of the grid
const NX = Math.ceil((Math.max(...XS) + 0.3 - OX) / S), NY = Math.ceil(3.0 / S), NZ = Math.ceil((Math.max(...ZS) + 0.2 - OZ) / S), N = NX * NY * NZ;
const DIRS = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) DIRS.push([x, y, z, Math.hypot(x, y, z) * S]);

export class Voxels {
  /** opts.margin: how far to keep from every surface (default: the hose's thickness). opts.minY: nothing below this height. */
  constructor(world, opts = {}) {
    this.solid = new Uint8Array(N);
    const m = opts.margin ?? H.radius + H.clearance;
    for (const b of world.boxes) {
      if (!b.enabled || !b.solid) continue;
      const x0 = this._ix(b.cx - b.hx - m), x1 = this._ix(b.cx + b.hx + m), y0 = this._iy(b.minY - m), y1 = this._iy(b.maxY + m), z0 = this._iz(b.cz - b.hz - m), z1 = this._iz(b.cz + b.hz + m);
      for (let x = Math.max(0, x0); x <= Math.min(NX - 1, x1); x++) for (let y = Math.max(0, y0); y <= Math.min(NY - 1, y1); y++) for (let z = Math.max(0, z0); z <= Math.min(NZ - 1, z1); z++) this.solid[this._id(x, y, z)] = 1;
    }
    if (opts.minY) for (let y = 0; y < Math.ceil(opts.minY / S); y++) for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) this.solid[this._id(x, y, z)] = 1;
    this.g = new Float32Array(N); this.came = new Int32Array(N); this.stamp = new Uint32Array(N); this.closed = new Uint32Array(N); this.run = 0;
    this.heap = new Int32Array(H.searchLimit * 28); this.heapF = new Float32Array(H.searchLimit * 28); this.heapN = 0;
  }

  _ix(x) { return Math.floor((x - OX) / S); }
  _iy(y) { return Math.floor((y - OY) / S); }
  _iz(z) { return Math.floor((z - OZ) / S); }
  _id(x, y, z) { return x + NX * (y + NY * z); }
  _free(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < NX && y < NY && z < NZ && !this.solid[this._id(x, y, z)]; }

  /** Is this world point inside anything (or outside the house)? */
  blocked(x, y, z) { return !this._free(this._ix(x), this._iy(y), this._iz(z)); }

  /** Is the straight line between two points clear of everything? */
  lineFree(a, b) {
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), n = Math.max(1, Math.ceil(d / (S * 0.45)));
    for (let i = 0; i <= n; i++) { const t = i / n; if (this.blocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)) return false; }
    return true;
  }

  /** Stand a temporary upright cylinder in the grid (his body). Returns a function that takes it away again. */
  blockCylinder(cx, cz, r, h) {
    const changed = [], x0 = this._ix(cx - r), x1 = this._ix(cx + r), z0 = this._iz(cz - r), z1 = this._iz(cz + r), y1 = Math.min(NY - 1, this._iy(h));
    for (let x = Math.max(0, x0); x <= Math.min(NX - 1, x1); x++) for (let z = Math.max(0, z0); z <= Math.min(NZ - 1, z1); z++) {
      if (Math.hypot(OX + (x + 0.5) * S - cx, OZ + (z + 0.5) * S - cz) > r + S * 0.5) continue;
      for (let y = 0; y <= y1; y++) { const id = this._id(x, y, z); if (!this.solid[id]) { this.solid[id] = 1; changed.push(id); } }
    }
    return () => { for (const id of changed) this.solid[id] = 0; };
  }

  /** The closest free point to p that ok(point) accepts (ok: nothing solid between p and it), or null. */
  nearestOpen(p, ok) {
    if (!this.blocked(p.x, p.y, p.z)) return p.clone();
    const ix = this._ix(p.x), iy = this._iy(p.y), iz = this._iz(p.z), found = [], R = 4;
    for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) for (let z = -R; z <= R; z++) {
      if (!this._free(ix + x, iy + y, iz + z)) continue;
      found.push([Math.hypot(x, y, z), OX + (ix + x + 0.5) * S, OY + (iy + y + 0.5) * S, OZ + (iz + z + 0.5) * S]);
    }
    found.sort((a, b) => a[0] - b[0]);
    for (const [, x, y, z] of found) { const q = new THREE.Vector3(x, y, z); if (ok(q)) return q; }
    return null;
  }

  _nearestFree(x, y, z) { // for a point that lands just inside a solid cell (right against a surface)
    if (this._free(x, y, z)) return [x, y, z];
    for (let r = 1; r <= 3; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) if (this._free(x + dx, y + dy, z + dz)) return [x + dx, y + dy, z + dz];
    return null;
  }

  _push(id, f) {
    let i = this.heapN++;
    while (i > 0) { const p = (i - 1) >> 1; if (this.heapF[p] <= f) break; this.heap[i] = this.heap[p]; this.heapF[i] = this.heapF[p]; i = p; }
    this.heap[i] = id; this.heapF[i] = f;
  }

  _pop() {
    const top = this.heap[0], id = this.heap[--this.heapN], f = this.heapF[this.heapN];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= this.heapN) break;
      if (c + 1 < this.heapN && this.heapF[c + 1] < this.heapF[c]) c++;
      if (this.heapF[c] >= f) break;
      this.heap[i] = this.heap[c]; this.heapF[i] = this.heapF[c]; i = c;
    }
    this.heap[i] = id; this.heapF[i] = f;
    return top;
  }

  /** A route of points from a to b through free space, straightened out; null if there isn't one within the search limit. */
  path(a, b) {
    const s = this._nearestFree(this._ix(a.x), this._iy(a.y), this._iz(a.z)), e = this._nearestFree(this._ix(b.x), this._iy(b.y), this._iz(b.z));
    if (!s || !e) return null;
    const run = ++this.run, startId = this._id(s[0], s[1], s[2]), goalId = this._id(e[0], e[1], e[2]);
    const h = (x, y, z) => Math.hypot(x - e[0], y - e[1], z - e[2]) * S;
    this.heapN = 0; this.g[startId] = 0; this.stamp[startId] = run; this.came[startId] = -1;
    this._push(startId, h(s[0], s[1], s[2]));
    let steps = 0, found = false;
    while (this.heapN > 0 && steps++ < H.searchLimit) {
      const id = this._pop();
      if (this.closed[id] === run) continue;
      this.closed[id] = run;
      if (id === goalId) { found = true; break; }
      const z = Math.floor(id / (NX * NY)), rest = id - z * NX * NY, y = Math.floor(rest / NX), x = rest - y * NX;
      for (const [dx, dy, dz, cost] of DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (!this._free(nx, ny, nz)) continue;
        if ((dx && !this._free(x + dx, y, z)) || (dy && !this._free(x, y + dy, z)) || (dz && !this._free(x, y, z + dz))) continue; // no squeezing through corners
        const nid = this._id(nx, ny, nz), g = this.g[id] + cost;
        if (this.stamp[nid] === run && g >= this.g[nid]) continue;
        this.stamp[nid] = run; this.g[nid] = g; this.came[nid] = id;
        this._push(nid, g + h(nx, ny, nz));
      }
    }
    if (!found) return null;
    const pts = [];
    for (let id = goalId; id !== -1; id = this.came[id]) {
      const z = Math.floor(id / (NX * NY)), rest = id - z * NX * NY, y = Math.floor(rest / NX), x = rest - y * NX;
      pts.unshift(new THREE.Vector3(OX + (x + 0.5) * S, OY + (y + 0.5) * S, OZ + (z + 0.5) * S));
    }
    if (!this.blocked(a.x, a.y, a.z)) pts[0].set(a.x, a.y, a.z);
    if (!this.blocked(b.x, b.y, b.z)) pts[pts.length - 1].set(b.x, b.y, b.z);
    // pull the string: skip every point it can see past
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.lineFree(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }
}
