// Dresses the house: real models placed from LEVEL.dress. Gameplay never touches these; the collision boxes in the level stay
// the truth. An entry either stands at a point ({ model, at, rot }) or is stretched to fill the box(es) it replaces
// ({ model, fit: [solid ids], rot, h, top }): that way a jump that was checked against the box is still right for the sofa.
import * as THREE from 'three';
import { LEVEL } from '../data/level.js';
import { loadGLB } from '../render/geometry.js';
import { makePS1, pixelTexture } from '../render/ps1-material.js';
import { audio } from '../audio/audio.js';

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

// The easter egg: bat the aerial and the set picks up a programme.
const SHOW_LEN = 15;
const show = { t: 0, canvas: null, g: null, tex: null, pos: null };
function makeShow() {
  const c = show.canvas = document.createElement('canvas'); c.width = 128; c.height = 96; show.g = c.getContext('2d');
  const t = show.tex = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; pixelTexture(t); t.repeat.set(4, 1);
}
function drawShow(u) {
  const g = show.g, W = 128, H = 96, text = (str, y, size = 11) => { g.textAlign = 'center'; g.font = 'bold ' + size + 'px monospace'; g.fillStyle = '#000'; g.fillText(str, W / 2 + 1, y + 1); g.fillStyle = '#f4efd8'; g.fillText(str, W / 2, y); };
  const vac = (x, y, k, face) => { g.fillStyle = '#b01818'; g.fillRect(x - 13 * k, y - 10 * k, 26 * k, 14 * k); g.fillStyle = '#141414'; g.beginPath(); g.arc(x, y - 10 * k, 12 * k, Math.PI, 0); g.fill(); g.fillStyle = face ? '#000' : '#f4efd8'; g.fillRect(x - 8 * k, y - 7 * k, 5 * k, 5 * k); g.fillRect(x + 3 * k, y - 7 * k, 5 * k, 5 * k); g.fillStyle = '#000'; g.fillRect(x - 6 * k, y, 12 * k, 2 * k); };
  if (u < 3) { g.fillStyle = '#2b6fb0'; g.fillRect(0, 0, W, H); g.fillStyle = '#e0c040'; g.fillRect(8, 8, W - 16, H - 16); g.fillStyle = '#2b6fb0'; g.fillRect(12, 12, W - 24, H - 24); text('THE', 34); text('MR. TIDY', 52, 15); text('HOUR', 70); return; }
  if (u < 8) { g.fillStyle = '#d8c89a'; g.fillRect(0, 0, W, H); g.fillStyle = '#7a5a38'; g.fillRect(0, 70, W, 26); const p = (u - 3) / 5, cx = 20 + p * 170 - 30; g.fillStyle = '#d07a30'; g.fillRect(cx + 40, 60, 16, 8); g.fillRect(cx + 54, 54, 8, 8); g.fillRect(cx + 40, 68, 3, 4); g.fillRect(cx + 52, 68, 3, 4); vac(cx, 68, 1.4, false); text('HE LOVES A TIDY HOME', 18, 9); return; }
  if (u < 11.5) { g.fillStyle = '#c84030'; g.fillRect(0, 0, W, H); vac(64, 54, 2, false); text('HE KEEPS IT CLEAN', 18, 10); text('EVERY NIGHT', 86, 10); return; }
  const flick = Math.random() < 0.15; g.fillStyle = flick ? '#201010' : '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#7a0e0e'; g.fillRect(16, 16, W - 32, H - 22); g.fillStyle = '#000'; g.beginPath(); g.arc(44, 42, 13, 0, 7); g.arc(84, 42, 13, 0, 7); g.fill(); g.beginPath(); g.moveTo(26, 62); g.quadraticCurveTo(64, 98, 102, 62); g.quadraticCurveTo(64, 78, 26, 62); g.fill(); text('HE CAN SEE YOU', 92, 10);
}

/** Per rendered frame: the televisions flicker through their four frames of static, or play the programme. */
export function updateScreens(time, dt = 0) {
  const f = Math.floor(time * 12) % 4;
  for (const e of screens) {
    e.tex.offset.x = f * 0.25;
    const on = show.t > 0, want = on ? show.tex : e.tex;
    if (e.mat.map !== want) { if (e.mat.map) e.mat.map = want; if (e.mat.emissiveMap) e.mat.emissiveMap = want; }
  }
  if (show.t > 0) { show.t -= dt; if (Math.floor(time * 10) !== show.last) { show.last = Math.floor(time * 10); drawShow(SHOW_LEN - show.t); show.tex.needsUpdate = true; } }
}

/** The paw went through the aerial? */
export function pokeAerial(camera) {
  if (!show.pos || show.t > 0) return false;
  const eye = camera.position, dx = show.pos.x - eye.x, dy = show.pos.y - eye.y, dz = show.pos.z - eye.z, d = Math.hypot(dx, dy, dz);
  if (d > 0.75) return false;
  const v = camera.getWorldDirection(_c);
  if ((dx * v.x + dy * v.y + dz * v.z) / d < 0.6) return false;
  show.t = SHOW_LEN; audio.play('knock.clink', { pos: show.pos }); audio.play('tv.show', { pos: show.pos, refDistance: 2 });
  return true;
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
    if (e.aerial) { holder.updateMatrixWorld(true); const a = m.getObjectByName('antenna_base'); if (a) { show.pos = new THREE.Vector3(); new THREE.Box3().setFromObject(a).getCenter(show.pos); show.pos.y += 0.22; } }
  });
  return Promise.all(jobs);
}
