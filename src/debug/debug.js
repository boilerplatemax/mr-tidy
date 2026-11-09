// Debug tools (build prompt 0.9). F1 overlay · F2 third-person camera · F3 noclip · F9 key list. More keys join as their
// systems arrive. The kit's look keys (L, 1–4) work while the overlay is open.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { settings, setSetting, applyLookPreset } from '../data/settings.js';
import { makePS1 } from '../render/ps1-material.js';

const D = TUNING.debug, V_SIGHT_COS = TUNING.vac.sightCos;
const LOOKS = ['authored', 'clean'];
const HELP = () => [
  'Debug keys', 'F1 overlay', 'F2 third-person camera', 'F3 noclip (WASD, Space, C, Shift)', 'F4 anger +1', 'F5 wake +20', 'F6 trigger the catch', 'F7 dust cloud', 'F8 freeze the vac', 'F9 this list',
  'With the overlay open:', 'L light preset', '1 / 2 / 3 jitter / warp / dither', '4 look: authored <-> clean',
  'URL: ?dev ?play',
].join('\n');

function buildCatProxy() { // what you see in third person: a grey-box cat
  const mat = makePS1(new THREE.MeshLambertMaterial({ color: 0xd08a3c }));
  const g = new THREE.Group();
  const part = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); };
  part(0.16, 0.15, 0.36, 0, 0.17, 0.04); // body
  part(0.13, 0.12, 0.13, 0, 0.27, -0.2); // head
  part(0.03, 0.03, 0.26, 0, 0.26, 0.31); // tail
  for (const [x, z] of [[-0.05, -0.1], [0.05, -0.1], [-0.05, 0.18], [0.05, 0.18]]) part(0.04, 0.1, 0.04, x, 0.05, z);
  g.visible = false;
  return g;
}

export class Debug {
  constructor({ input, player, world, scene, camera, overlay, env, ps1, audio, knock, debris, noise, grandma, vac }) {
    Object.assign(this, { input, player, world, scene, camera, overlay, env, ps1, audio, knock, debris, noise, grandma, vac });
    this._buildNavDebug();
    this.thirdPerson = false;
    this.cat = buildCatProxy();
    scene.add(this.cat);
    this._o = new THREE.Vector3(); this._d = new THREE.Vector3(); this._look = new THREE.Vector3();
    this._ro = { x: 0, y: 0, z: 0 }; this._rd = { x: 0, y: 0, z: 0 };
    overlay.lines = () => this.lines();
  }

