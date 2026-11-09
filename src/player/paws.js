// The first-person paws: grey-box blocks with toe bumps, on the viewmodel layer (drawn after the world with depth
// cleared, never vertex-snapped). They only exist while hanging, climbing or swiping. Hanging and climbing plant them on
// the real surface in world space, so they stay put as you look around; a final guard makes sure you see both or neither.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1 } from '../render/ps1-material.js';
import { LAYER_VIEWMODEL } from '../render/ps1-renderer.js';

const V = TUNING.paws, SW = TUNING.swipe, L = TUNING.ledge;
const ease = (t) => t * t * (3 - 2 * t);

function buildPaw(mat) {
  const g = new THREE.Group();
  // the forearm pivots at the wrist (the group's origin) and runs back toward the cat along +z
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.14).translate(0, 0, 0.07), mat);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05), mat);
  g.add(leg, pad);
  for (const x of [-0.018, -0.006, 0.006, 0.018]) {
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.014, 0.018), mat);
    toe.position.set(x, 0.002, -0.03);
    g.add(toe);
  }
  g.traverse((o) => o.layers.set(LAYER_VIEWMODEL));
  g.userData.leg = leg;
  return g;
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _cq = new THREE.Quaternion(), _m = new THREE.Matrix4(), _r = new THREE.Quaternion();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Paws {
  constructor(camera) {
    const mat = makePS1(new THREE.MeshLambertMaterial({ color: V.color, emissive: V.glow, fog: false }));
    this.camera = camera;
    this.left = buildPaw(mat); this.right = buildPaw(mat);
    camera.add(this.left, this.right);
    this.left.visible = this.right.visible = false;
    this.grip = 0; // 0 hidden .. 1 on the surface
  }

  /** Put a paw at a world position and orientation (from its basis), in the camera's space. */
  _place(paw, px, py, pz, turn = 0) {
    _p.set(px, py, pz);
    this.camera.worldToLocal(_p);
    paw.position.copy(_p);
    _m.makeBasis(_x, _y, _z);
    _q.setFromRotationMatrix(_m);
    if (turn) _q.premultiply(_r.setFromAxisAngle(UP, turn));
    this.camera.getWorldQuaternion(_cq).invert();
    paw.quaternion.copy(_cq).multiply(_q);
  }

  /** Both paws on the lip of the ledge, kept on the ledge itself and leaning with the view. */
  _plantHang(player) {
    const h = player.hang, b = h.col;
    _z.set(h.nx, 0, h.nz); // the paw's back runs out from the ledge; its toes point in over the top
    _y.copy(UP);
    _x.crossVectors(_y, _z);
    const look = wrap(player.yaw - player._hangYaw()), lean = Math.min(1, Math.abs(look) / L.yawLimit);
    // along the edge: the point the eye is turned toward, and how far apart the paws sit
    let spread = V.hangSpread * (1 - V.hangNarrow * lean);
    const t0 = h.ex * _x.x + h.ez * _x.z, c0 = b.cx * _x.x + b.cz * _x.z, half = Math.abs(_x.x) * b.hx + Math.abs(_x.z) * b.hz;
    let t = t0 - Math.max(-V.hangFollow, Math.min(V.hangFollow, Math.tan(Math.max(-1.35, Math.min(1.35, look))) * V.hangDist));
    // never past the end of the ledge: on a short one the paws close up instead of one hanging off in the air
    if (half < spread + V.hangMargin) { spread = Math.max(0.012, half - V.hangMargin); t = c0; }
    else t = Math.max(c0 - half + spread + V.hangMargin, Math.min(c0 + half - spread - V.hangMargin, t));
    const shake = (side) => Math.sin(player.time * V.trembleRate + side) * V.tremble * (1 - player.stamina);
    for (const [paw, side] of [[this.left, -1], [this.right, 1]]) {
      const along = t + side * spread - t0;
      this._place(paw, h.ex + _x.x * along - h.nx * V.hangIn, h.top + V.hangLift - (1 - this.grip) * V.drop + shake(side), h.ez + _x.z * along - h.nz * V.hangIn, look * V.hangTurn);
      paw.userData.leg.rotation.x = V.hangLeg; // the forearm drops away below the lip
      paw.userData.leg.scale.z = V.hangLegLen; // ...and reaches down past the bottom of the view
    }
  }

  /** Both paws reaching up the face, stepping past each other as the cat climbs. */
  _plantClimb(player) {
    const c = player.climb;
    _y.set(c.x, 0, c.z); // the back of the paw faces away from the wall
    _z.set(0, -1, 0); // toes point up the wall, the forearm hangs down it
    _x.crossVectors(_y, _z);
    const camY = this.camera.position.y, phase = (camY / V.climbStride) * Math.PI * 2;
    const wallX = player.pos.x - c.x * (TUNING.player.radius - V.climbIn), wallZ = player.pos.z - c.z * (TUNING.player.radius - V.climbIn);
    for (const [paw, side] of [[this.left, -1], [this.right, 1]]) {
      const shake = Math.sin(player.time * V.trembleRate + side) * V.tremble * (1 - player.stamina);
      const reach = Math.sin(phase + (side > 0 ? 0 : Math.PI)) * V.climbReach;
      this._place(paw, wallX + _x.x * side * V.climbSpread, camY + V.climbUp + reach - (1 - this.grip) * V.drop + shake, wallZ + _x.z * side * V.climbSpread);
      paw.userData.leg.rotation.x = V.climbLeg; // the forearm comes back from the wall toward the cat
      paw.userData.leg.scale.z = V.hangLegLen;
    }
  }

  /** You see both paws or neither: if one has slid out of the frame, the pair is moved back into it. */
  _keepBoth() {
    const cam = this.camera, tan = Math.tan((cam.fov * Math.PI) / 360) * cam.aspect, l = this.left.position, r = this.right.position;
    l.z = Math.min(l.z, -V.keepNear); r.z = Math.min(r.z, -V.keepNear);
    const nl = l.x / (-l.z * tan), nr = r.x / (-r.z * tan), lo = Math.min(nl, nr), hi = Math.max(nl, nr), K = V.keepEdge;
    let shift = 0;
    if (hi > K && lo > -K) shift = K - hi; else if (lo < -K && hi < K) shift = -K - lo;
    if (!shift) return;
    l.x += shift * -l.z * tan; r.x += shift * -r.z * tan;
  }

  /** The right paw mid-swipe: it rises into view, sweeps across, drops away. */
  _swipePose(player, alpha) {
    const p = this.right, leg = p.userData.leg;
    leg.rotation.x = V.swipeLeg; leg.scale.z = V.swipeLegLen;
    const a = player.prevSwipeT >= 0 ? player.prevSwipeT + (player.swipeT - player.prevSwipeT) * alpha : player.swipeT;
    const u = Math.min(1, a / SW.time);
    const t = u < V.swipeOut ? ease(u / V.swipeOut) : 1 - ease((u - V.swipeOut) / (1 - V.swipeOut));
    const reveal = ease(Math.min(1, Math.min(u, 1 - u) / V.reveal)), arc = Math.sin(t * Math.PI);
    p.position.set(V.swipeStartX + (V.swipeEndX - V.swipeStartX) * t, V.swipeHiddenY + (V.swipeY - V.swipeHiddenY) * reveal + arc * V.swipeLift, V.swipeZ - arc * V.swipeReach);
    p.rotation.set(0, V.swipeYaw0 + (V.swipeYaw1 - V.swipeYaw0) * t, V.swipeRoll0 + (V.swipeRoll1 - V.swipeRoll0) * t);
  }

  /** Per rendered frame, after the camera is placed. hidden: third-person debug view. */
  frame(player, dt, alpha, hidden = false) {
    const gripping = (player.mode === 'hang' || player.mode === 'mantle') && !!player.hang.col;
    const climbing = !gripping && (player.mode === 'climb' || player.mode === 'slide') && !!player.climb.col;
    const swiping = !gripping && !climbing && player.swipeT >= 0;
    this.grip += ((gripping || climbing ? 1 : 0) - this.grip) * (1 - Math.exp(-V.ease * dt));
    this.left.visible = (gripping || climbing) && !hidden;
    this.right.visible = (gripping || climbing || swiping) && !hidden;
    if (hidden) return;
    if (gripping) { this._plantHang(player); this._keepBoth(); }
    else if (climbing) { this._plantClimb(player); this._keepBoth(); }
    else if (swiping) this._swipePose(player, alpha);
  }
}
