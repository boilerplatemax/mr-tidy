// The hose. Its nozzle flies through free space (pathfinding in 3D around anything in the way) and the body is the trail
// it leaves behind, with a smooth tube rebuilt along it every frame: wherever the tip went, the hose follows, so it can't
// cut through furniture or walls. At rest it lies on the floor in front of him. Numbers are in TUNING.hose.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1 } from '../render/ps1-material.js';

const H = TUNING.hose;
const SLIDE = [[1, 1, 1], [1, 0, 1], [0, 1, 0], [1, 0, 0], [0, 0, 1]];
const expK = (rate, dt) => 1 - Math.exp(-rate * dt);
const _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _ax = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _sw = new THREE.Vector3();

export class Hose {
  constructor(scene, vox) {
    const n = this.n = H.segments;
    this.vox = vox;
    this.pts = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this.prev = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this.draw = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this.want = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this.old = Array.from({ length: n + 1 }, () => new THREE.Vector3()); // last tick's positions, for the chain
    this.trail = []; // the path the tip has taken, from the hole outward
    this.tipPos = new THREE.Vector3(); this.dir = new THREE.Vector3(0, 0, 1);
    this.maxLen = H.length; this.active = false; this.plan = null; this.planI = 1; this.planT = 0; this.len = 0;
    this.arrived = false; this.maxed = false; this.stuck = false; // what the tip has done, for whoever is steering it
    this.t = 0; this.hover = false; this.placed = false;
    this.curve = new THREE.CatmullRomCurve3(this.draw);
    this.curve.arcLengthDivisions = 60;
    this.mat = makePS1(new THREE.MeshLambertMaterial({ color: H.color }));
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.nozzle = new THREE.Mesh(new THREE.CylinderGeometry(H.nozzleR, H.nozzleR * 1.3, H.nozzleLen, 8).translate(0, H.nozzleLen / 2, 0), makePS1(new THREE.MeshLambertMaterial({ color: H.nozzleColor })));
    scene.add(this.nozzle);
  }

  get tip() { return this.pts[this.n]; }

  reset() { this.placed = false; this.active = false; this.trail.length = 0; this.plan = null; this.arrived = this.maxed = this.stuck = false; this.hover = false; }

  /** The hose whips straight to a point (being caught at close range), around his body if the point is behind him. */
  snap(base, heading, point) {
    const s = Math.sin(heading), c = Math.cos(heading), dx = point.x - base.x, dz = point.z - base.z;
    this.trail.length = 0; this.active = true; this.plan = null;
    this.trail.push(new THREE.Vector3(base.x, base.y, base.z));
    this.trail.push(new THREE.Vector3(base.x + s * 0.12, base.y, base.z + c * 0.12));
    if (dx * s + dz * c < 0) { // behind him: round the side of the drum
      const side = dx * c - dz * s >= 0 ? 1 : -1;
      this.trail.push(new THREE.Vector3(base.x + s * 0.16 + c * side * 0.4, base.y + 0.05, base.z + c * 0.16 - s * side * 0.4));
      this.trail.push(new THREE.Vector3(base.x - s * 0.3 + c * side * 0.42, base.y + 0.08, base.z - c * 0.3 - s * side * 0.42));
    }
    this.trail.push(new THREE.Vector3(point.x, point.y, point.z));
    this.tipPos.set(point.x, point.y, point.z);
    this._resample();
    for (let i = 0; i <= this.n; i++) { this.pts[i].copy(this.want[i]); this.prev[i].copy(this.want[i]); }
  }

  /** The catch: the hose is simply this list of points, from the hole out to the nozzle. */
  lay(points) {
    this.trail.length = 0; this.active = true; this.plan = null;
    for (const p of points) this.trail.push(p.clone());
    this.tipPos.copy(points[points.length - 1]);
    this._resample();
    for (let i = 0; i <= this.n; i++) { this.pts[i].copy(this.want[i]); this.prev[i].copy(this.want[i]); this.old[i].copy(this.want[i]); }
  }

  _begin(base, s, c) { // from where the nozzle was lying
    this.active = true; this.plan = null; this.planT = 0; this.arrived = this.maxed = this.stuck = false; this.len = 0;
    this.trail.length = 0;
    this.trail.push(new THREE.Vector3(base.x, base.y, base.z));
    this.tipPos.copy(this.pts[this.n]);
    this.trail.push(this.tipPos.clone());
    this.trail.push(this.tipPos.clone());
    this.dir.set(s, 0, c);
  }