  _buildNavDebug() { // shown while the overlay is open: the graph in grey, the route he's on in yellow
    const mat = (color) => new THREE.LineBasicMaterial({ color, depthTest: false, fog: false, transparent: true });
    const nav = this.vac.nav, pts = [], Y = 0.04;
    for (const n of nav.nodes.values()) for (const l of n.links) if (l.to.id > n.id) pts.push(n.x, Y, n.z, l.to.x, Y, l.to.z);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.navLines = new THREE.LineSegments(g, mat(0x667788)); this.navLines.renderOrder = 9; this.navLines.visible = false;
    this.scene.add(this.navLines);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 3), 3));
    this.pathLine = new THREE.Line(pg, mat(0xffe060)); this.pathLine.renderOrder = 9; this.pathLine.frustumCulled = false; this.pathLine.visible = false;
    this.scene.add(this.pathLine);
    const ring = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; ring.push(Math.cos(a), 0, Math.sin(a)); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3));
    const cone = [0, 0, 0], half = Math.acos(V_SIGHT_COS);
    for (let i = 0; i <= 12; i++) { const a = -half + (i / 12) * 2 * half; cone.push(Math.sin(a), 0, Math.cos(a)); }
    cone.push(0, 0, 0);
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cone, 3));
    this.visionCone = new THREE.Line(cg, mat(0xff6060)); this.visionCone.renderOrder = 9; this.visionCone.visible = false; this.visionCone.frustumCulled = false;
    this.scene.add(this.visionCone);
    { // the hose's reach: a cylinder out from the hole, up to the height it can get to
      const R = TUNING.hose, seg = [], c = (a) => [Math.cos(a), Math.sin(a)];
      for (const y of [0, 1]) for (let i = 0; i < 28; i++) { const [x0, z0] = c((i / 28) * Math.PI * 2), [x1, z1] = c(((i + 1) / 28) * Math.PI * 2); seg.push(x0, y, z0, x1, y, z1); }
      for (let i = 0; i < 6; i++) { const [x, z] = c((i / 6) * Math.PI * 2); seg.push(x, 0, z, x, 1, z); }
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
      this.reachShape = new THREE.LineSegments(g2, mat(0xff60e0)); this.reachShape.renderOrder = 9; this.reachShape.visible = false; this.reachShape.frustumCulled = false;
      this.reachShape.scale.set(R.reachH, R.reachTop, R.reachH);
      this.scene.add(this.reachShape);
    }
    this.hearRing = new THREE.Line(rg, mat(0x70c0ff)); this.hearRing.renderOrder = 9; this.hearRing.visible = false; this.hearRing.frustumCulled = false;
    this.scene.add(this.hearRing);
  }

  _drawNav() {
    const on = this.overlay.visible, v = this.vac;
    this.navLines.visible = this.pathLine.visible = on;
    const V = TUNING.vac, r = v.anger === 2 ? V.hearNear : v.anger === 4 ? V.hearSteps : 0; // (the rings are the limits he has at those stages)
    this.hearRing.visible = on && r > 0;
    this.visionCone.visible = on;
    this.reachShape.visible = on;
    if (!on) return;
    { const h = v._hole(); this.reachShape.position.set(h.x, 0, h.z); }
    this.hearRing.position.set(v.x, 0.06, v.z); this.hearRing.scale.set(r, 1, r);
    const range = V.sightRange[v.anger - 1];
    this.visionCone.visible = true; this.visionCone.position.set(v.x, 0.07, v.z); this.visionCone.rotation.y = v.heading; this.visionCone.scale.set(range, 1, range);
    const a = this.pathLine.geometry.attributes.position, Y = 0.05;
    a.setXYZ(0, v.x, Y, v.z);
    let n = 1;
    for (let i = v.pathI; i < v.path.length && n < 32; i++, n++) a.setXYZ(n, v.path[i].x, Y, v.path[i].z);
    a.needsUpdate = true;
    this.pathLine.geometry.setDrawRange(0, n);
  }

  /** Per fixed tick, also while paused. */
  tick() {
    const I = this.input, O = this.overlay;
    if (I.pressed('F1') || I.pressed('Backquote')) O.toggle();
    if (I.pressed('F9')) O.toggleHelp(HELP());
    if (!I.live) return;
    if (I.pressed('F2')) { this.thirdPerson = !this.thirdPerson; O.note(`third person ${this.thirdPerson ? 'on' : 'off'}`); }
    if (I.pressed('F3')) { this.player.noclip = !this.player.noclip; O.note(`noclip ${this.player.noclip ? 'on' : 'off'}`); }
    if (I.pressed('F4')) { this.vac.setAnger(this.vac.anger + 1); O.note(`anger ${this.vac.anger}`); }
    if (I.pressed('F7') && !this.vac.off) { this.vac.cloud.release(this.vac.x, 0.9, this.vac.z); O.note('dust cloud'); }
    if (I.pressed('F6') && !this.vac.caught && !this.vac.off) { this.vac._catch('hose'); O.note('catch'); }
    if (I.pressed('F8')) { this.vac.frozen = !this.vac.frozen; O.note(`vac ${this.vac.frozen ? 'frozen' : 'running'}`); }
    if (I.pressed('F5')) { this.grandma.add(20); O.note(`wake ${this.grandma.wake.toFixed(0)}`); }
    if (!O.visible) return;
    if (I.pressed('KeyL')) { const o = TUNING.lighting.order; const next = o[(o.indexOf(this.env.preset) + 1) % o.length]; this.env.apply(next); O.note('light: ' + next); }
    for (const [code, key] of [['Digit1', 'jitter'], ['Digit2', 'warp'], ['Digit3', 'dither']]) if (I.pressed(code)) { setSetting(key, !settings[key]); O.note(`${key} ${settings[key] ? 'on' : 'off'}`); }
    if (I.pressed('Digit4')) { const next = LOOKS[(LOOKS.indexOf(settings.look) + 1) % LOOKS.length]; applyLookPreset(next); O.note('look: ' + next); }
  }

  /** Per rendered frame, after player.render(): moves the camera for third person. */
  frame() {
    this._drawNav();
    const P = this.player, cam = this.camera;
    this.cat.visible = this.thirdPerson;
    if (!this.thirdPerson) return;
    this.cat.position.set(P.pos.x, P.feetY, P.pos.z);
    this.cat.rotation.y = P.yaw;
    const o = this._ro, d = this._rd;
    o.x = P.pos.x; o.y = P.feetY + 0.3; o.z = P.pos.z;
    this._d.set(0, 0, 1).applyEuler(cam.rotation).normalize();
    d.x = this._d.x; d.y = this._d.y; d.z = this._d.z;
    const hit = this.world.raycast(o, d, D.thirdPersonDist, (c) => c.solid, true);
    const dist = hit ? Math.max(0.15, hit.t - 0.08) : D.thirdPersonDist;
    cam.position.set(o.x + d.x * dist, o.y + d.y * dist, o.z + d.z * dist);
    cam.updateMatrixWorld();
  }

  lines() {
    const P = this.player, ps1 = this.ps1;
    return [
      `${ps1.stats.calls} draw calls · ${(ps1.stats.triangles / 1000).toFixed(1)}k tris · ${ps1.width}x${ps1.height} x${ps1.scale}`,
      `pos ${P.pos.x.toFixed(2)}, ${P.feetY.toFixed(2)}, ${P.pos.z.toFixed(2)} · ${P.mode} · ${P.gait} on ${P.surface}${P.grounded ? '' : ' (air)'} · stamina ${P.stamina.toFixed(2)}`,
      `knocked ${this.knock.count}/${this.knock.list.length} · messes ${this.debris.messes.length} · last noise ${this.noise.last ? this.noise.last.kind + (this.noise.last.objectId ? ' ' + this.noise.last.objectId : '') : 'none'}`,
      `vac ${this.vac.state}${this.vac.reachPhase ? ' ' + this.vac.reachPhase : ''}${this.vac.blastPhase ? ' ' + this.vac.blastPhase : ''}${this.vac.frozen ? ' (frozen)' : ''} · anger ${this.vac.anger} · hears ${['nothing', 'near crashes', 'all crashes', 'all crashes + floor steps'][this.vac.anger - 1]} · cord ${this.vac._paid().toFixed(1)}/${TUNING.cord.length} m`,
      `grandmaWake ${this.grandma.wake.toFixed(1)} · stage ${this.grandma.stage}`,
      `audio ${this.audio.ready ? this.audio.voices.size + ' voices' : 'not started'} · look ${settings.look} · light ${this.env.preset}`,
    ];
  }
}
