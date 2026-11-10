// The first run opens quietly: Mr. Tidy isn't here yet, and the cat is shut in the living room (pet gates across the arch
// and the kitchen doorway). Prompts and a little arrow lead it up the bookcase and across to the high shelf where the TV
// remote is: that teaches jumping, a charged jump and the dash. Batting the remote plays "The Mr. Tidy Hour" (the view is
// held on the screen and he's introduced); then it's told to pull the TV's plug, the trick that will save it later. Nothing
// can be knocked over until it's done. Then the gates go over and sink away, and he arrives. Enter skips it.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { audio } from '../audio/audio.js';
import { makePS1 } from '../render/ps1-material.js';

const T = TUNING.tutorial;
// [step, words, where the arrow points: a solid's id, 'remote', 'plug' or null]
const STEPS = [
  ['move', 'Walk with W A S D. Look around with the mouse.', null],
  ['jump', 'Hold SPACE to crouch, let go to jump. Hop up onto the bottom of the bookcase.', 'book1'],
  ['climb', 'Climb it like stairs, shelf by shelf. Hold SPACE longer for a bigger jump.', 'book4'],
  ['leap', 'The TV remote is on the high shelf. Leap across to it. Falling short? Tap SHIFT in mid-air to dash.', 'rodW'],
  ['remote', 'Left click to swipe. Bat the remote.', 'remote'],
  ['show', '', null],
  ['plug', 'The TV is still on. Get down and swipe its plug out of the wall. Unplugging things stops them: remember that.', 'plug'],
  ['go', 'Now knock things over until Grandma wakes up. Careful... something is coming.', null],
];
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _t = new THREE.Vector3(), _p = new THREE.Vector3();

function arrowSprite() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d');
  g.fillStyle = '#000'; for (let y = 0; y < 9; y++) g.fillRect(y + 1, y + 6, Math.max(1, 15 - y * 2), 1);
  g.fillStyle = '#ffd27a'; for (let y = 0; y < 8; y++) g.fillRect(y + 1, y + 5, Math.max(1, 14 - y * 2), 1); g.fillRect(6, 0, 4, 6);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false, transparent: true }));
  s.scale.setScalar(0.09); s.renderOrder = 5; s.visible = false;
  return s;
}

export class Tutorial {
  constructor({ hud, player, camera, input, vac, tv, world, scene, knock, byId }) {
    Object.assign(this, { player, camera, input, vac, tv, knock, byId });
    this.tip = hud.label('hud-tip').place('center', 0, 0.72);
    this.active = false; this.i = 0; this.t = 0; this.moved = 0; this.watch = 0; this.from = new THREE.Quaternion(); this.eye = new THREE.Vector3();
    this.arrow = arrowSprite(); scene.add(this.arrow);
    // what keeps the cat in the living room: colliders (off unless the tutorial is on) and what you see of them
    const W = LEVEL.wallT;
    this.walls = [world.addBox(3.05, 1.5, 0, 2.5, 3, W, 0, { tag: 'tutorial' }), world.addBox(6, 1.5, 4.35, W * 2, 3, 0.9, 0, { tag: 'tutorial' })];
    for (const b of this.walls) b.enabled = false;
    // two pet gates, the same height: across the arch to the hall (it falls into the hall) and across the kitchen doorway
    // (it falls into the kitchen)
    this.gateMat = makePS1(new THREE.MeshLambertMaterial({ color: 0xe8e4d8, transparent: true }));
    this.gates = [this._gate(2.5, 3.05, -0.06, 0, -1), this._gate(0.9, 6, 4.35, Math.PI / 2, 1)];
    for (const g of this.gates) { scene.add(g.pivot); g.pivot.visible = false; }
    this.gateT = -1; // s since they went over (-1: standing, or long gone)
  }