  _extend() { // lay the trail behind the tip
    const T = this.trail, last = T[T.length - 1];
    last.copy(this.tipPos); // the end of the trail stays on the tip; once it's a step from the point before, it's laid down for good
    if (T.length < 2 || last.distanceTo(T[T.length - 2]) >= H.trailStep) T.push(this.tipPos.clone());
    let L = 0;
    for (let i = 1; i < T.length; i++) L += T[i].distanceTo(T[i - 1]);
    this.len = L;
    if (L >= this.maxLen) this.maxed = true;
  }

  /** A route for the tip: an arching curve if it's clear, else around whatever's in the way. */
  _route(goal, curved) {
    const a = this.tipPos, V = this.vox;
    if (curved) {
      const span = a.distanceTo(goal) || 0.001, pts = [a.clone()];
      _a.copy(a).addScaledVector(this.dir, span * 0.5);
      _b.copy(goal); _b.y -= span * H.arch;
      let ok = true;
      for (let i = 1; i <= H.arcPoints; i++) {
        const u = i / H.arcPoints, v = 1 - u, A = v * v * v, B = 3 * v * v * u, C = 3 * v * u * u, D = u * u * u;
        const p = new THREE.Vector3(A * a.x + B * _a.x + C * _b.x + D * goal.x, A * a.y + B * _a.y + C * _b.y + D * goal.y, A * a.z + B * _a.z + C * _b.z + D * goal.z);
        if (!V.lineFree(pts[pts.length - 1], p)) { ok = false; break; }
        pts.push(p);
      }
      if (ok) return pts;
    }
    if (V.lineFree(a, goal)) return [a.clone(), goal.clone()];
    return V.path(a, goal);
  }

  _approach(dt, cmd) { // along a route to the goal, stopping there
    this.planT -= dt;
    if (!this.plan || this.planT <= 0) { this.planT = cmd.replan ?? H.replan; this.plan = this._route(cmd.goal, !cmd.straight); this.planI = 1; }
    if (!this.plan) { this.stuck = true; return; }
    if (this.maxed) return;
    let rem = cmd.speed * dt;
    while (rem > 0 && this.planI < this.plan.length) {
      const to = this.plan[this.planI], d = this.tipPos.distanceTo(to);
      if (d > 1e-5) this.dir.copy(to).sub(this.tipPos).normalize();
      if (d <= rem) { this.tipPos.copy(to); rem -= d; this.planI++; } else { this.tipPos.addScaledVector(this.dir, rem); rem = 0; }
    }
    this.arrived = this.planI >= this.plan.length;
    this._extend();
  }

  /** Launch at a point: the charge starts out pointing straight at it. */
  aimAt(p) { this.dir.copy(p).sub(this.tipPos).normalize(); this.stuck = false; this.planT = 0; this.plan = null; }

  _home(dt, cmd) { // a homing charge: flies at a fixed speed and can only turn so fast, which is how you dodge it
    this.planT -= dt;
    if (this.planT <= 0) { this.planT = H.homeReplan; this.plan = this.vox.lineFree(this.tipPos, cmd.goal) ? null : this.vox.path(this.tipPos, cmd.goal); this.planI = 1; }
    let target = cmd.goal;
    if (this.plan) {
      while (this.planI < this.plan.length - 1 && this.tipPos.distanceTo(this.plan[this.planI]) < 0.12) this.planI++;
      target = this.plan[this.planI];
    }
    _d.copy(target).sub(this.tipPos);
    if (_d.lengthSq() > 1e-8) {
      _d.normalize();
      const ang = this.dir.angleTo(_d), step = cmd.turn * dt;
      if (ang <= step) this.dir.copy(_d);
      else { _ax.crossVectors(this.dir, _d); if (_ax.lengthSq() < 1e-8) _ax.set(0, 1, 0); this.dir.applyAxisAngle(_ax.normalize(), step).normalize(); }
    }
    // grazing a surface it slides along it; it only gives up if it's blocked every way
    const step = cmd.speed * dt, d = this.dir, t = this.tipPos;
    for (const [mx, my, mz] of SLIDE) {
      _a.set(t.x + d.x * step * mx, t.y + d.y * step * my, t.z + d.z * step * mz);
      if (!this.vox.blocked(_a.x, _a.y, _a.z)) { t.copy(_a); this._extend(); return; }
    }
    this.stuck = true;
  }

