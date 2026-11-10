// The ending (build prompt 7.3): Grandma wakes. A cut to the hallway at cat height: her door swings open, warm light comes
// out, she shuffles to the outlet, seen from the knees, bends, and pulls the plug. He winds down and slumps. She has
// something to say about it. Fade out. Numbers are in TUNING.ending.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { loadGLB } from '../render/geometry.js';
import { audio } from '../audio/audio.js';
import { subtitles } from '../ui/subtitles.js';

const E = TUNING.ending;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const _look = new THREE.Vector3();

export class Ending {
  /** onDone(): the screen has faded out. getDoor(): the door node (it's a model, so it turns up after loading). */
  constructor({ scene, camera, vac, getDoor, onDone }) {
    Object.assign(this, { scene, camera, vac, getDoor, onDone });
    this.active = false; this.done = false; this.t = 0; this.fired = {};
    this.instant = false; // (headless checks skip the scene)
    this.light = new THREE.PointLight(E.lightColor, 0, 7, 1.1); this.light.position.set(17.2, 1.1, -0.7); scene.add(this.light);
    this.fade = document.createElement('div'); this.fade.id = 'cut'; this.fade.style.opacity = '0'; this.fade.style.pointerEvents = 'none'; document.body.append(this.fade);
    this.nan = null; this.mixer = null; this.clips = {};
    this.ready = loadGLB(TUNING.assets.grandma).then((g) => {
      this.nan = g.scene; this.nan.visible = false; scene.add(this.nan);
      this.mixer = new THREE.AnimationMixer(this.nan);
      for (const c of g.animations) this.clips[c.name] = this.mixer.clipAction(c);
    }).catch((e) => console.warn('grandma failed to load:', e?.message || e));
    this.from = new THREE.Vector2(E.startX, LEVEL.grandmaDoor.zMin * 0.5 + LEVEL.grandmaDoor.zMax * 0.5);
    const o = LEVEL.outlets[0];
    this.to = new THREE.Vector2(o.pos[0] - E.handSide, o.pos[2] + o.n[2] * E.handReach);
    this.walk = this.from.distanceTo(this.to) / E.walkSpeed;
  }

  _clip(name, loop) {
    for (const a of Object.values(this.clips)) if (a !== this.clips[name]) a.fadeOut(0.2);
    const a = this.clips[name]; if (!a) return;
    a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.fadeIn(0.2); a.play();
  }

  /** Once at each moment in the script. */
  _at(name, when, fn) { if (this.t >= when && !this.fired[name]) { this.fired[name] = true; fn(); } }

  start() {
    this.active = true; this.done = false; this.t = 0; this.fired = {};
    this.fade.hidden = false; this.fade.style.opacity = '0';
  }

  /** Where everybody needs to be, under cover of the cut. */
  _stage() {
    const v = this.vac, o = LEVEL.outlets[0], node = v.nav.nodes.get(o.node);
    v.frozen = true; v.cloud.thin();
    v.x = v.px = E.vacX; v.z = v.pz = E.vacZ; v.heading = v.prevHeading = E.vacHeading;
    v.cord.setOutlet(o); v.root = node; v.tether = [node, { x: E.vacX, z: E.vacZ, virtual: true }]; v.path = [node]; v.pathI = 0;
    if (this.nan) { this.nan.visible = true; this.nan.position.set(this.from.x, 0, this.from.y); this.nan.rotation.y = -Math.PI / 2; }
    this._clip('idle', true);
  }

  /** Per rendered frame while active. */
  update(dt) {
    this.t += dt;
    const t = this.t, cam = this.camera, door = this.getDoor(), v = this.vac;
    this.mixer?.update(dt);
    const walkAt = E.doorAt + 0.7, turnAt = walkAt + this.walk, bendAt = turnAt + E.turn, bendLen = this.clips.bendReach?.getClip().duration ?? 1.6, yankAt = bendAt + bendLen, pullAt = yankAt + E.pull, endAt = pullAt + E.after;
    let black = 0;
    if (t < E.cut) black = t / E.cut; else if (t < E.cut + 0.45) black = 1 - (t - E.cut) / 0.45;
    if (t > endAt - E.fadeOut) black = Math.min(1, (t - (endAt - E.fadeOut)) / E.fadeOut);
    this.fade.style.opacity = String(black);
    this._at('stage', E.cut, () => this._stage());
    if (t < E.cut) return;
    cam.position.set(E.camX, E.camY, E.camZ);
    _look.set(E.lookX, E.lookY, E.lookZ);
    cam.lookAt(_look); cam.updateMatrixWorld();
    if (door) door.rotation.y = -1.3 * smooth((t - E.doorAt) / 1.3);
    this.light.intensity = E.light * smooth((t - E.doorAt) / 0.9) * (t > endAt - E.fadeOut ? 1 - black : 1);
    this._at('creak', E.doorAt, () => audio.play('grandma.creak', { pos: { x: 17.9, y: 1, z: -0.7 } }));
    if (this.nan && t >= walkAt) {
      this._at('shuffle', walkAt, () => this._clip('shuffle', true));
      const u = Math.min(1, (t - walkAt) / this.walk);
      this.nan.position.set(this.from.x + (this.to.x - this.from.x) * u, 0, this.from.y + (this.to.y - this.from.y) * u);
      const heading = Math.atan2(this.to.x - this.from.x, this.to.y - this.from.y);
      this.nan.rotation.y = t < turnAt ? heading : heading + (0 - heading) * smooth((t - turnAt) / E.turn);
    }
    this._at('stop', turnAt, () => this._clip('idle', true));
    this._at('bend', bendAt, () => this._clip('bendReach', false));
    this._at('yank', yankAt, () => this._clip('yankPlug', false));
    this._at('pull', pullAt, () => { audio.play('vac.unplug', { pos: v.cord.plugPos, gain: 1.4 }); v.cord.setTrim(0.05); v.powerDown(); v.model.slumped = true; });
    this._at('words', pullAt + 0.9, () => subtitles.line('Grandma', 'Silly old thing, running all night.', 3.4));
    if (t >= endAt) { this.active = false; this.done = true; this.onDone?.(); }
  }

  /** Back as it was, for a new run. */
  reset() {
    this.active = false; this.done = false; this.t = 0; this.fired = {};
    this.fade.style.opacity = '0'; this.light.intensity = 0;
    if (this.nan) this.nan.visible = false;
    const door = this.getDoor(); if (door) door.rotation.y = 0;
    this.vac.model.slumped = false;
  }
}
