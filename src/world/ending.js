// The ending: Grandma wakes. A gentle fade, and there she is in the room where his plug is, in the warm light of the lamp
// she's put on: she shuffles to the wall, bends and pulls his plug, and drops it: it lies there on the floor.
// Cut to him, wherever he is in the house, still going... and then not: the X eyes, the slump, the lights coming back on.
// She has something to say about it. Fade out. Numbers are in TUNING.ending.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { loadGLB } from '../render/geometry.js';
import { makePS1 } from '../render/ps1-material.js';
import { audio } from '../audio/audio.js';
import { subtitles } from '../ui/subtitles.js';

const E = TUNING.ending;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _look = new THREE.Vector3(), _p = new THREE.Vector3();

export class Ending {
  /** onDone(): the screen has faded out. vox: free space, for placing the camera. world: the house, to find room for her. */
  constructor({ scene, camera, vac, vox, world, onDone }) {
    Object.assign(this, { scene, camera, vac, vox, world, onDone });
    this.active = false; this.done = false; this.t = 0; this.fired = {};
    this.instant = false; // (headless checks skip the scene)
    this.fade = document.createElement('div'); this.fade.id = 'cut'; this.fade.style.opacity = '0'; this.fade.style.pointerEvents = 'none'; document.body.append(this.fade);
    // her lamp: there from the start at no strength (adding a light later would recompile every material)
    this.lamp = new THREE.PointLight(E.lightColor, 0, 6, 1.0); scene.add(this.lamp);
    this.held = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.03), makePS1(new THREE.MeshLambertMaterial({ color: TUNING.cord.plugColor }))); this.held.visible = false; scene.add(this.held); // the plug, in her hand
    this.nan = null; this.mixer = null; this.clips = {}; this.hand = null;
    this.ready = loadGLB(TUNING.assets.grandma).then((g) => {
      this.nan = g.scene; this.nan.visible = false; scene.add(this.nan);
      this.hand = this.nan.getObjectByName('hand_L');
      this.mixer = new THREE.AnimationMixer(this.nan);
      for (const c of g.animations) this.clips[c.name] = this.mixer.clipAction(c);
    }).catch((e) => console.warn('grandma failed to load:', e?.message || e));
    this.from = new THREE.Vector2(); this.to = new THREE.Vector2(); this.walk = 1; this.heading = 0;
    this.camFrom = new THREE.Vector3(); this.camTo = new THREE.Vector3(); this.lookAt = new THREE.Vector3();
    this.vacCam = new THREE.Vector3(); this.vacLook = new THREE.Vector3(); this.vacDir = new THREE.Vector3(); this.dark0 = 0;
  }

  _clip(name, loop) {
    for (const a of Object.values(this.clips)) if (a !== this.clips[name]) a.fadeOut(0.2);
    const a = this.clips[name]; if (!a) return;
    a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.fadeIn(0.2); a.play();
  }

  /** Once at each moment in the script. */
  _at(name, when, fn) { if (this.t >= when && !this.fired[name]) { this.fired[name] = true; fn(); } }

  /** She's awake: hold him where he is, and fade. */
  start() {
    this.active = true; this.done = false; this.t = 0; this.fired = {};
    this.fade.hidden = false; this.fade.style.opacity = '0';
    const v = this.vac;
    v.frozen = true; v.hush(0.3); v.cloud.thin(); v.state = 'PATROL'; // (only the motor goes on, until she pulls the plug; frozen, his plug can't go looking for another outlet either)
  }

  /** The black's gone (the kerb comes next, and it needs to be seen). */
  clearFade() { this.fade.style.opacity = '0'; }

  /** Room for her (and her shuffle) at x, z? */
  _free(x, z, r = E.clearance) { return this.world ? this.world.penetration(x, z, r, 0.05, 1.6) <= 0 : true; }

  /** The room (from LEVEL.rooms) a point is in, if any. */
  _room(x, z) { return LEVEL.rooms.find((r) => x > r.min[0] && x < r.max[0] && z > r.min[1] && z < r.max[1]) || null; }

  /** Inside this room, clear of its walls? */
  _inRoom(room, x, z, m = 0.2) { return !room || (x > room.min[0] + m && x < room.max[0] - m && z > room.min[1] + m && z < room.max[1] - m); }

  /** Can the camera stand at p and see q? */
  _sees(p, q) { const vx = this.vox; return !vx || (!vx.blocked(p.x, p.y, p.z) && vx.lineFree(p, q)); }

  /** Where she stands, where she comes from, and where the camera watches from: all worked out from his outlet. */
  _plan() {
    const o = this.vac.cord.outlet, [ox, , oz] = o.pos, [nx, , nz] = o.n, fx = -nx, fz = -nz, lx = fz, lz = -fx; // she faces the wall; her left
    const room = this._room(ox + nx * 0.3, oz + nz * 0.3); // (everything happens in his outlet's own room: no watching her through a doorway)
    // where she stands so her left hand is at the outlet, far enough off the wall that she doesn't put her head through it as she bends
    let sx = ox + nx * E.standOff - lx * E.handSide, sz = oz + nz * E.standOff - lz * E.handSide;
    for (const k of [0, 0.2, -0.2, 0.4, -0.4]) if (this._free(sx + lx * k, sz + lz * k)) { sx += lx * k; sz += lz * k; break; }
    this.to.set(sx, sz); this.heading = Math.atan2(fx, fz);
    // she comes in from a little way back into the room
    this.from.set(sx + nx * 0.5, sz + nz * 0.5);
    for (const [b, sd] of E.startFrom) { const x = sx + nx * b + lx * sd, z = sz + nz * b + lz * sd; if (this._inRoom(room, x, z, 0.25) && this._free(x, z) && this._free((x + sx) / 2, (z + sz) / 2)) { this.from.set(x, z); break; } }
    this.walk = Math.max(0.4, this.from.distanceTo(this.to) / E.walkSpeed);
    // the camera: back in the room and off to one side, looking at her and the outlet
    this.lookAt.set((sx + ox) / 2 + nx * 0.1, E.lookY, (sz + oz) / 2 + nz * 0.1);
    let cam = null;
    for (const [b, sd, y] of E.camTries) {
      const p = _p.set(sx + nx * b + lx * sd, y, sz + nz * b + lz * sd);
      if (this._inRoom(room, p.x, p.z) && this._sees(p, this.lookAt)) { cam = p.clone(); break; }
    }
    if (!cam) for (const [b, sd, y] of E.camTries) { // (nothing with a clear view by the free-space grid: walls are what matter, in a tight spot)
      const p = _p.set(sx + nx * b + lx * sd, y, sz + nz * b + lz * sd);
      if (this._inRoom(room, p.x, p.z) && (!this.world || (this.world.countOccluders(p, this.lookAt, 1) === 0 && this.world.penetration(p.x, p.z, 0.08, p.y - 0.1, p.y + 0.1) <= 0))) { cam = p.clone(); break; }
    }
    if (!cam) cam = new THREE.Vector3(sx + nx * 1.6, 1.3, sz + nz * 1.6);
    this.camFrom.copy(cam); this.camTo.copy(cam).lerp(this.lookAt, E.camIn); this.camTo.y = cam.y - E.camDrop;
    this.lamp.position.set(sx + nx * 1.2, 1.9, sz + nz * 1.2);
  }

  /** Her, in the room, under cover of the fade. */
  _stageRoom() {
    const v = this.vac;
    if (v.plugState !== 'in') { v._chooseOutlet(); v.plugState = 'in'; v.plugT = 0; v.cord.setTrim(0); v.model.face.visible = true; } // (the cat had unplugged him: he's plugged himself back in somewhere, under cover of the fade)
    this._plan();
    this.lamp.intensity = E.lamp;
    if (this.nan) { this.nan.visible = true; this.nan.position.set(this.from.x, 0, this.from.y); this.nan.rotation.y = Math.atan2(this.to.x - this.from.x, this.to.y - this.from.y); }
    this._clip('idle', true);
  }

  /** Somewhere in front of him with room for a camera and a clear view of his face: he turns to it (it's a cut). */
  _placeVacCam() {
    const v = this.vac, y = v.model.faceCenterY(), face = _look.set(v.x, y, v.z);
    let best = null;
    for (const d of E.vacDist) {
      for (const off of E.vacAngles) { // a little off to one side first, so the hose (hanging off the other) is out of the way
        if (best) break;
        const a = v.heading + off;
        const p = _p.set(v.x + Math.sin(a) * d, y + E.vacUp, v.z + Math.cos(a) * d);
        if (this._sees(p, _a.set(v.x + Math.sin(a) * 0.35, y, v.z + Math.cos(a) * 0.35))) best = { p: p.clone(), a: v.heading, off };
      }
      if (best) break;
    }
    if (!best) best = { p: new THREE.Vector3(v.x + Math.sin(v.heading) * 0.8, y + E.vacUp, v.z + Math.cos(v.heading) * 0.8), a: v.heading, off: 0 };
    this.hoseSide = best.off > 0 ? -1 : 1;
    { // and it lies on the open floor, not through a wall or a cupboard: the side with room for it, or straight out in front
      const room = (side) => { let free = 0; for (const [fw, sd] of [[0.14, 0.12], [0.16, 0.3], [0.16, 0.45]]) { const f = [Math.sin(v.heading), Math.cos(v.heading)], x = v.x + f[0] * (0.24 + fw) + f[1] * side * sd, z = v.z + f[1] * (0.24 + fw) - f[0] * side * sd; if (!this.vox || !this.vox.blocked(x, 0.08, z)) free++; } return free; };
      const a = room(this.hoseSide), b = room(-this.hoseSide);
      if (b > a) this.hoseSide = -this.hoseSide;
      this.hoseStraight = Math.max(a, b) < 3; // (no room either side: it just drops in front of him)
    }
    this.vacCam.copy(best.p); this.vacLook.copy(face); this.vacDir.copy(face).sub(best.p).setY(0).normalize();
  }

  /** His hose, off to the side away from the camera: curled up while he's going, then dropping to the floor. */
  _hoseAside(fall) {
    const v = this.vac, h = v._hole(), s = this.hoseSide, f = _a.set(Math.sin(v.heading), 0, Math.cos(v.heading)), side = _b.set(f.z * s, 0, -f.x * s);
    const P = (fw, sd, y) => new THREE.Vector3(h.x + f.x * fw + side.x * sd * (this.hoseStraight ? 0.15 : 1), y, h.z + f.z * fw + side.z * sd * (this.hoseStraight ? 0.15 : 1));
    const up = [P(0, 0, h.y), P(0.08, 0.02, h.y + 0.04), P(0.12, 0.14, h.y + 0.16), P(0.06, 0.3, h.y + 0.26)];
    const down = [P(0, 0, h.y), P(0.07, 0.02, h.y - 0.06), P(0.14, 0.12, 0.1), P(0.16, 0.42, 0.03)];
    v.hose.lay(up.map((p, i) => p.lerp(down[i], fall)));
  }

  /** Per rendered frame while active. */
  update(dt) {
    this.t += dt;
    const t = this.t, cam = this.camera, v = this.vac;
    this.mixer?.update(dt);
    const inAt = E.cut, walkAt = inAt + E.idle, turnAt = walkAt + this.walk, bendAt = turnAt + E.turn, bendLen = this.clips.bendReach?.getClip().duration ?? 1.6;
    const yankAt = bendAt + bendLen, pullAt = yankAt + E.pull, vacAt = pullAt + E.toVac, dieAt = vacAt + E.die, endAt = dieAt + E.after;
    // the black: down slowly from the house, up on her; a plain cut to him; down at the very end
    let black = 0;
    if (t < inAt) black = smooth(t / E.cut); else if (t < inAt + E.fadeIn) black = 1 - (t - inAt) / E.fadeIn;
    if (t > endAt - E.fadeOut) black = Math.min(1, (t - (endAt - E.fadeOut)) / E.fadeOut);
    this.fade.style.opacity = String(black);
    if (t < inAt) return; // (the house, as it was, going dark)
    this._at('room', inAt, () => this._stageRoom());
    if (t < vacAt) { // her, at his outlet
      const k = smooth((t - inAt) / (pullAt - inAt + 0.3));
      cam.position.lerpVectors(this.camFrom, this.camTo, k); cam.lookAt(this.lookAt); cam.updateMatrixWorld();
      if (this.nan && t >= walkAt) {
        this._at('shuffle', walkAt, () => this._clip('shuffle', true));
        const k2 = Math.min(1, (t - walkAt) / this.walk);
        this.nan.position.set(this.from.x + (this.to.x - this.from.x) * k2, 0, this.from.y + (this.to.y - this.from.y) * k2);
        const walkHeading = Math.atan2(this.to.x - this.from.x, this.to.y - this.from.y), turn = this.heading - walkHeading, d = Math.atan2(Math.sin(turn), Math.cos(turn));
        this.nan.rotation.y = t < turnAt ? walkHeading : walkHeading + d * smooth((t - turnAt) / E.turn);
      }
      this._at('stop', turnAt, () => this._clip('idle', true));
      this._at('bend', bendAt, () => this._clip('bendReach', false));
      this._at('yank', yankAt, () => this._clip('yankPlug', false));
      this._at('grip', yankAt + E.grip, () => { v.cord.plugHeld = true; v.cord.plug.visible = false; this.held.position.copy(v.cord.plug.position); this.held.quaternion.copy(v.cord.plug.quaternion); this.held.visible = true; this.hand?.attach(this.held); }); // it comes away in her hand
      this._at('pull', pullAt, () => audio.play('vac.unplug', { pos: v.cord.plugPos, gain: 1.4 }));
      this._at('drop', pullAt + E.drop, () => { // she lets it fall: it lies there on the floor, the cord with it, going nowhere now
        const o = v.cord.outlet, [x, , z] = o.pos, [nx, , nz] = o.n;
        this.held.visible = false; this.scene.attach(this.held);
        v.cord.plug.position.set(x + nx * 0.16, 0.025, z + nz * 0.16); v.cord.plug.rotation.set(0, Math.atan2(nx, nz) + 0.6, Math.PI / 2); v.cord.plug.visible = true;
      });
      return;
    }
    // him
    this._at('vac', vacAt, () => { this.lamp.intensity = 0; if (this.nan) this.nan.visible = false; this._placeVacCam(); this.dark0 = v.dark; v.caught = true; }); // (caught: his own hose code leaves the hose alone now)
    this._hoseAside(smooth((t - dieAt) / 0.5));
    const push = smooth((t - vacAt) / (endAt - vacAt)) * E.push;
    const sink = smooth((t - dieAt) / 0.9);
    cam.position.copy(this.vacCam).addScaledVector(this.vacDir, push); cam.position.y -= E.sink[0] * sink;
    _look.copy(this.vacLook); _look.y -= E.sink[1] * sink; cam.lookAt(_look); cam.updateMatrixWorld();
    this._at('die', dieAt, () => { v.powerDown(); v.model.dead = true; v.model.face.visible = true; v.model.slumped = true; });
    if (t > dieAt + E.lightsAfter) v.dark = this.dark0 * (1 - smooth((t - dieAt - E.lightsAfter) / E.lightsBack)); // and the lights come back on
    this._at('words', dieAt + E.wordsAfter, () => subtitles.line(null, '"Silly old thing, running all night."', 3.4));
    if (t >= endAt) { this.active = false; this.done = true; this.onDone?.(); }
  }

  /** Back as it was, for a new run. */
  reset() {
    this.active = false; this.done = false; this.t = 0; this.fired = {};
    this.fade.style.opacity = '0'; this.lamp.intensity = 0; this.held.visible = false; this.scene.attach(this.held);
    if (this.nan) this.nan.visible = false;
    this.vac.cord.plugHeld = false; this.vac.cord.plug.rotation.set(0, 0, 0); // (it was lying on its side on the floor)
    this.vac.model.slumped = false; this.vac.model.dead = false; this.vac.model.calm = false;
  }
}