  _sweep(dt, cmd) { // swinging from side to side: the nozzle goes straight for the goal, and the hose is the way back to the hole
    _d.copy(cmd.goal).sub(this.tipPos);
    const l = _d.length(), t = this.tipPos, T = this.trail;
    this.arrived = l < 0.02; this.maxed = false; this.stuck = false;
    if (l > 1e-5) {
      const d = this.dir.copy(_d).multiplyScalar(1 / l), step = Math.min(l, cmd.speed * dt);
      for (const [mx, my, mz] of SLIDE) {
        _a.set(t.x + d.x * step * mx, t.y + d.y * step * my, t.z + d.z * step * mz);
        if (!this.vox.blocked(_a.x, _a.y, _a.z)) { t.copy(_a); break; }
      }
    }
    if (this.vox.lineFree(T[0], t)) { T.length = 1; T.push(t.clone()); } // (a clear line: all that's left of any earlier route)
    else if (T.length < 2 || !this.vox.lineFree(T[T.length - 2], t)) { const r = this.vox.path(T[0], t); if (r && r.length >= 2) { T.length = 0; T.push(...r); } }
    let L = 0; for (let i = 1; i < T.length; i++) L += T[i].distanceTo(T[i - 1]);
    this.len = L;
  }

  _retract(dt) { // reeling back along its own path
    const T = this.trail;
    let rem = H.retractSpeed * dt;
    while (rem > 0 && T.length > 1) {
      const a = T[T.length - 1], b = T[T.length - 2], d = a.distanceTo(b);
      if (d <= rem) { rem -= d; T.pop(); } else { a.addScaledVector(_d.copy(b).sub(a).normalize(), rem); rem = 0; }
    }
    this.tipPos.copy(T[T.length - 1]);
    let L = 0; for (let i = 1; i < T.length; i++) L += T[i].distanceTo(T[i - 1]);
    this.len = L;
    if (T.length <= 2 || L <= H.restReach) { this.active = false; this.arrived = this.maxed = this.stuck = false; } // (back to about where it lies at rest)
  }

  /** Spread the points evenly along the trail. */
  _resample() {
    const T = this.trail, n = this.n;
    let L = 0;
    for (let i = 1; i < T.length; i++) L += T[i].distanceTo(T[i - 1]);
    let seg = 1, walked = 0;
    for (let i = 0; i <= n; i++) {
      const s = (L * i) / n;
      while (seg < T.length - 1 && walked + T[seg].distanceTo(T[seg - 1]) < s) { walked += T[seg].distanceTo(T[seg - 1]); seg++; }
      const d = T[seg].distanceTo(T[seg - 1]) || 1;
      this.want[i].copy(T[seg - 1]).lerp(T[seg], Math.min(1, (s - walked) / d));
    }
  }

  /** Where the nozzle rests: on the floor in front of him, or as far as it can get before a wall. */
  _restTarget(base, s, c, out) {
    out.set(base.x, H.floorY, base.z);
    for (let d = 0.05; d <= H.restReach; d += 0.05) {
      const x = base.x + s * d, z = base.z + c * d;
      if (this.vox.blocked(x, H.floorY, z)) break;
      out.x = x; out.z = z;
    }
    return out;
  }

