// The hose: a chain of points in world space with a smooth tube rebuilt along them every frame. At rest it trails on the
// floor in front of him, lagging behind his turns. To reach, its tip is sent to a goal and the rest of it follows a curve
// out of the hole and up to the tip, like a snake rearing, with a wave running along it. It's any length it needs to be.
// Length, radius and segment counts are in TUNING.hose.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1 } from '../render/ps1-material.js';

const H = TUNING.hose;
const expK = (rate, dt) => 1 - Math.exp(-rate * dt);
const _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3(), _side = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3();

export class Hose {
  constructor(scene) {
    const n = this.n = H.segments;
    this.pts = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this.prev = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this.draw = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this.tipGoal = new THREE.Vector3();
    this.reaching = false;
    this.t = 0;
    this.curve = new THREE.CatmullRomCurve3(this.draw);
    this.curve.arcLengthDivisions = 60;
    this.mat = makePS1(new THREE.MeshLambertMaterial({ color: H.color }));
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.nozzle = new THREE.Mesh(new THREE.CylinderGeometry(H.nozzleR, H.nozzleR * 1.3, H.nozzleLen, 8).translate(0, H.nozzleLen / 2, 0), makePS1(new THREE.MeshLambertMaterial({ color: H.nozzleColor })));
    scene.add(this.nozzle);
    this.placed = false;
  }

  get tip() { return this.pts[this.n]; }

  /** Where the chain lies at rest: dropping out of the hole and curving along the floor in front of him. */
  _rest(i, base, s, c, out) {
    const f = i / this.n, along = f * H.restReach, wiggle = Math.sin(f * 7 + this.t * 0.8) * H.restSway * f;
    out.set(base.x + s * along + c * wiggle, base.y + (H.floorY - base.y) * Math.min(1, i / 2), base.z + c * along - s * wiggle);
    return out;
  }

  /** Per fixed tick. base: the hole. heading: the way he faces. goal: where to send the tip (or null: rest). speed: m/s. */
  tick(dt, base, heading, goal, speed) {
    this.t += dt;
    const P = this.pts, n = this.n, s = Math.sin(heading), c = Math.cos(heading);
    for (let i = 0; i <= n; i++) this.prev[i].copy(P[i]);
    if (!this.placed) { this.placed = true; for (let i = 0; i <= n; i++) { this._rest(i, base, s, c, P[i]); this.prev[i].copy(P[i]); } }
    P[0].set(base.x, base.y, base.z);
    if (!goal) {
      if (this.reaching) this.reaching = false;
      for (let i = 1; i <= n; i++) { // the further along the hose, the more it lags
        this._rest(i, base, s, c, _d);
        P[i].lerp(_d, expK(H.follow * (1 - 0.72 * (i / n)), dt));
      }
      return;
    }
    if (!this.reaching) { this.reaching = true; this.tipGoal.copy(P[n]); }
    _d.copy(goal).sub(this.tipGoal);
    const dist = _d.length(), step = speed * dt;
    if (dist <= step) this.tipGoal.copy(goal); else this.tipGoal.addScaledVector(_d, step / dist);
    // it can only stretch so far
    _b.set(base.x, base.y, base.z);
    _d.copy(this.tipGoal).sub(_b);
    if (_d.length() > H.length) this.tipGoal.copy(_b).addScaledVector(_d, H.length / _d.length());
    const tip = this.tipGoal, span = _b.distanceTo(tip) || 0.001;
    // a curve: straight out of the hole, then up from underneath to the tip
    _c1.set(base.x + s * span * 0.5, base.y, base.z + c * span * 0.5);
    _c2.copy(tip); _c2.y -= span * H.arch;
    _side.copy(tip).sub(_b).cross(_up); if (_side.lengthSq() < 1e-6) _side.set(c, 0, -s); _side.normalize();
    const amp = H.wiggle * (speed > H.riseSpeed * 1.5 ? H.lungeWiggle : 1), k = expK(H.track, dt);
    for (let i = 1; i < n; i++) {
      const u = i / n, v = 1 - u, A = v * v * v, B = 3 * v * v * u, C = 3 * v * u * u, D = u * u * u;
      _t.set(A * _b.x + B * _c1.x + C * _c2.x + D * tip.x, A * _b.y + B * _c1.y + C * _c2.y + D * tip.y, A * _b.z + B * _c1.z + C * _c2.z + D * tip.z);
      _t.addScaledVector(_side, Math.sin(u * Math.PI * 2 * H.wiggleWaves - this.t * H.wiggleRate) * amp * Math.sin(u * Math.PI));
      P[i].lerp(_t, k);
      if (P[i].y < H.floorY) P[i].y = H.floorY;
    }
    P[n].copy(tip);
  }

  /** Per rendered frame: the smooth tube through the points. */
  frame(alpha) {
    for (let i = 0; i <= this.n; i++) this.draw[i].lerpVectors(this.prev[i], this.pts[i], alpha);
    this.curve.updateArcLengths(); // (three.js caches the curve's length: it has to be told the points moved)
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.TubeGeometry(this.curve, H.tubeSegments, H.radius, H.tubeSides, false);
    const a = this.draw[this.n - 1], b = this.draw[this.n];
    this.nozzle.position.copy(b);
    this.nozzle.quaternion.setFromUnitVectors(_up, _dir.copy(b).sub(a).normalize());
  }
}
