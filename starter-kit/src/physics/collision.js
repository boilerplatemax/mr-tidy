// Collision world. Hand-authored proxies only (never full-mesh collision): yaw-rotated boxes and
// vertical cylinders, plus a ground plane with surface regions. No mesh collision, no allocations per query.
//
// A collider whose top is within stepHeight of the player's feet is walkable (stairs, thresholds);
// anything taller is a wall the player slides along.

const EPS = 1e-6;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.cylinders = [];
    this.regions = []; // ground surface regions: { minX, maxX, minZ, maxZ, surface, y }
    this.defaultSurface = 'concrete'; // the ground's surface where no region says otherwise
    this.groundY = 0;
    this.heightAt = null; // optional terrain: (x, z) → ground height. null = flat at groundY
    this._hit = { t: 0, nx: 0, ny: 0, nz: 0, collider: null };
  }

  /** Box from centre + full size + yaw (rad). opts: surface (footsteps), occludes (blocks sound + sight), tag, enabled, solid, noStep (never walked onto) */
  addBox(cx, cy, cz, sx, sy, sz, yaw = 0, opts = {}) {
    const b = {
      type: 'box', cx, cz, hx: sx / 2, hz: sz / 2, minY: cy - sy / 2, maxY: cy + sy / 2,
      c: Math.cos(yaw), s: Math.sin(yaw), yaw, surface: opts.surface || 'wood', occludes: !!opts.occludes,
      tag: opts.tag || '', enabled: opts.enabled !== false, solid: opts.solid !== false, noStep: !!opts.noStep,
    };
    b.reach = Math.hypot(b.hx, b.hz); // bounding radius for quick rejects
    this.boxes.push(b);
    return b;
  }

  addBoxMinMax(min, max, opts = {}) {
    return this.addBox((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2, max.x - min.x, max.y - min.y, max.z - min.z, 0, opts);
  }

  addCylinder(x, z, r, minY, maxY, opts = {}) {
    const c = { type: 'cyl', cx: x, cz: z, r, minY, maxY, surface: opts.surface || 'wood', occludes: !!opts.occludes, tag: opts.tag || '', enabled: opts.enabled !== false, solid: opts.solid !== false, noStep: !!opts.noStep };
    this.cylinders.push(c);
    return c;
  }

  addRegion(minX, maxX, minZ, maxZ, surface) { this.regions.push({ minX, maxX, minZ, maxZ, surface }); }

  /** A strip of surface along a segment (a path). */
  addSegmentRegion(ax, az, bx, bz, width, surface) {
    const r = width / 2;
    this.regions.push({ seg: true, ax, az, bx, bz, r2: r * r, surface, minX: Math.min(ax, bx) - r, maxX: Math.max(ax, bx) + r, minZ: Math.min(az, bz) - r, maxZ: Math.max(az, bz) + r });
  }

  remove(col) {
    const list = col.type === 'box' ? this.boxes : this.cylinders;
    const i = list.indexOf(col);
    if (i >= 0) list.splice(i, 1);
  }

  /** Surface of the bare ground at x,z (last region added wins, so paint small patches last). */
  groundSurface(x, z) {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
      if (!r.seg) return r.surface;
      const dx = r.bx - r.ax, dz = r.bz - r.az, len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / len2));
      const ex = x - (r.ax + dx * t), ez = z - (r.az + dz * t);
      if (ex * ex + ez * ez <= r.r2) return r.surface;
    }
    return this.defaultSurface;
  }

  /** Signed distance from point to a box footprint (negative inside). Writes outward normal to out. */
  _boxDist(b, x, z, out) {
    const dx = x - b.cx, dz = z - b.cz;
    const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
    const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
    let ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
    if (d > EPS) { ex /= d; ez /= d; }
    else { // inside: nearest face
      const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
      if (px < pz) { ex = Math.sign(lx) || 1; ez = 0; d = -px; } else { ex = 0; ez = Math.sign(lz) || 1; d = -pz; }
    }
    if (out) { out.x = ex * b.c + ez * b.s; out.z = -ex * b.s + ez * b.c; }
    return d;
  }

  _cylDist(c, x, z, out) {
    const dx = x - c.cx, dz = z - c.cz, len = Math.hypot(dx, dz);
    if (out) { if (len > EPS) { out.x = dx / len; out.z = dz / len; } else { out.x = 1; out.z = 0; } }
    return len - c.r;
  }

  /**
   * Highest walkable surface under a circle (radius r) whose top is at most maxY.
   * Returns { y, surface, collider } (reuses one object).
   */
  ground(x, z, r, maxY, out = { y: 0, surface: '', collider: null }) {
    out.y = this.heightAt ? this.heightAt(x, z) : this.groundY; out.surface = this.groundSurface(x, z); out.collider = null;
    for (const b of this.boxes) {
      if (!b.enabled || !b.solid || b.noStep || b.maxY > maxY || b.maxY <= out.y) continue;
      if (Math.abs(x - b.cx) > b.reach + r || Math.abs(z - b.cz) > b.reach + r) continue;
      if (this._boxDist(b, x, z, null) < r) { out.y = b.maxY; out.surface = b.surface; out.collider = b; }
    }
    for (const c of this.cylinders) {
      if (!c.enabled || !c.solid || c.noStep || c.maxY > maxY || c.maxY <= out.y) continue;
      if (this._cylDist(c, x, z, null) < r) { out.y = c.maxY; out.surface = c.surface; out.collider = c; }
    }
    return out;
  }

  /**
   * Push a circle out of every collider overlapping the vertical span [lowY, highY].
   * pos {x,z} is modified. Calls onPush(nx, nz) per contact (for velocity clipping).
   * Returns the remaining worst penetration (≈0 when resolved).
   */
  resolve(pos, r, lowY, highY, onPush, iterations = 5, feetY = lowY) {
    const n = this._n || (this._n = { x: 0, z: 0 });
    let worst = 0;
    for (let it = 0; it < iterations; it++) {
      worst = 0;
      for (const b of this.boxes) {
        if (!b.enabled || !b.solid || b.maxY <= (b.noStep ? feetY + 0.02 : lowY) || b.minY >= highY) continue;
        if (Math.abs(pos.x - b.cx) > b.reach + r || Math.abs(pos.z - b.cz) > b.reach + r) continue;
        const d = this._boxDist(b, pos.x, pos.z, n);
        if (d < r) { const p = r - d + 1e-4; pos.x += n.x * p; pos.z += n.z * p; worst = Math.max(worst, p); onPush?.(n.x, n.z, b); }
      }
      for (const c of this.cylinders) {
        if (!c.enabled || !c.solid || c.maxY <= (c.noStep ? feetY + 0.02 : lowY) || c.minY >= highY) continue;
        const d = this._cylDist(c, pos.x, pos.z, n);
        if (d < r) { const p = r - d + 1e-4; pos.x += n.x * p; pos.z += n.z * p; worst = Math.max(worst, p); onPush?.(n.x, n.z, c); }
      }
      if (worst < 1e-3) return 0;
    }
    return worst;
  }

  /** Penetration depth of a circle at x,z over a vertical span (0 = free). */
  penetration(x, z, r, lowY, highY, ignore = null, feetY = lowY) {
    let worst = 0;
    for (const b of this.boxes) {
      if (b === ignore || !b.enabled || !b.solid || b.maxY <= (b.noStep ? feetY + 0.02 : lowY) || b.minY >= highY) continue;
      const d = this._boxDist(b, x, z, null);
      if (d < r) worst = Math.max(worst, r - d);
    }
    for (const c of this.cylinders) {
      if (c === ignore || !c.enabled || !c.solid || c.maxY <= (c.noStep ? feetY + 0.02 : lowY) || c.minY >= highY) continue;
      const d = this._cylDist(c, x, z, null);
      if (d < r) worst = Math.max(worst, r - d);
    }
    return worst;
  }

  /**
   * Ray (origin o, unit dir d) against boxes, cylinders (as boxes of their radius) and the ground plane.
   * filter(collider) → false skips. Returns this._hit or null. Allocation-free: reuses _hit (copy what you need before the next call).
   */
  raycast(o, d, maxDist, filter = null, includeGround = true) {
    let best = maxDist, hit = null;
    const h = this._hit;
    for (const b of this.boxes) {
      if (!b.enabled || (filter && !filter(b))) continue;
      const t = this._rayBox(b, o, d, best);
      if (t !== null) { best = t; hit = b; }
    }
    for (const c of this.cylinders) {
      if (!c.enabled || (filter && !filter(c))) continue;
      const t = this._rayCyl(c, o, d, best);
      if (t !== null) { best = t; hit = c; }
    }
    if (includeGround && this.heightAt) {
      const t = this._rayTerrain(o, d, best);
      if (t !== null) { best = t; hit = 'ground'; }
    } else if (includeGround && d.y < -EPS) {
      const t = (this.groundY - o.y) / d.y;
      if (t > 0 && t < best) { best = t; hit = 'ground'; h.nx = 0; h.ny = 1; h.nz = 0; }
    }
    if (!hit) return null;
    h.t = best; h.collider = hit === 'ground' ? null : hit;
    if (hit !== 'ground') { h.nx = this._nx; h.ny = this._ny; h.nz = this._nz; if (hit.type === 'cyl') { h.nx = this._cnx; h.ny = this._cny; h.nz = this._cnz; } }
    return h;
  }

  /** March a ray over the heightfield (0.25 m steps, then bisect). Writes the hit normal to _hit. */
  _rayTerrain(o, d, maxT) {
    const H = this.heightAt, step = 0.25;
    let t0 = 0, above = o.y - H(o.x, o.z);
    if (above < 0) return null; // starts underground (shouldn't happen)
    for (let t = step; t < maxT + step; t += step) {
      const tt = Math.min(t, maxT);
      const x = o.x + d.x * tt, z = o.z + d.z * tt;
      if (o.y + d.y * tt - H(x, z) <= 0) {
        let a = t0, b = tt;
        for (let i = 0; i < 12; i++) { const m = (a + b) / 2; if (o.y + d.y * m - H(o.x + d.x * m, o.z + d.z * m) <= 0) b = m; else a = m; }
        const x1 = o.x + d.x * b, z1 = o.z + d.z * b, e = 0.1, h = this._hit;
        const gx = (H(x1 + e, z1) - H(x1 - e, z1)) / (2 * e), gz = (H(x1, z1 + e) - H(x1, z1 - e)) / (2 * e), n = Math.hypot(gx, 1, gz);
        h.nx = -gx / n; h.ny = 1 / n; h.nz = -gz / n;
        return b;
      }
      t0 = tt;
      if (tt >= maxT) break;
    }
    return null;
  }

  _rayBox(b, o, d, maxT) {
    const ox = o.x - b.cx, oz = o.z - b.cz;
    const lox = ox * b.c - oz * b.s, loz = ox * b.s + oz * b.c;
    const ldx = d.x * b.c - d.z * b.s, ldz = d.x * b.s + d.z * b.c;
    const cy = (b.minY + b.maxY) / 2, hy = (b.maxY - b.minY) / 2;
    const lo = [lox, o.y - cy, loz], ld = [ldx, d.y, ldz], he = [b.hx, hy, b.hz];
    let tmin = 0, tmax = maxT, axis = -1, sign = 0;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(ld[i]) < EPS) { if (Math.abs(lo[i]) > he[i]) return null; continue; }
      let t1 = (-he[i] - lo[i]) / ld[i], t2 = (he[i] - lo[i]) / ld[i], s = -1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = i; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (axis < 0) return null; // origin inside the box
    const lnx = axis === 0 ? sign : 0, lnz = axis === 2 ? sign : 0;
    this._nx = lnx * b.c + lnz * b.s; this._ny = axis === 1 ? sign : 0; this._nz = -lnx * b.s + lnz * b.c;
    return tmin;
  }

  _rayCyl(c, o, d, maxT) {
    // side
    const ox = o.x - c.cx, oz = o.z - c.cz;
    const a = d.x * d.x + d.z * d.z;
    let best = null;
    if (a > EPS) {
      const bq = ox * d.x + oz * d.z, cq = ox * ox + oz * oz - c.r * c.r;
      const disc = bq * bq - a * cq;
      if (disc >= 0) {
        const t = (-bq - Math.sqrt(disc)) / a;
        const y = o.y + d.y * t;
        if (t > 0 && t < maxT && y >= c.minY && y <= c.maxY) { best = t; const hx = ox + d.x * t, hz = oz + d.z * t; this._cnx = hx / c.r; this._cny = 0; this._cnz = hz / c.r; }
      }
    }
    // top cap
    if (d.y < -EPS) {
      const t = (c.maxY - o.y) / d.y;
      if (t > 0 && t < (best ?? maxT)) {
        const hx = ox + d.x * t, hz = oz + d.z * t;
        if (hx * hx + hz * hz <= c.r * c.r) { best = t; this._cnx = 0; this._cny = 1; this._cnz = 0; }
      }
    }
    return best;
  }

  /** Number of occluding colliders crossed by the segment a→b (audio occlusion, line of sight). */
  // sight = true: the eye's version: colliders tagged 'glass' are see-through. Audio passes false.
  countOccluders(a, b, max = 3, sight = false) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < EPS) return 0;
    const d = this._dir || (this._dir = { x: 0, y: 0, z: 0 });
    d.x = dx / len; d.y = dy / len; d.z = dz / len;
    let n = 0;
    for (const bx of this.boxes) {
      if (!bx.enabled || !bx.occludes || (sight && bx.tag === 'glass')) continue;
      if (this._rayBox(bx, a, d, len) !== null) { n++; if (n >= max) break; }
    }
    return n;
  }
}
