// The ending: Grandma wakes. A gentle fade, then her bedroom, warm under the bedside lamp: she gets up, shuffles to the
// wall, bends and pulls a plug, and the cord it was on runs away across the floor and under her door. Cut to him, wherever
// he is in the house, still going... and then not: the X eyes, the tongue, the slump, the lights coming back on. She has
// something to say about it. Fade out. Her room is its own little set, off in the dark past the end of the house (like the
// kerb), so nobody walks into a wall. Numbers are in TUNING.ending.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { loadGLB, boxUV } from '../render/geometry.js';
import { makePS1, pixelTexture } from '../render/ps1-material.js';
import { audio } from '../audio/audio.js';
import { subtitles } from '../ui/subtitles.js';

const E = TUNING.ending;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _look = new THREE.Vector3(), _p = new THREE.Vector3();

function houseTex(name, tile) {
  const t = new THREE.TextureLoader().load(`game-assets/textures/house/${name}.png`);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; pixelTexture(t);
  const m = makePS1(new THREE.MeshLambertMaterial({ map: t })); m.userData.tile = tile;
  return m;
}

/** Her bedroom, built around (0, 0, 0) and then moved out to E.set. Returns the group and the parts that move. */
function bedroom() {
  const g = new THREE.Group(), [hx, hz] = E.room, H = 2.4, T = 0.12;
  const paper = houseTex('wallpaper_rose', 0.6), floor = houseTex('floor_planks', 0.8), ceil = houseTex('ceiling_popcorn', 0.8);
  const box = (w, h, d, x, y, z, mat) => { const geo = new THREE.BoxGeometry(w, h, d); boxUV(geo, mat.userData.tile ?? 0.5); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  box(hx * 2, 0.1, hz * 2, 0, -0.05, 0, floor);
  box(hx * 2, 0.1, hz * 2, 0, H + 0.05, 0, ceil);
  box(hx * 2 + T * 2, H, T, 0, H / 2, -hz - T / 2, paper); // north: the bed's head
  box(hx * 2 + T * 2, H, T, 0, H / 2, hz + T / 2, paper); // south: the outlet
  box(T, H, hz * 2, -hx - T / 2, H / 2, 0, paper); // west
  const [d0, d1] = E.doorZ; // east: the door, with the cord going under it
  box(T, H, d0 + hz, hx + T / 2, H / 2, (-hz + d0) / 2, paper);
  box(T, H, hz - d1, hx + T / 2, H / 2, (d1 + hz) / 2, paper);
  box(T, H - 2.05, d1 - d0, hx + T / 2, (H + 2.05) / 2, (d0 + d1) / 2, paper);
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(d1 - d0, 2.05), new THREE.MeshBasicMaterial({ color: 0x050505, fog: false })); // the hall beyond, black
  dark.position.set(hx + T + 0.02, 1.02, (d0 + d1) / 2); dark.rotation.y = -Math.PI / 2; g.add(dark);
  // the skirting, so the walls sit down on the floor
  const skirt = makePS1(new THREE.MeshLambertMaterial({ color: 0xe8e0cc }));
  for (const [w, d, x, z] of [[hx * 2, 0.02, 0, -hz + 0.01], [hx * 2, 0.02, 0, hz - 0.01], [0.02, hz * 2, -hx + 0.01, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), skirt); m.position.set(x, 0.04, z); g.add(m); }
  // the bedside lamp: a shade on a stem, lit
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.16, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd6a0, side: THREE.DoubleSide, fog: false }));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.05, 0.2, 6), makePS1(new THREE.MeshLambertMaterial({ color: 0xb08a40 })));
  const [lx, ly, lz] = E.lampAt; stem.position.set(lx, ly + 0.1, lz); shade.position.set(lx, ly + 0.26, lz); g.add(stem, shade);
  const lamp = new THREE.PointLight(E.lightColor, 0, 6, 1.0); lamp.position.set(lx, ly + 0.45, lz + 0.25); g.add(lamp);
  // the outlet on the south wall, its plug in it, and the cord off along the floor and under the door
  const [ox, oy] = E.outlet, oz = hz - 0.005;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.01), makePS1(new THREE.MeshLambertMaterial({ color: 0xece4d0 }))); plate.position.set(ox, oy, oz); g.add(plate);
  const black = makePS1(new THREE.MeshLambertMaterial({ color: 0x1e1e20 }));
  const plug = new THREE.Group(); plug.position.set(ox, oy - 0.025, oz - 0.03);
  { const body = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.04, 0.045), black); plug.add(body); }
  g.add(plug);
  const foot = new THREE.Vector3(ox + 0.05, 0.007, hz - 0.06); // where the cord meets the floor
  const run = new THREE.CatmullRomCurve3([foot, new THREE.Vector3(ox + 0.4, 0.007, hz - 0.12), new THREE.Vector3(hx - 0.5, 0.007, d1 - 0.15), new THREE.Vector3(hx - 0.06, 0.007, (d0 + d1) / 2 + 0.1), new THREE.Vector3(hx + 0.6, 0.007, (d0 + d1) / 2)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(run, 40, 0.008, 4), black));
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), black); g.add(drop); // from the plug down to the floor: it follows the plug
  // a warm strip of light under the door? No: the hall is dark. A thin line of it, cold.
  return { group: g, lamp, plug, drop, foot };
}

