// Dresses the house: real models placed from LEVEL.dress. Gameplay never touches these; the collision boxes in the level stay
// the truth. An entry either stands at a point ({ model, at, rot }) or is stretched to fill the box(es) it replaces
// ({ model, fit: [solid ids], rot, h, top }): that way a jump that was checked against the box is still right for the sofa.
import * as THREE from 'three';
import { LEVEL } from '../data/level.js';
import { loadGLB } from '../render/geometry.js';
import { makePS1, pixelTexture } from '../render/ps1-material.js';
import { audio } from '../audio/audio.js';
import { subtitles } from '../ui/subtitles.js';
import { SHOW } from '../vacuum/voice.js';
import { TUNING } from '../data/tuning.js';

const cache = new Map();
const file = (name) => `game-assets/models/house/${name}.glb`;
function load(name) { if (!cache.has(name)) cache.set(name, loadGLB(file(name))); return cache.get(name); }
const _b = new THREE.Box3(), _c = new THREE.Vector3(), _s = new THREE.Vector3();

/** The world box a set of solids covers. */
function boundsOf(ids, byId) {
  const b = new THREE.Box3();
  for (const id of ids) { const s = byId.get(id); b.expandByPoint(_c.fromArray(s.min)); b.expandByPoint(_c.fromArray(s.max)); }
  return b;
}

let doorNode = null;
export const grandmaDoor = () => doorNode;
const screens = [];
let plainCloth = null;

