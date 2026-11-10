// The first run opens quietly: Mr. Tidy isn't here yet. A few prompts teach the cat to move, jump and swipe; batting the TV
// remote plays "The Mr. Tidy Hour" (the camera turns to watch it, and he's introduced); unplugging the TV afterwards teaches
// the trick that will save you later. Then he arrives. Enter skips the lot.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { audio } from '../audio/audio.js';

const T = TUNING.tutorial;
const STEPS = [
  ['move', 'WASD to walk. Move the mouse to look around.'],
  ['jump', 'Hold SPACE to crouch, let go to leap. Get up on the coffee table.'],
  ['remote', 'Left click to swipe. Bat the TV remote.'],
  ['show', ''],
  ['plug', 'The TV is still on. Swipe its plug out of the wall. (Remember that one.)'],
  ['go', 'Knock things over to wake Grandma. And listen out...'],
];
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _t = new THREE.Vector3(), _d = new THREE.Vector3();

export class Tutorial {
  constructor({ hud, player, camera, input, vac, tv }) {
    Object.assign(this, { player, camera, input, vac, tv });
    this.tip = hud.label('hud-tip').place('center', 0, -0.36);
    this.active = false; this.i = 0; this.t = 0; this.moved = 0; this.watch = 0; this.from = new THREE.Quaternion();
  }

  get step() { return STEPS[this.i]?.[0]; }
  get watching() { return this.active && this.step === 'show'; }

  start() {
    this.active = true; this.i = 0; this.t = 0; this.moved = 0;
    this.vac.sleep();
    this.tv.set('on');
    this._show();
  }

  _show() {
    const s = STEPS[this.i];
    if (!s || !s[1]) { this.tip.show(false); return; }
    this.tip.set([{ text: s[1] }, { text: 'ENTER: skip the tutorial', dim: true }], 'center');
    this.tip.show(true);
  }

  _next() { this.i++; this.t = 0; this._show(); audio.play('cat.grab', { gain: 0.4 }); }

  /** Everything at once (Enter, or a later run). */
  skip() {
    if (!this.active) return;
    if (this.step === 'show') this.player.frozen = false;
    this.tv.set('off');
    this._finish();
  }

  _finish() { this.active = false; this.tip.show(false); this.vac.arrive(); }

  /** The paw went out: the remote, then the plug. */
  onSwipe(camera) {
    if (!this.active) return;
    if (this.step === 'remote' && this.tv.pokeRemote(camera)) { this._next(); this.player.frozen = true; this.from.copy(camera.quaternion); this.watch = 0; }
    else if (this.step === 'plug' && this.tv.pokePlug(camera)) this._next();
  }

  /** Per fixed tick. */
  tick(dt) {
    if (!this.active) return;
    if (this.input.pressed('Enter')) { this.skip(); return; }
    this.t += dt;
    const P = this.player;
    if (this.step === 'move') { this.moved += Math.hypot(P.pos.x - P.prev.x, P.pos.z - P.prev.z); if (this.moved > T.moveFor) this._next(); }
    else if (this.step === 'jump' && P.grounded && P.groundCollider?.id === 'coffeeTable') this._next();
    else if (this.step === 'show' && this.tv.state !== 'show' && this.t > 1) { // it's over: you can move again, looking the way you were made to
      const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      P.yaw = e.y; P.pitch = e.x; P.frozen = false; this._next();
    } else if (this.step === 'go' && this.t > T.arriveAfter) this._finish();
  }

  /** Per rendered frame, after the player's camera is placed: during the show, the view turns to the screen and holds. */
  frame(dt) {
    if (!this.watching) return;
    this.watch = Math.min(1, this.watch + dt / T.turn);
    const s = this.watch * this.watch * (3 - 2 * this.watch);
    _t.fromArray(LEVEL.tvScreen);
    _m.lookAt(this.camera.position, _t, _up); _q.setFromRotationMatrix(_m);
    this.camera.quaternion.slerpQuaternions(this.from, _q, s);
    this.camera.updateMatrixWorld();
    void _d;
  }

  reset() { this.active = false; this.tip.show(false); }
}
