// The first run opens quietly: Mr. Tidy isn't here yet, and the cat is shut in the living room (a pet gate across the arch,
// the kitchen door closed). Prompts and a little arrow lead it up the bookcase and across to the high shelf where the TV
// remote is: that teaches jumping, a charged jump and the dash. Batting the remote plays "The Mr. Tidy Hour" (the view is
// held on the screen and he's introduced); then it's told to pull the TV's plug, the trick that will save it later. Nothing
// can be knocked over until it's done. Then the gate goes over, the door swings open, and he arrives. Enter skips it.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { audio } from '../audio/audio.js';
import { loadGLB } from '../render/geometry.js';
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
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _t = new THREE.Vector3();

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
    this.active = false; this.i = 0; this.t = 0; this.moved = 0; this.watch = 0; this.from = new THREE.Quaternion();
    this.arrow = arrowSprite(); scene.add(this.arrow);
    // what keeps the cat in the living room: colliders (off unless the tutorial is on) and what you see of them
    const W = LEVEL.wallT;
    this.walls = [world.addBox(3.05, 1.5, 0, 2.5, 3, W, 0, { tag: 'tutorial' }), world.addBox(6, 1.5, 4.35, W * 2, 3, 0.9, 0, { tag: 'tutorial' })];
    for (const b of this.walls) b.enabled = false;
    this.gate = this._gate(); scene.add(this.gate); this.gate.visible = false;
    this.door = null; this.doorModel = null; this.doorOpen = 1; this.gateFall = 1;
    loadGLB('game-assets/models/house/door_wood.glb').then((g) => {
      this.doorModel = g.scene; g.scene.position.set(6, 0, 4.35); g.scene.rotation.y = Math.PI / 2; g.scene.visible = this.active; scene.add(g.scene);
      this.door = g.scene.getObjectByName('door');
    }).catch(() => {});
  }

  /** A tall white pet gate across the arch. */
  _gate() {
    const g = new THREE.Group(), white = makePS1(new THREE.MeshLambertMaterial({ color: 0xe8e4d8 })), H = T.gateHeight;
    const bar = (w, h, d, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), white); m.position.set(x, y, 0); g.add(m); };
    bar(0.05, H, 0.05, -1.22, H / 2); bar(0.05, H, 0.05, 1.22, H / 2); bar(2.5, 0.04, 0.03, 0, H - 0.02); bar(2.5, 0.04, 0.03, 0, 0.06);
    for (let x = -1.15; x <= 1.16; x += 0.075) bar(0.018, H - 0.1, 0.018, x, H / 2);
    const pivot = new THREE.Group(); pivot.position.set(3.05, 0, -0.06); pivot.add(g);
    return pivot;
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
    this.gate.visible = true; this.gate.rotation.x = 0; this.gateFall = 0;
    if (this.doorModel) this.doorModel.visible = true;
    if (this.door) this.door.rotation.y = 0;
    this.doorOpen = 0;
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

  /** Let out: the gate goes over, the door swings open, he arrives. */
  _finish() {
    this.active = false; this.tip.show(false); this.arrow.visible = false;
    this.knock.locked = false;
    for (const b of this.walls) b.enabled = false;
    if (this.gate.visible) audio.play('knock.thud', { pos: { x: 3.05, y: 0.3, z: 0 } });
    this.vac.arrive();
  }

  /** The house as it is with the tutorial over (a later run). */
  opened() {
    for (const b of this.walls) b.enabled = false;
    this.gate.visible = false; if (this.doorModel) this.doorModel.visible = false;
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
    // after: the gate going over and the door swinging open
    if (!this.active && this.gate.visible && this.gateFall < 1) { this.gateFall = Math.min(1, this.gateFall + dt / 0.6); this.gate.rotation.x = (-Math.PI / 2) * this.gateFall * this.gateFall; }
    if (!this.active && this.door && this.doorOpen < 1) { this.doorOpen = Math.min(1, this.doorOpen + dt / 1.2); this.door.rotation.y = 1.4 * this.doorOpen * this.doorOpen * (3 - 2 * this.doorOpen); }
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
    if (this.step === 'show' && this.tv.state !== 'show' && this.t > 1) { // it's over: you can move again, looking the way you were made to
      const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      P.yaw = e.y; P.pitch = e.x; P.frozen = false; this._next();
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
    if (!this.watching) return;
    this.watch = Math.min(1, this.watch + dt / T.turn);
    const k = this.watch * this.watch * (3 - 2 * this.watch);
    _t.fromArray(LEVEL.tvScreen);
    _m.lookAt(this.camera.position, _t, _up); _q.setFromRotationMatrix(_m);
    this.camera.quaternion.slerpQuaternions(this.from, _q, k);
    const fov = this.camera.fov + (T.zoomFov - this.camera.fov) * k; // and closes in on the screen
    if (Math.abs(this.camera.fov - fov) > 1e-3) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.camera.updateMatrixWorld();
  }

  reset() { this.active = false; this.tip.show(false); this.arrow.visible = false; }
}