export class Ending {
  /** onDone(): the screen has faded out. vox: free space, for placing the camera by him. */
  constructor({ scene, camera, vac, vox, onDone }) {
    Object.assign(this, { scene, camera, vac, vox, onDone });
    this.active = false; this.done = false; this.t = 0; this.fired = {};
    this.instant = false; // (headless checks skip the scene)
    this.fade = document.createElement('div'); this.fade.id = 'cut'; this.fade.style.opacity = '0'; this.fade.style.pointerEvents = 'none'; document.body.append(this.fade);
    this.set = bedroom(); this.set.group.position.set(E.set[0], 0, E.set[1]); this.set.group.visible = false; scene.add(this.set.group);
    this.nan = null; this.mixer = null; this.clips = {}; this.hand = null;
    this.ready = Promise.all([
      loadGLB(TUNING.assets.grandma).then((g) => {
        this.nan = g.scene; this.nan.visible = false; this.set.group.add(this.nan);
        this.hand = this.nan.getObjectByName('hand_L');
        this.mixer = new THREE.AnimationMixer(this.nan);
        for (const c of g.animations) this.clips[c.name] = this.mixer.clipAction(c);
      }).catch((e) => console.warn('grandma failed to load:', e?.message || e)),
      ...E.props.map((p) => loadGLB(`game-assets/models/house/${p.model}.glb`).then((g) => { g.scene.position.fromArray(p.at); g.scene.rotation.y = ((p.rot || 0) * Math.PI) / 180; if (p.scale) g.scene.scale.setScalar(p.scale); this.set.group.add(g.scene); }).catch(() => {})),
    ]);
    const [ox] = E.outlet, hz = E.room[1];
    this.to = new THREE.Vector2(ox - E.handSide, hz - E.handReach); // where she stands so her (left) hand is at the outlet
    this.from = new THREE.Vector2(E.start[0], E.start[1]);
    this.walk = this.from.distanceTo(this.to) / E.walkSpeed;
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
    v.frozen = true; v._endReach(); v._endBlast(); v._endSuck(); v._endCreep(); v._endFog(); v.cloud.thin(); v.state = 'PATROL';
  }

  /** The black's gone (the kerb comes next, and it needs to be seen). */
  clearFade() { this.fade.style.opacity = '0'; }

  /** Her room, with her in it, under cover of the fade. */
  _stageRoom() {
    const S = this.set;
    S.group.visible = true; S.lamp.intensity = E.lamp;
    if (S.plug.parent !== S.group) S.group.attach(S.plug);
    const [ox, oy] = E.outlet; S.plug.position.set(ox, oy - 0.025, E.room[1] - 0.03); S.plug.rotation.set(0, 0, 0);
    if (this.nan) { this.nan.visible = true; this.nan.position.set(this.from.x, 0, this.from.y); this.nan.rotation.y = E.startHeading; }
    this._clip('idle', true);
  }

