// The first-person paws (cat_forelegs.glb), on the viewmodel layer (drawn after the world with depth cleared, never
// vertex-snapped). They only exist while hanging, climbing or swiping. Hanging and climbing plant them on the real surface
// in world space, so they stay put as you look around; a swipe plays the rig's own clip.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { loadGLB } from '../render/geometry.js';
import { LAYER_VIEWMODEL } from '../render/ps1-renderer.js';
import { settings, setSetting } from '../data/settings.js';

const V = TUNING.paws, SW = TUNING.swipe, L = TUNING.ledge;
const ease = (t) => t * t * (3 - 2 * t);

/** An empty paw: the wrist at the origin, the forearm running back along +z. The real meshes go in once they've loaded. */
function emptyPaw() {
  const g = new THREE.Group(), leg = new THREE.Group();
  g.add(leg);
  g.userData.leg = leg;
  return g;
}

/** Fill a paw with the leg, pad and claws for this side. */
function fillPaw(paw, lib, side) {
  const leg = lib.getObjectByName(`leg_${side}_mesh`).clone(), pad = lib.getObjectByName(`paw_${side}_mesh`).clone(), claws = lib.getObjectByName(`claws_${side}_mesh`).clone();
  leg.position.set(0, 0, V.legLen); // (modelled running forward from the shoulder: moved so its wrist end is at the origin)
  pad.position.set(0, 0, 0); claws.position.set(0, 0, 0); pad.scale.setScalar(V.pawScale / V.plantScale); claws.scale.setScalar(V.pawScale / V.plantScale); // (the pad is a good size even though the forearm has to be slim, this close to the eye)
  paw.userData.leg.add(leg);
  paw.add(pad, claws);
  paw.scale.setScalar(V.plantScale); // (so close to the eye, the full-size model fills the view)
  paw.traverse((o) => o.layers.set(LAYER_VIEWMODEL));
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _cq = new THREE.Quaternion(), _m = new THREE.Matrix4(), _r = new THREE.Quaternion();
const _a = new THREE.Vector3(), _zAxis = new THREE.Vector3(0, 0, 1), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Paws {
  constructor(camera) {
    this.camera = camera;
    this.left = emptyPaw(); this.right = emptyPaw();
    this.rig = null; this.mixer = null; this.swipeClip = null; // the whole rig, for the swipe's own animation
    camera.add(this.left, this.right);
    loadGLB(TUNING.assets.forelegs).then((g) => {
      g.scene.traverse((o) => { if (o.isMesh) { o.material.emissive.setHex(V.glow); o.material.fog = false; o.layers.set(LAYER_VIEWMODEL); } o.frustumCulled = false; }); // (a little light of their own, so an underside isn't black)
      fillPaw(this.left, g.scene, 'L'); fillPaw(this.right, g.scene, 'R');
      this.rig = g.scene; this.rig.visible = false;
      camera.add(this.rig);
      this.mixer = new THREE.AnimationMixer(this.rig);
      this.swipeClip = this.mixer.clipAction(THREE.AnimationClip.findByName(g.animations, 'swipe_R'));
      for (const name of ['idle', 'walk', 'run', 'slink']) { const a = this.mixer.clipAction(THREE.AnimationClip.findByName(g.animations, name)); a.play(); a.setEffectiveWeight(0); this.acts[name] = a; }
      this.swipeClip.setLoop(THREE.LoopOnce, 1); this.swipeClip.clampWhenFinished = true; this.swipeClip.play(); this.swipeClip.paused = true;
    }).catch((e) => console.warn('forelegs failed to load:', e?.message || e));
    this.left.visible = this.right.visible = false;
    this.grip = 0; // 0 hidden .. 1 on the surface
    this.side = 0; // 0 .. 1: how much the climb is going sideways
    this.acts = {}; this.move = 0; this.drop = 0; this.linger = 0; this._w = new Map();
  }

  /** Put a paw at a world position and orientation (from its basis), in the camera's space. */
  _place(paw, px, py, pz, turn = 0, player = null, dt = 0) {
    _p.set(px, py, pz);
    if (player) { // round a corner the paws catch up smoothly instead of jumping
      let w = this._w.get(paw); if (!w) { w = new THREE.Vector3(px, py, pz); this._w.set(paw, w); }
      if (player.cornerT > 0) { w.lerp(_p, 1 - Math.exp(-L.cornerPaw * dt)); _p.copy(w); } else w.copy(_p);
    }
    this.camera.worldToLocal(_p);
    paw.position.copy(_p);
    _m.makeBasis(_x, _y, _z);
    _q.setFromRotationMatrix(_m);
    if (turn) _q.premultiply(_r.setFromAxisAngle(UP, turn));
    this.camera.getWorldQuaternion(_cq).invert();
    paw.quaternion.copy(_cq).multiply(_q);
  }

  /** The forearm runs from the wrist back to the shoulder, just behind the eye: however you look, there's no end to see. */
  _aimArm(paw, side) {
    _a.set(side * V.shoulder[0], V.shoulder[1], V.shoulder[2]).sub(paw.position);
    const l = _a.length();
    _a.applyQuaternion(_r.copy(paw.quaternion).invert()).normalize();
    const leg = paw.userData.leg;
    leg.quaternion.setFromUnitVectors(_zAxis, _a);
    leg.scale.set(1, 1, l / (V.legLen * V.plantScale));
  }

  /** Both paws on the lip of the ledge, kept on the ledge itself and leaning with the view. */
  _plantHang(player, alpha, dt = 0) {
    const h = player.hang, b = h.col;
    _z.set(h.nx, 0, h.nz); // the paw's back runs out from the ledge; its toes point in over the top
    _y.copy(UP);
    _x.crossVectors(_y, _z);
    const look = wrap(player.yaw - player._hangYaw()), lean = Math.min(1, Math.abs(look) / L.yawLimit);
    // along the edge: the point the eye is turned toward, and how far apart the paws sit
    let spread = V.hangSpread * (1 - V.hangNarrow * lean);
    const t0 = h.ex * _x.x + h.ez * _x.z, c0 = b.cx * _x.x + b.cz * _x.z, half = Math.abs(_x.x) * b.hx + Math.abs(_x.z) * b.hz;
    // where the cat is along the edge, interpolated like the camera so the paws don't step against it
    const rx = player.prev.x + (player.pos.x - player.prev.x) * alpha, rz = player.prev.z + (player.pos.z - player.prev.z) * alpha, here = rx * _x.x + rz * _x.z;
    let t = here - Math.max(-V.hangFollow, Math.min(V.hangFollow, Math.tan(Math.max(-1.35, Math.min(1.35, look))) * V.hangDist));
    // never past the end of the ledge: on a short one the paws close up instead of one hanging off in the air
    if (half < spread + V.hangMargin) { spread = Math.max(0.012, half - V.hangMargin); t = c0; }
    else t = Math.max(c0 - half + spread + V.hangMargin, Math.min(c0 + half - spread - V.hangMargin, t));
    const low = Math.max(0, (V.trembleAt - player.stamina) / V.trembleAt); // only when the grip is going
    const dist = player.prevShimmyDist + (player.shimmyDist - player.prevShimmyDist) * alpha, phase = (dist / V.shimmyStride) * Math.PI * 2;
    for (const [paw, side] of [[this.left, -1], [this.right, 1]]) {
      const swing = Math.sin(phase + (side > 0 ? 0 : Math.PI)); // one paw leads, the other follows
      const along = t + side * spread + swing * V.shimmyStep - t0;
      const y = h.top + V.hangLift + Math.max(0, swing) * V.shimmyLift - (1 - this.grip) * V.drop + Math.sin(player.time * V.trembleRate + side) * V.tremble * low;
      this._place(paw, h.ex + _x.x * along - h.nx * V.hangIn, y, h.ez + _x.z * along - h.nz * V.hangIn, look * V.hangTurn, player, dt);
    }
  }

  /** Both paws reaching up the face, stepping past each other as the cat climbs. */
  _plantClimb(player, alpha, dt) {
    const c = player.climb, cam = this.camera.position;
    _y.set(c.x, 0, c.z); // the back of the paw faces away from the wall
    _z.set(0, -1, 0); // toes point up the wall, the forearm hangs down it
    _x.crossVectors(_y, _z);
    // Everything hangs off the camera's own interpolated position, so nothing steps against it from tick to tick.
    this.side += ((player.wside ? 1 : 0) - this.side) * (1 - Math.exp(-V.climbSideEase * dt));
    const dist = player.prevClimbDist + (player.climbDist - player.prevClimbDist) * alpha, phase = (dist / V.climbStride) * Math.PI * 2;
    const wallX = cam.x - c.x * (TUNING.player.radius - V.climbIn), wallZ = cam.z - c.z * (TUNING.player.radius - V.climbIn);
    for (const [paw, side] of [[this.left, -1], [this.right, 1]]) {
      const swing = Math.sin(phase + (side > 0 ? 0 : Math.PI)); // the paws climb past each other, up, down or sideways
      const across = side * V.climbSpread + swing * V.climbSideReach * this.side;
      this._place(paw, wallX + _x.x * across, cam.y + V.climbUp + swing * V.climbReach - (1 - this.grip) * V.drop, wallZ + _x.z * across);

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

  /** Everything off (being dragged in). */
  hide() { this.left.visible = this.right.visible = false; if (this.rig) this.rig.visible = false; }

  /** The experiment: which way of showing the paws while walking. */
  cycleMode() {
    const O = V.order, next = O[(O.indexOf(settings.pawMode) + 1) % O.length];
    setSetting('pawMode', next);
    return next;
  }

  /** The rig: walking, running and so on, always there (how much depends on the mode); a swipe plays its own clip over the top. */
  _driveRig(player, alpha, dt, swiping, hidden) {
    if (!this.rig) return;
    const mode = V.modes[settings.pawMode] || null;
    this.linger = swiping ? V.linger : Math.max(0, this.linger - dt);
    const showing = (mode || swiping || this.linger > 0) && !hidden;
    this.rig.visible = !!showing;
    if (!showing) return;
    const moving = player.grounded && Math.hypot(player.vel.x, player.vel.z) > 0.25 ? 1 : 0;
    this.move += (moving - this.move) * (1 - Math.exp(-9 * dt));
    let off = mode ? mode[0] + (mode[1] - mode[0]) * this.move : -V.offDrop * (1 - this.linger / V.linger);
    if (swiping) off = 0;
    this.drop += (off - this.drop) * (1 - Math.exp(-(swiping ? 30 : 12) * dt));
    this.rig.position.y = this.drop;
    const gait = !moving ? 'idle' : player.gait === 'run' ? 'run' : player.slink > 0.5 ? 'slink' : 'walk';
    for (const [name, a] of Object.entries(this.acts)) a.setEffectiveWeight(swiping ? 0 : name === gait ? 1 : 0);
    if (swiping) {
      const a = player.prevSwipeT >= 0 ? player.prevSwipeT + (player.swipeT - player.prevSwipeT) * alpha : player.swipeT;
      this.swipeClip.setEffectiveWeight(1); this.swipeClip.time = Math.min(1, a / SW.time) * this.swipeClip.getClip().duration;
      this.mixer.update(0);
    } else { this.swipeClip.setEffectiveWeight(0); this.mixer.update(dt); }
  }

  /** Per rendered frame, after the camera is placed. hidden: third-person debug view. */
  frame(player, dt, alpha, hidden = false) {
    const gripping = (player.mode === 'hang' || player.mode === 'mantle') && !!player.hang.col;
    const climbing = !gripping && (player.mode === 'climb' || player.mode === 'slide') && !!player.climb.col;
    const swiping = !gripping && !climbing && player.swipeT >= 0;
    this.grip += ((gripping || climbing ? 1 : 0) - this.grip) * (1 - Math.exp(-V.ease * dt));
    this.left.visible = (gripping || climbing) && !hidden;
    this.right.visible = (gripping || climbing) && !hidden;
    if (gripping || climbing) { if (this.rig) this.rig.visible = false; } else this._driveRig(player, alpha, dt, swiping, hidden);
    if (hidden) return;
    if (gripping) { this._plantHang(player, alpha, dt); this._keepBoth(); this._aimArm(this.left, -1); this._aimArm(this.right, 1); }
    else if (climbing) { this._plantClimb(player, alpha, dt); this._keepBoth(); this._aimArm(this.left, -1); this._aimArm(this.right, 1); }
  }
}