  /** A tall white pet gate, w wide, standing at (x, z) turned by yaw. fall: which way it goes over (+1 / -1 along its depth). */
  _gate(w, x, z, yaw, fall) {
    const g = new THREE.Group(), white = this.gateMat, H = T.gateHeight, half = w / 2 - 0.03;
    const bar = (bw, h, d, bx, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, h, d), white); m.position.set(bx, y, 0); g.add(m); };
    bar(0.05, H, 0.05, -half, H / 2); bar(0.05, H, 0.05, half, H / 2); bar(w, 0.04, 0.03, 0, H - 0.02); bar(w, 0.04, 0.03, 0, 0.06);
    const n = Math.max(2, Math.round((half * 2 - 0.1) / 0.075));
    for (let i = 0; i <= n; i++) bar(0.018, H - 0.1, 0.018, -half + 0.05 + ((half * 2 - 0.1) * i) / n, H / 2);
    const pivot = new THREE.Group(); pivot.position.set(x, 0, z); pivot.rotation.y = yaw; pivot.add(g);
    return { pivot, tilt: g, fall };
  }

  /** The gates: standing, or k of the way over (0..1). */
  _setGates(visible, k = 0, sink = 0, alpha = 1) {
    for (const g of this.gates) { g.pivot.visible = visible; g.tilt.rotation.x = g.fall * (Math.PI / 2) * k * k; g.pivot.position.y = -sink; }
    this.gateMat.opacity = alpha; this.gateMat.depthWrite = alpha > 0.99;
  }

  get step() { return STEPS[this.i]?.[0]; }
  get watching() { return this.active && this.step === 'show'; }

  /** Shut in, and quiet. */
  start() {
    this.active = true; this.i = 0; this.t = 0; this.moved = 0;
    this.vac.sleep();
    this.tv.set('on');
    this.knock.locked = true;
    for (const b of this.walls) b.enabled = true;
    this._setGates(true); this.gateT = -1;
    this._show();
  }

  _show() {
    const s = STEPS[this.i];
    if (!s || !s[1]) { this.tip.show(false); return; }
    this.tip.set([{ text: s[1] }, { text: 'ENTER: skip the tutorial', dim: true }], 'center');
    this.tip.show(true);
  }

  _next() { this._goTo(this.i + 1); }

  /** Straight to a step (a later one, if the cat has already done what the ones in between ask). */
  _goTo(i) { this.i = i; this.t = 0; this._show(); audio.play('cat.grab', { gain: 0.4 }); }

  _index(name) { return STEPS.findIndex((s) => s[0] === name); }

  /** Everything at once (Enter). */
  skip() {
    if (!this.active) return;
    if (this.step === 'show') this.player.frozen = false;
    this.tv.set('off');
    this._finish();
  }

  /** Let out: the gates go over, he arrives. */
  _finish() {
    this.active = false; this.tip.show(false); this.arrow.visible = false;
    this.knock.locked = false;
    for (const b of this.walls) b.enabled = false;
    if (this.gates[0].pivot.visible) { audio.play('knock.thud', { pos: { x: 3.05, y: 0.3, z: 0 } }); audio.play('knock.thud', { pos: { x: 6, y: 0.3, z: 4.35 }, delay: 0.12 }); this.gateT = 0; }
    this.vac.arrive();
  }

  /** The house as it is with the tutorial over (a later run). */
  opened() {
    for (const b of this.walls) b.enabled = false;
    this._setGates(false); this.gateT = -1;
    this.knock.locked = false;
  }

  /** The paw went out: the remote, then the plug. */
  onSwipe(camera) {
    if (!this.active) return;
    if (this.i <= this._index('remote') && this.tv.pokeRemote(camera)) { this._goTo(this._index('show')); this.player.resetMotion(); this.player.frozen = true; this.from.copy(camera.quaternion); this.watch = 0; } // (however it got up there)
    else if (this.step === 'plug' && this.tv.pokePlug(camera)) this._next();
  }

  /** Per fixed tick. */
  tick(dt) {
    // after: the gates go over, lie there a moment, then sink away into the floor as they fade (nothing just pops out)
    if (!this.active && this.gateT >= 0) {
      this.gateT += dt;
      const G = T.gates, t = this.gateT, fade = Math.max(0, Math.min(1, (t - G.fall - G.lie) / G.fade)), e = fade * fade * (3 - 2 * fade);
      this._setGates(true, Math.min(1, t / G.fall), e * G.sink, 1 - e);
      if (fade >= 1) { this._setGates(false); this.gateT = -1; }
    }
    if (!this.active) return;
    if (this.input.pressed('Enter')) { this.skip(); return; }
    this.t += dt;
    const P = this.player, on = P.grounded ? P.groundCollider?.id : null;
    // the climb: each step is passed by doing it, and doing a later one passes all the ones before it (it goes by where the
    // cat has got to, not by the order the lessons come in)
    if (this.i <= this._index('leap')) {
      const reached = on === 'rodW' ? 'leap' : on === 'book4' ? 'climb' : ['book1', 'book2', 'book3'].includes(on) ? 'jump' : null;
      if (reached && this._index(reached) >= this.i) { this._goTo(this._index(reached) + 1); return; }
      if (this.step === 'move') { this.moved += Math.hypot(P.pos.x - P.prev.x, P.pos.z - P.prev.z); if (this.moved > T.moveFor) this._next(); }
      return;
    }
    if (this.step === 'show' && this.tv.state !== 'show' && this.t > 1) { // it's over: the view comes back to the cat, looking at the set (the plug is next)
      _m.lookAt(this.eye, _t.fromArray(LEVEL.tvScreen), _up);
      const e = new THREE.Euler().setFromRotationMatrix(_m, 'YXZ');
      P.yaw = e.y; P.pitch = Math.max(-1.2, Math.min(1.2, e.x)); P.frozen = false; this._next();
    } else if (this.step === 'go' && this.t > T.arriveAfter) this._finish();
  }

  /** Where the arrow is pointing for this step, or null. */
  _target(out) {
    const id = STEPS[this.i]?.[2];
    if (!id) return null;
    if (id === 'remote') return out.fromArray(LEVEL.remote).setY(LEVEL.remote[1] + 0.12);
    if (id === 'plug') return out.fromArray(LEVEL.tvOutlet.pos).setY(0.48);
    const b = this.byId.get(id);
    return out.set((b.min[0] + b.max[0]) / 2, b.max[1] + 0.22, (b.min[2] + b.max[2]) / 2);
  }

  /** Per rendered frame, after the player's camera is placed: the arrow; during the programme, the view held on the screen. */
  frame(dt, time = 0) {
    const tgt = this.active && this._target(_t);
    this.arrow.visible = !!tgt;
    if (tgt) this.arrow.position.set(tgt.x, tgt.y + Math.sin(time * 4) * 0.03, tgt.z);
    // the programme: the view glides off the cat to straight in front of the set, square on and centred, and close; after,
    // it glides back. (The cat's own camera has already been placed this frame: this blends from it.)
    const cam = this.camera;
    this.eye.copy(cam.position);
    this.watch = Math.max(0, Math.min(1, this.watch + (this.watching ? dt : -dt) / T.turn));
    if (this.watch <= 0) return;
    const k = this.watch * this.watch * (3 - 2 * this.watch);
    _t.fromArray(LEVEL.tvScreen); _p.set(_t.x - T.tvDist, _t.y, _t.z); // (the set faces -x)
    cam.position.lerp(_p, k);
    _m.lookAt(cam.position, _t, _up); _q.setFromRotationMatrix(_m);
    cam.quaternion.slerp(_q, k);
    const fov = cam.fov + (T.zoomFov - cam.fov) * k;
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  }

  reset() { this.active = false; this.watch = 0; this.tip.show(false); this.arrow.visible = false; }
}