  /** The cord from the plug down to the floor, wherever the plug is. */
  _drop() {
    const S = this.set; S.plug.getWorldPosition(_a); S.group.worldToLocal(_a); _b.copy(S.foot);
    const l = _a.distanceTo(_b); S.drop.scale.set(1, Math.max(0.001, l), 1); S.drop.position.copy(_a).lerp(_b, 0.5);
    S.drop.quaternion.setFromUnitVectors(_p.set(0, 1, 0), _a.sub(_b).normalize());
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
        if (!this.vox || (!this.vox.blocked(p.x, p.y, p.z) && this.vox.lineFree(p, _a.set(v.x + Math.sin(a) * 0.35, y, v.z + Math.cos(a) * 0.35)))) best = { p: p.clone(), a: v.heading, off };
      }
      if (best) break;
    }
    if (!best) best = { p: new THREE.Vector3(v.x + Math.sin(v.heading) * 0.8, y + E.vacUp, v.z + Math.cos(v.heading) * 0.8), a: v.heading, off: 0 };
    this.hoseSide = best.off > 0 ? -1 : 1;
    this.vacCam.copy(best.p); this.vacLook.copy(face); this.vacDir.copy(face).sub(best.p).setY(0).normalize();
  }

  /** His hose, off to the side away from the camera: curled up while he's going, then dropping to the floor. */
  _hoseAside(fall) {
    const v = this.vac, h = v._hole(), s = this.hoseSide, f = _a.set(Math.sin(v.heading), 0, Math.cos(v.heading)), side = _b.set(f.z * s, 0, -f.x * s);
    const P = (fw, sd, y) => new THREE.Vector3(h.x + f.x * fw + side.x * sd, y, h.z + f.z * fw + side.z * sd);
    const up = [P(0, 0, h.y), P(0.08, 0.02, h.y + 0.04), P(0.12, 0.14, h.y + 0.16), P(0.06, 0.3, h.y + 0.26)];
    const down = [P(0, 0, h.y), P(0.07, 0.02, h.y - 0.06), P(0.14, 0.12, 0.1), P(0.16, 0.42, 0.03)];
    v.hose.lay(up.map((p, i) => p.lerp(down[i], fall)));
  }

  /** Per rendered frame while active. */
  update(dt) {
    this.t += dt;
    const t = this.t, cam = this.camera, v = this.vac, S = this.set;
    this.mixer?.update(dt);
    const inAt = E.cut, walkAt = inAt + E.idle, turnAt = walkAt + this.walk, bendAt = turnAt + E.turn, bendLen = this.clips.bendReach?.getClip().duration ?? 1.6;
    const yankAt = bendAt + bendLen, pullAt = yankAt + E.pull, vacAt = pullAt + E.toVac, dieAt = vacAt + E.die, endAt = dieAt + E.after;
    // the black: down slowly from the house, up into her room; a plain cut to him; down at the very end
    let black = 0;
    if (t < inAt) black = smooth(t / E.cut); else if (t < inAt + E.fadeIn) black = 1 - (t - inAt) / E.fadeIn;
    if (t > endAt - E.fadeOut) black = Math.min(1, (t - (endAt - E.fadeOut)) / E.fadeOut);
    this.fade.style.opacity = String(black);
    if (t < inAt) return; // (the house, as it was, going dark)
    this._at('room', inAt, () => this._stageRoom());
    if (t < vacAt) { // her room
      const k = smooth((t - inAt) / (pullAt - inAt + 0.3));
      _a.fromArray(E.camFrom).lerp(_b.fromArray(E.camTo), k); _look.fromArray(E.lookFrom).lerp(_b.fromArray(E.lookTo), k);
      cam.position.copy(S.group.localToWorld(_a)); cam.lookAt(S.group.localToWorld(_look)); cam.updateMatrixWorld();
      if (this.nan && t >= walkAt) {
        this._at('shuffle', walkAt, () => this._clip('shuffle', true));
        const k2 = Math.min(1, (t - walkAt) / this.walk);
        this.nan.position.set(this.from.x + (this.to.x - this.from.x) * k2, 0, this.from.y + (this.to.y - this.from.y) * k2);
        const heading = Math.atan2(this.to.x - this.from.x, this.to.y - this.from.y);
        this.nan.rotation.y = t < turnAt ? heading : heading + (0 - heading) * smooth((t - turnAt) / E.turn);
      }
      this._at('stop', turnAt, () => this._clip('idle', true));
      this._at('bend', bendAt, () => this._clip('bendReach', false));
      this._at('yank', yankAt, () => this._clip('yankPlug', false));
      this._at('grip', yankAt + E.grip, () => { if (this.hand) this.hand.attach(S.plug); }); // it comes away in her hand
      this._at('pull', pullAt, () => audio.play('vac.unplug', { pos: S.group.localToWorld(_a.set(E.outlet[0], E.outlet[1], E.room[1])), gain: 1.4 }));
      this._drop();
      return;
    }
    // him
    this._at('vac', vacAt, () => { S.group.visible = false; S.lamp.intensity = 0; if (this.nan) this.nan.visible = false; this._placeVacCam(); this.dark0 = v.dark; v.caught = true; }); // (caught: his own hose code leaves the hose alone now)
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
    this.fade.style.opacity = '0'; this.set.group.visible = false; this.set.lamp.intensity = 0;
    if (this.nan) this.nan.visible = false;
    this.vac.model.slumped = false; this.vac.model.dead = false; this.vac.model.calm = false;
  }
}