// The programme: "The Mr. Tidy Hour". The remote turns it on (the tutorial's first lesson).
const SHOW_LEN = TUNING.tutorial.show;
const show = { t: 0, canvas: null, g: null, tex: null, black: null, said: 0, last: -1 };
function makeShow() {
  const c = show.canvas = document.createElement('canvas'); c.width = 256; c.height = 192; show.g = c.getContext('2d'); show.g.setTransform(2, 0, 0, 2, 0, 0); // (drawn in 128 x 96, at twice the resolution: the words stay sharp)
  const t = show.tex = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; pixelTexture(t); t.repeat.set(4, 1);
  const b = document.createElement('canvas'); b.width = b.height = 4; const bg = b.getContext('2d'); bg.fillStyle = '#060708'; bg.fillRect(0, 0, 4, 4);
  show.black = new THREE.CanvasTexture(b); pixelTexture(show.black);
}
/** Him, as the programme draws him. mood: 'nice' (white eyes and pupils) or 'wrong' (black holes, with pinpricks in them). */
function vacPic(g, x, y, k, mood, wave = 0) {
  const R = (px, py, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x + px * k), Math.round(y + py * k), Math.round(w * k), Math.round(h * k)); };
  g.fillStyle = '#141414'; g.beginPath(); g.arc(x, y - 6 * k, 13 * k, Math.PI, 0); g.fill(); // the dome
  g.strokeStyle = '#141414'; g.lineWidth = 2 * k; g.beginPath(); g.arc(x, y - 18 * k, 7 * k, Math.PI, 0); g.stroke(); // the handle
  R(-15, -7, 30, 3, '#d02020'); R(-13, -4, 26, 16, '#b01818'); // the rim and the drum
  for (const s of [-1, 1]) { const ex = x + s * 6 * k, ey = y + 1 * k; g.fillStyle = mood === 'nice' ? '#f4efd8' : '#000'; g.beginPath(); g.arc(ex, ey, 3.2 * k, 0, 7); g.fill(); g.fillStyle = mood === 'nice' ? '#000' : '#d8e4ff'; g.beginPath(); g.arc(ex + 0.6 * k, ey + 0.6 * k, (mood === 'nice' ? 1.5 : 0.6) * k, 0, 7); g.fill(); }
  g.fillStyle = '#000'; g.beginPath(); g.arc(x, y + 5 * k, 2.4 * k, 0, 7); g.fill(); // the nose: where the hose goes
  g.beginPath(); g.moveTo(x - 9 * k, y + 7 * k); g.quadraticCurveTo(x, y + (mood === 'nice' ? 14 : 16) * k, x + 9 * k, y + 7 * k); g.quadraticCurveTo(x, y + 11 * k, x - 9 * k, y + 7 * k); g.fill(); // the smile
  { const ex = x + 20 * k, ey = y - 10 * k - wave * 6 * k; g.strokeStyle = '#141414'; g.lineWidth = 2.2 * k; g.beginPath(); g.moveTo(x + 2 * k, y + 5 * k); g.quadraticCurveTo(x + 18 * k, y + 4 * k, ex, ey); g.stroke(); // the hose, waving
    const dx = 0.25, dy = -1, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, px = -uy, py = ux; // the nozzle: a grey flared tip on the end
    g.fillStyle = '#9a9aa2'; g.beginPath(); g.moveTo(ex + px * 1.4 * k, ey + py * 1.4 * k); g.lineTo(ex + ux * 6 * k + px * 2.6 * k, ey + uy * 6 * k + py * 2.6 * k); g.lineTo(ex + ux * 6 * k - px * 2.6 * k, ey + uy * 6 * k - py * 2.6 * k); g.lineTo(ex - px * 1.4 * k, ey - py * 1.4 * k); g.fill();
    g.fillStyle = '#2a2a2e'; g.fillRect(ex + ux * 6 * k - 2.2 * k, ey + uy * 6 * k - 0.6 * k, 4.4 * k, 1.2 * k); }
  R(-11, 12, 4, 2, '#701010'); R(7, 12, 4, 2, '#701010'); // feet
}
function catPic(g, x, y) { g.fillStyle = '#d07a30'; g.fillRect(x, y, 16, 8); g.fillRect(x + 12, y - 6, 9, 8); g.fillRect(x + 12, y - 9, 2, 3); g.fillRect(x + 19, y - 9, 2, 3); g.fillRect(x, y + 8, 3, 4); g.fillRect(x + 12, y + 8, 3, 4); g.fillRect(x - 3, y - 7, 3, 9); g.fillRect(x - 5, y - 9, 4, 3); g.fillStyle = '#f4efd8'; g.fillRect(x + 14, y - 4, 2, 2); g.fillRect(x + 18, y - 4, 2, 2); g.fillStyle = '#000'; g.fillRect(x + 15, y - 3, 1, 1); g.fillRect(x + 19, y - 3, 1, 1); }
function drawShow(u) {
  const g = show.g, W = 128, H = 96, text = (str, y, size = 10) => { g.textAlign = 'center'; g.font = 'bold ' + size + 'px monospace'; g.fillStyle = '#000'; g.fillText(str, W / 2 + 1, y + 1); g.fillStyle = '#f4efd8'; g.fillText(str, W / 2, y); };
  if (u < 3.2) { g.fillStyle = '#2b6fb0'; g.fillRect(0, 0, W, H); g.fillStyle = '#e0c040'; g.fillRect(6, 6, W - 12, H - 12); g.fillStyle = '#2b6fb0'; g.fillRect(10, 10, W - 20, H - 20); text('THE', 32); text('MR. TIDY', 52, 15); text('HOUR', 72); return; }
  if (u < 7.2) { g.fillStyle = '#e8d8a8'; g.fillRect(0, 0, W, H); g.fillStyle = '#c8a878'; g.fillRect(0, 70, W, 26); vacPic(g, 64, 56, 1.6, 'nice', Math.sin(u * 7)); text('MEET MR. TIDY!', 16); return; }
  if (u < 11.2) { g.fillStyle = '#d8c89a'; g.fillRect(0, 0, W, H); g.fillStyle = '#7a5a38'; g.fillRect(0, 70, W, 26); const p = (u - 7.2) / 4, cx = -20 + p * 170; catPic(g, Math.round(cx + 34), 58); vacPic(g, cx, 60, 1, 'nice', Math.sin(u * 9)); text('HE TIDIES UP', 16); return; }
  if (u < 14.4) { g.fillStyle = '#c84030'; g.fillRect(0, 0, W, H); vacPic(g, 64, 50, 1.8, 'nice', Math.sin(u * 5) * 0.4); g.fillStyle = '#f4efd8'; for (let i = 0; i < 6; i++) { const a = u * 2 + i; g.fillRect(64 + Math.cos(a) * 44, 48 + Math.sin(a) * 30, 2, 2); } text('A CLEAN HOME', 82, 9); text('IS A HAPPY HOME', 92, 9); return; }
  drawWrong(g, Math.random() < 0.15);
}
/** The last frame, and what the set shows by itself in the dark: him, close, wrong. */
function drawWrong(g, flick, text = 'SWEET DREAMS.') {
  const W = 128, H = 96; g.fillStyle = flick ? '#1a0808' : '#000'; g.fillRect(0, 0, W, H);
  vacPic(g, 64, 50, 3.1, 'wrong');
  g.textAlign = 'center'; g.font = 'bold 10px monospace'; g.fillStyle = '#f4efd8'; g.fillText(text, 64, 92);
}