  /**
   * The body of the hose: a chain of fixed-length links pinned at the hole and the nozzle. Stretched out, it lies along the
   * trail. With the nozzle close, the links are longer than the gap, so the excess sags and bows aside.
   */
  _chain(dt, L) {
    const P = this.pts, O = this.old, n = this.n, min = H.minLength;
    const link = Math.max(L, min) / n, slack = min > L ? (min - L) / min : 0;
    const pull = expK(H.track, dt) * (slack > 0 ? Math.max(H.slackPull, 1 - slack * 4) : 1);
    _sw.set(P[n].z - P[0].z, 0, P[0].x - P[n].x); // sideways from the line between the ends
    if (_sw.lengthSq() < 1e-6) _sw.set(1, 0, 0);
    _sw.normalize();
    for (let i = 1; i < n; i++) {
      const p = P[i];
      _a.copy(p).sub(O[i]).multiplyScalar(H.damping);
      O[i].copy(p);
      p.add(_a);
      p.y -= H.sag * dt * dt;
      if (slack > 0) p.addScaledVector(_sw, Math.sin((i / n) * Math.PI) * slack * H.aside * dt * dt);
      p.lerp(this.want[i], pull);
    }
    for (let pass = 0; pass < H.chainPasses; pass++) for (let i = 0; i < n; i++) {
      const a = P[i], b = P[i + 1];
      _d.copy(b).sub(a);
      const d = _d.length() || 1e-5, e = (d - link) / d;
      if (i === 0) b.addScaledVector(_d, -e);
      else if (i === n - 1) a.addScaledVector(_d, e);
      else { a.addScaledVector(_d, e * 0.5); b.addScaledVector(_d, -e * 0.5); }
    }
    for (let i = 1; i < n; i++) { // the floor holds it up, and it can't enter anything
      const p = P[i];
      if (p.y < H.floorY) p.y = H.floorY;
      if (this.vox.blocked(p.x, p.y, p.z)) p.copy(this.vox.blocked(O[i].x, O[i].y, O[i].z) ? P[i - 1] : O[i]);
    }
  }

  /**
   * Per fixed tick. base: the hole. heading: the way he faces. cmd: null (rest) or
   * { mode: 'approach', goal, speed, hover? } or { mode: 'home', goal, speed, turn }.
   */
  tick(dt, base, heading, cmd) {
    this.t += dt;
    const P = this.pts, n = this.n, s = Math.sin(heading), c = Math.cos(heading);
    for (let i = 0; i <= n; i++) this.prev[i].copy(P[i]);
    if (!this.placed) {
      this.placed = true; this.active = false;
      this._restTarget(base, s, c, _b);
      for (let i = 0; i <= n; i++) { P[i].lerpVectors(_d.set(base.x, base.y, base.z), _b, i / n); this.old[i].copy(P[i]); this.prev[i].copy(P[i]); }
    }
    P[0].set(base.x, base.y, base.z);
    if (cmd && !this.active) this._begin(base, s, c);
    this.maxLen = cmd?.maxLen ?? H.length;
    if (!cmd && !this.active) { // at rest: the nozzle lies in front of him, the rest of it on the floor as it falls
      P[n].lerp(this._restTarget(base, s, c, _b), expK(H.follow, dt));
      for (let i = 1; i < n; i++) this.want[i].lerpVectors(P[0], P[n], i / n);
      this._chain(dt, P[0].distanceTo(P[n]));
      return;
    }
    this.trail[0].set(base.x, base.y, base.z);
    if (!cmd) { this._retract(dt); if (!this.active) return; } // (fully back in: it lies at rest from next tick)
    else if (cmd.mode === 'home') this._home(dt, cmd);
    else if (cmd.mode === 'sweep') this._sweep(dt, cmd);
    else this._approach(dt, cmd);
    if (this.trail.length > 1) this.trail[this.trail.length - 1].copy(this.tipPos);
    this._resample();
    P[n].copy(this.tipPos);
    { let L = 0; const T = this.trail; for (let i = 1; i < T.length; i++) L += T[i].distanceTo(T[i - 1]); this._chain(dt, L); }
    if (cmd && cmd.hover && this.arrived) { // hovering: the nozzle sways and sniffs
      _sw.set(Math.sin(this.t * H.swayRate), Math.sin(this.t * H.swayRate * 1.4) * 0.6, Math.cos(this.t * H.swayRate * 0.8)).multiplyScalar(H.sway);
      P[n].add(_sw);
    }
    if (P[n].y < H.floorY) P[n].y = H.floorY;
  }

  /** Per rendered frame: the smooth tube through the points. */
  frame(alpha) {
    for (let i = 0; i <= this.n; i++) this.draw[i].lerpVectors(this.prev[i], this.pts[i], alpha);
    this.curve.updateArcLengths(); // (three.js caches the curve's length: it has to be told the points moved)
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.TubeGeometry(this.curve, H.tubeSegments, H.radius, H.tubeSides, false);
    const a = this.draw[this.n - 1], b = this.draw[this.n];
    this.nozzle.position.copy(b);
    if (a.distanceToSquared(b) > 1e-8) this.nozzle.quaternion.setFromUnitVectors(_up, _dir.copy(b).sub(a).normalize());
  }
}
