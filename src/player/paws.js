// The first-person paws (cat_forelegs.glb), on the viewmodel layer (drawn after the world with depth cleared, never
// vertex-snapped). Walking, hanging and climbing plant them on the real surface in world space, so they stay put as you
// move and look around; the swipe is done by the right paw itself.
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
const _col = new THREE.Color(), _own = new THREE.Color(), _h = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3(), _sq = new THREE.Quaternion(), _e = new THREE.Euler();

export class Paws {
  constructor(camera) {
    this.camera = camera;
    this.left = emptyPaw(); this.right = emptyPaw();
    this.rig = null; this.mixer = null; this.swipeClip = null; // the whole rig, for the swipe's own animation
    camera.add(this.left, this.right);
    loadGLB(TUNING.assets.forelegs).then((g) => {
      g.scene.traverse((o) => { if (o.isMesh) { o.material.emissive.setHex(V.glow); if (!this.mats.includes(o.material)) { this.mats.push(o.material); this.darkOf.set(o.material, new THREE.MeshBasicMaterial({ map: o.material.map, vertexColors: o.material.vertexColors, color: o.material.color.clone().multiplyScalar(V.darkGlow), fog: false })); } o.material.fog = false; o.layers.set(LAYER_VIEWMODEL); } o.frustumCulled = false; }); // (a little light of their own, so an underside isn't black)
      fillPaw(this.left, g.scene, 'L'); fillPaw(this.right, g.scene, 'R');
      for (const p of [this.left, this.right]) p.traverse((o) => { if (o.isMesh && this.darkOf.has(o.material)) this.meshes.push([o, o.material, this.darkOf.get(o.material)]); }); // (the paws you see are clones: they share the materials)
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
    this.world = null; this._g = { y: 0, surface: '', collider: null }; this.nextPaw = 1; this.swipeU = -1; this.walkVisible = false;
    this.dark = 0; this.mats = []; this.meshes = []; this.dk = false; this.darkOf = new Map(); // (in the blackout they keep a little light of their own, or they'd be black shapes)
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

  /** The forearm to a shoulder given in world space (walking: the body's, not the head's). */
  _aimArmWorld(paw, wx, wy, wz) {
    _a.set(wx, wy, wz); this.camera.worldToLocal(_a);
    _a.sub(paw.position);
    const l = _a.length();
    _a.applyQuaternion(_r.copy(paw.quaternion).invert()).normalize();
    paw.userData.leg.quaternion.setFromUnitVectors(_zAxis, _a);
    const k = l / (V.legLen * V.plantScale), fat = 1;
    paw.userData.leg.scale.set(fat, fat, k); // (fills out a little as it stretches, rather than going thin)
  }

  /** Highest surface under a paw at (x, z), if it's about level with the cat's own (null: off the edge, or a wall). */
  _surface(x, z, feet) {
    if (!this.world) return feet;
    const g = this.world.ground(x, z, 0.012, feet + V.gait.stepUp, this._g);
    return g.y >= feet - V.gait.stepDown ? g.y : null;
  }

  /**
   * Where a paw wants to be: ahead of the shoulder on its own side, kept on whatever the cat is standing on. Off the edge
   * of a table or shelf it's pulled back in toward the body until it's on the surface again (never over thin air).
   */
  _target(out, bx, bz, fx, fz, rx, rz, side, ahead, feet) {
    const G = V.gait;
    for (let k = 0; k <= 5; k++) {
      const a = ahead * (1 - k / 5), w = G.side * (1 - k * 0.12);
      out.x = bx + fx * a + rx * side * w; out.z = bz + fz * a + rz * side * w;
      const y = this._surface(out.x, out.z, feet);
      if (y !== null) { out.y = y; return out; }
    }
    out.y = feet; return out; // (nothing under it at all: tucked in under the cat)
  }

  /**
   * Walking: each front paw is planted in the world and stays exactly where it was put while the cat moves (or turns)
   * over it, until it's too far from where it belongs; then it lifts and steps, the two paws taking turns. Turning on
   * the spot shuffles them round, and they never stand on air past a table's edge.
   */
  _gait(player, alpha, dt) {
    const G = V.gait, yaw = player.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const bx = player.prev.x + (player.pos.x - player.prev.x) * alpha, bz = player.prev.z + (player.pos.z - player.prev.z) * alpha;
    const feet = player.prevEyeFeet + (player.eyeFeet - player.prevEyeFeet) * alpha;
    const vx = player.vel.x, vz = player.vel.z, speed = Math.hypot(vx, vz), run = player.gait === 'run' ? 1 : 0;
    const moving = Math.min(1, speed / TUNING.player.walkSpeed), reach = G.reach[run] * moving, swing = G.swing[run];
    for (const [paw, side] of [[this.left, -1], [this.right, 1]]) {
      const st = paw.userData.step || (paw.userData.step = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0, t: 1, fresh: true });
      const home = this._target(_h, bx, bz, fx, fz, rx, rz, side, G.centre, feet);
      if (st.fresh || Math.abs(st.ty - feet) > 0.12 || Math.hypot(st.x - home.x, st.z - home.z) > 0.6) { // (just landed, or teleported): straight down where it belongs
        st.x = st.tx = home.x; st.y = st.ty = home.y; st.z = st.tz = home.z; st.t = 1; st.fresh = false;
      }
      if (st.t < 1) { // in the air, on its way
        st.t = Math.min(1, st.t + dt / swing);
        const u = ease(st.t), lift = Math.sin(st.t * Math.PI) * G.lift[run];
        st.x = st.fx + (st.tx - st.fx) * u; st.z = st.fz + (st.tz - st.fz) * u; st.y = st.fy + (st.ty - st.fy) * u + lift;
        if (st.t >= 1) st.y = st.ty;
      } else if (this.nextPaw === side) {
        const err = Math.hypot(st.x - home.x, st.z - home.z), other = (side < 0 ? this.right : this.left).userData.step;
        const need = speed > 0.2 ? Math.max(G.trigger, reach) : G.settle;
        if (err > need && (!other || other.t >= G.overlap)) { // its turn: lift and put it down a little ahead of where it belongs
          const to = this._target(_t, bx + vx * swing, bz + vz * swing, fx, fz, rx, rz, side, G.centre + reach, feet);
          st.fx = st.x; st.fy = st.y; st.fz = st.z; st.tx = to.x; st.ty = to.y; st.tz = to.z; st.t = 0;
          this.nextPaw = -side;
        } else if (other && other.t >= 1) {
          const oh = this._target(_t, bx, bz, fx, fz, rx, rz, -side, G.centre, feet);
          if (Math.hypot(other.x - oh.x, other.z - oh.z) > err + 0.01) this.nextPaw = -side; // (the other one is further out: it goes first)
        }
      }
      // pad flat on the surface, toes the way the cat faces
      _x.set(rx, 0, rz); _y.set(0, 1, 0); _z.set(-fx, 0, -fz);
      this._place(paw, st.x, st.y + G.padY, st.z);
      this._aimArmWorld(paw, bx + fx * G.shoulder[1] + rx * side * G.shoulder[0], feet + G.shoulder[2], bz + fz * G.shoulder[1] + rz * side * G.shoulder[0]);
    }
  }

  /**
   * The swipe, done by the same paw that was walking (no swapping in another pair): the right paw comes up off the floor
   * into view, bats across from right to left, and goes back down to the floor. The left one stays planted. In the air
   * the right paw comes up from below the view instead.
   */
  _swipePaw(player, alpha) {
    const S = V.swipe, paw = this.right;
    const a = player.swipeT >= 0 ? (player.prevSwipeT >= 0 ? player.prevSwipeT + (player.swipeT - player.prevSwipeT) * alpha : player.swipeT) : -1;
    if (a < 0) { if (this.swipeU >= 0 && paw.userData.step) paw.userData.step.fresh = true; this.swipeU = -1; return false; } // (back down on the floor where it belongs)
    const u = this.swipeU = Math.min(1, a / SW.time);
    // the path in the camera's space: up on the right, across, and back down
    const P = S.path, k = u < S.up ? 0 : u < S.across ? 1 : 2, t = k === 0 ? u / S.up : k === 1 ? (u - S.up) / (S.across - S.up) : (u - S.across) / (1 - S.across);
    const A = P[k], B = P[k + 1], e = ease(t);
    _s.set(A[0] + (B[0] - A[0]) * e, A[1] + (B[1] - A[1]) * e + (k === 1 ? Math.sin(t * Math.PI) * S.arc : 0), A[2] + (B[2] - A[2]) * e);
    const sweep = k === 0 ? 0 : k === 1 ? e : 1;
    _sq.setFromEuler(_e.set(S.pitch, S.yaw[0] + (S.yaw[1] - S.yaw[0]) * sweep, S.roll[0] + (S.roll[1] - S.roll[0]) * sweep, 'YXZ'));
    // how much of the pose is the swipe (vs. the planted paw it rises from and goes back to)
    const w = u < S.blendIn ? ease(u / S.blendIn) : u > S.blendOut ? ease((1 - u) / (1 - S.blendOut)) : 1;
    if (this.walkVisible) { paw.position.lerp(_s, w); paw.quaternion.slerp(_sq, w); }
    else { paw.position.set(_s.x, _s.y - (1 - w) * S.below, _s.z); paw.quaternion.copy(_sq); } // (in the air: up from below the view)
    paw.visible = true;
    return true;
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
    _y.applyAxisAngle(_x, V.hangCurl); _z.applyAxisAngle(_x, V.hangCurl); // curled over the lip: the backs of the paws to you, the toes hooked up and over the edge (they are drawn over everything, so flat on top you saw their undersides through the ledge)
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
    const O = V.order, cur = O.includes(settings.pawMode) ? settings.pawMode : 'natural', next = O[(O.indexOf(cur) + 1) % O.length];
    setSetting('pawMode', next);
    return next;
  }

  /** Per rendered frame, after the camera is placed. hidden: third-person debug view. */
  frame(player, dt, alpha, hidden = false) {
    // lit like the tail (a faint warm glow). In the blackout each part shows its own colours, dimmed (the ginger leg, the pale pads): unlit, so they aren't lost
    if (this.meshes.length) { const dk = this.dark > V.darkAt; if (dk !== this.dk) { this.dk = dk; for (const [o, lit, dark] of this.meshes) o.material = dk ? dark : lit; } for (const m of this.mats) m.emissive.setHex(V.glow); }
    if (this.rig) this.rig.visible = false; // (the rig's own swipe clip is retired: the walking paw does the swipe itself)
    const gripping = (player.mode === 'hang' || player.mode === 'mantle') && !!player.hang.col;
    const climbing = !gripping && (player.mode === 'climb' || player.mode === 'slide') && !!player.climb.col;
    this.grip += ((gripping || climbing ? 1 : 0) - this.grip) * (1 - Math.exp(-V.ease * dt));
    if (hidden) { this.left.visible = this.right.visible = false; this.swipeU = -1; return; }
    if (gripping || climbing) {
      this.left.visible = this.right.visible = true; this.swipeU = -1; this.walkVisible = false;
      for (const p of [this.left, this.right]) if (p.userData.step) p.userData.step.fresh = true;
      if (gripping) this._plantHang(player, alpha, dt); else this._plantClimb(player, alpha, dt);
      this._keepBoth(); this._aimArm(this.left, -1); this._aimArm(this.right, 1);
      return;
    }
    const walk = settings.pawMode !== 'off' && player.grounded && player.mode === 'move';
    if (walk) { if (!this.walkVisible) for (const p of [this.left, this.right]) if (p.userData.step) p.userData.step.fresh = true; this._gait(player, alpha, dt); }
    this.walkVisible = walk;
    this.left.visible = this.right.visible = walk;
    if (this._swipePaw(player, alpha)) this._aimArmWorld(this.right, ...this._shoulderR(player, alpha));
  }

  /** The right shoulder, in the world (the swiping forearm runs back to it, the same as walking). */
  _shoulderR(player, alpha) {
    const G = V.gait, yaw = player.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const bx = player.prev.x + (player.pos.x - player.prev.x) * alpha, bz = player.prev.z + (player.pos.z - player.prev.z) * alpha;
    const feet = player.prevEyeFeet + (player.eyeFeet - player.prevEyeFeet) * alpha;
    return [bx + fx * G.shoulder[1] + rx * G.shoulder[0], feet + G.shoulder[2], bz + fz * G.shoulder[1] + rz * G.shoulder[0]];
  }
}