/** The set: 'on' (static), 'show' (the programme), 'off' (unplugged; but when the power goes it comes on by itself). */
export const tv = {
  state: 'on', plug: null, // plug: { pos, out() } from the house
  set(st) {
    this.state = st;
    if (st === 'show') { show.t = SHOW_LEN; show.said = 0; }
    if (st === 'off') { show.t = 0; this.plug?.pull(false); } else this.plug?.pull(true);
  },
  /** The remote, batted. */
  pokeRemote(camera) {
    if (!remote || this.state !== 'on' || !near(camera, remote.position, 0.65, 0.55)) return false;
    audio.play('knock.clink', { pos: remote.position }); audio.play('tv.show', { pos: { x: 5.3, y: 0.6, z: 2.3 }, refDistance: 2 });
    remote.rotation.y += 0.6; this.set('show');
    return true;
  },
  /** The plug, swiped out of the wall. */
  pokePlug(camera) {
    if (!this.plug || this.state === 'off' || !near(camera, this.plug.pos, 0.6, 0.55)) return false;
    audio.play('vac.unplug', { pos: this.plug.pos }); this.set('off');
    return true;
  },
};
let remote = null;
function near(camera, p, reach, cone) {
  const eye = camera.position, dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z, d = Math.hypot(dx, dy, dz);
  if (d > reach) return false;
  const v = camera.getWorldDirection(_c);
  return (dx * v.x + dy * v.y + dz * v.z) / d >= cone;
}

/** Per fixed tick: the programme runs, and he narrates it. */
export function tvTick(dt) {
  if (tv.state !== 'show') return;
  show.t -= dt;
  const u = SHOW_LEN - show.t;
  while (show.said < SHOW.length && u >= SHOW[show.said][0]) { audio.play(`tv.say.${show.said}`, { pos: { x: 5.3, y: 0.6, z: 2.3 }, refDistance: 2.5 }); subtitles.line(null, SHOW[show.said][1], 3.4); show.said++; }
  if (show.t <= 0) tv.set('on');
}

/** Per rendered frame: the television. dark: the power's gone (0..1). */
export function updateScreens(time, dt = 0, dark = 0) {
  const f = Math.floor(time * 12) % 4;
  if (tv.state === 'show' && Math.floor(time * 10) !== show.last) { show.last = Math.floor(time * 10); drawShow(SHOW_LEN - show.t); show.tex.needsUpdate = true; }
  const haunted = tv.state === 'off' && dark > 0.5;
  if (haunted && Math.floor(time * 10) !== show.last) { // static, and then, clean, a cut to him
    show.last = Math.floor(time * 10); const g = show.g, face = (time % 3.4) < 0.5;
    if (face) drawWrong(g, false, 'I SEE YOU.');
    else { g.fillStyle = '#000'; g.fillRect(0, 0, 128, 96); for (let y = 0; y < 96; y += 2) for (let x = 0; x < 128; x += 3) { const v = Math.random() * 210 | 0; g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 16) + ')'; g.fillRect(x, y, 3, 2); } }
    show.tex.needsUpdate = true;
  }
  for (const e of screens) {
    e.tex.offset.x = f * 0.25;
    const want = tv.state === 'show' || haunted ? show.tex : tv.state === 'off' ? show.black : e.tex;
    if (e.mat.map !== want) { if (e.mat.map) e.mat.map = want; if (e.mat.emissiveMap) e.mat.emissiveMap = want; }
  }
}

