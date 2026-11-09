// A 3D grid of the house for the hose: which cells are solid, and A* through the ones that aren't. Built once from the
// collision boxes. Everything is inflated by the hose's thickness, so a path that's free here keeps the tube out of things.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';

const H = TUNING.hose, S = H.cell;
const OX = -0.2, OY = 0, OZ = -1.6; // the corner of the grid
const NX = Math.ceil(18.5 / S), NY = Math.ceil(3.0 / S), NZ = Math.ceil(7.2 / S), N = NX * NY * NZ;
const DIRS = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) DIRS.push([x, y, z, Math.hypot(x, y, z) * S]);

export class Voxels {
  constructor(world) {
    this.solid = new Uint8Array(N);
    const m = H.radius + H.clearance;
    for (const b of world.boxes) {
      if (!b.enabled || !b.solid) continue;
      const x0 = this._ix(b.cx - b.hx - m), x1 = this._ix(b.cx + b.hx + m), y0 = this._iy(b.minY - m), y1 = this._iy(b.maxY + m), z0 = this._iz(b.cz - b.hz - m), z1 = this._iz(b.cz + b.hz + m);
      for (let x = Math.max(0, x0); x <= Math.min(NX - 1, x1); x++) for (let y = Math.max(0, y0); y <= Math.min(NY - 1, y1); y++) for (let z = Math.max(0, z0); z <= Math.min(NZ - 1, z1); z++) this.solid[this._id(x, y, z)] = 1;
    }
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