export function dressHouse(scene, byId) {
  const jobs = LEVEL.dress.map(async (e) => {
    let gltf;
    try { gltf = await load(e.model); } catch (err) { console.warn(`dress: ${e.model} failed`, err?.message || err); return; }
    const m = gltf.scene.clone(true);
    if (e.squash) m.traverse((o) => { // pull everything above this height down (a tap that would poke through the mirror)
      if (!o.isMesh) return;
      const [from, k] = e.squash, g = o.geometry.clone(), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > from) p.setY(i, from + (p.getY(i) - from) * k);
      p.needsUpdate = true; o.geometry = g;
    });
    if (e.tv) { // the static: the screen's picture is a strip of four frames
      const scr = m.getObjectByName('screen');
      if (scr) { scr.material = scr.material.clone(); scr.material.userData = {}; makePS1(scr.material); const t = scr.material.map || scr.material.emissiveMap; if (t) { const c = t.clone(); c.needsUpdate = true; c.wrapS = THREE.RepeatWrapping; if (scr.material.map) scr.material.map = c; if (scr.material.emissiveMap) scr.material.emissiveMap = c; screens.push({ tex: c, mat: scr.material }); makeShow(); e.aerial = true; } }
    }
    if (e.door) doorNode = m.getObjectByName('door');
    if (e.legs) m.traverse((o) => { // taller legs: everything above their tops moves up, and the legs stretch to match
      if (!o.isMesh) return;
      const [top, add] = e.legs, g = o.geometry.clone(), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, y >= top ? y + add : y * ((top + add) / top)); }
      p.needsUpdate = true; o.geometry = g;
    });
    if (e.squash === undefined && e.model === 'psx_box') { /* (closed: a lid on it) */ }
    m.traverse((o) => { // lace goes to nothing as it shrinks with distance: a plain cloth holds up
      if (o.isMesh && o.material?.name === 'lace') { plainCloth = plainCloth || makePS1(new THREE.MeshLambertMaterial({ color: 0xe4dcc8, side: THREE.DoubleSide })); o.material = plainCloth; }
    });
    if (e.hide) e.hide.forEach((n) => { const o = m.getObjectByName(n); if (o) o.visible = false; });
    const holder = new THREE.Group();
    holder.rotation.y = ((e.rot || 0) * Math.PI) / 180;
    holder.add(m);
    if (e.fit) {
      const T = boundsOf(e.fit, byId), want = T.getSize(new THREE.Vector3()), rot = ((((e.rot || 0) % 180) + 180) % 180) === 90;
      const own = new THREE.Box3().setFromObject(m).getSize(_s.set(0, 0, 0)).clone(); // (the model unrotated, at scale 1)
      m.scale.set((rot ? want.z : want.x) / own.x, e.top ? 1 : want.y / (e.h ?? own.y), (rot ? want.x : want.z) / own.z);
      holder.updateMatrixWorld(true);
      _b.setFromObject(holder); // where it ended up: now slide it into the box
      const cx = (T.min.x + T.max.x) / 2 - (_b.min.x + _b.max.x) / 2, cz = (T.min.z + T.max.z) / 2 - (_b.min.z + _b.max.z) / 2;
      holder.position.set(cx, e.top ? T.max.y - _b.max.y : T.min.y - _b.min.y, cz);
    } else holder.position.fromArray(e.at);
    scene.add(holder);
    if (e.aerial && !remote) { // the remote, on the coffee table
      remote = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.15), new THREE.MeshLambertMaterial({ color: 0x1c1c1e })); body.position.y = 0.011; remote.add(body);
      for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.012), new THREE.MeshLambertMaterial({ color: i === 0 ? 0xc02020 : 0x8a8a90 })); b.position.set((i % 2 ? 0.01 : -0.01), 0.024, -0.05 + Math.floor(i / 2) * 0.03); remote.add(b); }
      remote.position.set(LEVEL.remote[0], LEVEL.remote[1], LEVEL.remote[2]); remote.rotation.y = 0.4; scene.add(remote);
    }
  });
  return Promise.all(jobs);
}
