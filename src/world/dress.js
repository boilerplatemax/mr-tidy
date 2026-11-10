// Dresses the house: real models placed from LEVEL.dress. Gameplay never touches these; the collision boxes in the level stay
// the truth. An entry either stands at a point ({ model, at, rot }) or is stretched to fill the box(es) it replaces
// ({ model, fit: [solid ids], rot, h, top }): that way a jump that was checked against the box is still right for the sofa.
import * as THREE from 'three';
import { LEVEL } from '../data/level.js';
import { loadGLB } from '../render/geometry.js';
import { makePS1, pixelTexture } from '../render/ps1-material.js';
import { audio } from '../audio/audio.js';
import { SHOW } from '../vacuum/voice.js';
import { TUNING } from '../data/tuning.js';
import { lampParts } from './house.js';

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
const SHOW_LEN = TUNING.tutorial.show, EGG_LEN = TUNING.tutorial.egg;
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
function drawWrong(g, flick, text = 'KEEP IT CLEAN.') {
  const W = 128, H = 96; g.fillStyle = flick ? '#1a0808' : '#000'; g.fillRect(0, 0, W, H);
  vacPic(g, 64, 50, 3.1, 'wrong');
  g.textAlign = 'center'; g.font = 'bold 10px monospace'; g.fillStyle = '#f4efd8'; g.fillText(text, 64, 92);
}

/**
 * What the aerial brings in when it's batted: an old cartoon, "Puss and the Wool". A cat bats a ball of yarn across the
 * floor, chases it, gets wound up in it, and sits there pleased with itself. Nothing frightening: a silly little thing.
 */
function drawEgg(u) {
  const g = show.g, W = 128, H = 96;
  const text = (str, y, size = 10, col = '#f4efd8') => { g.textAlign = 'center'; g.font = 'bold ' + size + 'px monospace'; g.fillStyle = '#000'; g.fillText(str, W / 2 + 1, y + 1); g.fillStyle = col; g.fillText(str, W / 2, y); };
  const ball = (x, y, r) => { g.fillStyle = '#c84a64'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = '#f08aa0'; g.lineWidth = 1; for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(x + i * r * 0.4, y, r * 0.9, -1.2, 1.2); g.stroke(); } };
  if (u < 1.6) { g.fillStyle = '#1a1410'; g.fillRect(0, 0, W, H); g.fillStyle = '#e8d8a8'; g.beginPath(); g.arc(64, 48, 40, 0, 7); g.fill(); g.fillStyle = '#1a1410'; g.beginPath(); g.arc(64, 48, 36, 0, 7); g.fill(); text('PUSS', 42, 13, '#e8d8a8'); text('AND THE WOOL', 58, 9, '#e8d8a8'); return; }
  g.fillStyle = '#e8d8a8'; g.fillRect(0, 0, W, H); g.fillStyle = '#b89868'; g.fillRect(0, 72, W, 24); // a floor, a wall
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect((i * 37 + Math.floor(u * 9) * 5) % W, (i * 23) % 70, 1, 3); } // (old film)
  if (u < 3.8) { // bat, bat: the ball goes off across the floor, the thread behind it
    const k = (u - 1.6) / 2.2, bx = 40 + k * 70; g.strokeStyle = '#c84a64'; g.lineWidth = 1; g.beginPath(); g.moveTo(34, 70); g.quadraticCurveTo((34 + bx) / 2, 74, bx, 70); g.stroke();
    catPic(g, 10, 60 + (Math.sin(u * 14) > 0.6 ? -2 : 0)); ball(bx, 66, 5); text('BAT!', 20, 10); return;
  }
  if (u < 5.6) { const k = (u - 3.8) / 1.8; // round and round: wound up in it
    g.strokeStyle = '#c84a64'; g.lineWidth = 1; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(64, 62, 18 - i * 0.6, 9, i * 0.5 + u * 3, 0, 7); g.stroke(); }
    catPic(g, 54 + Math.sin(u * 9) * 8, 60); ball(64 + Math.cos(u * 6) * 22, 66, 4 - k * 2); text('OH DEAR...', 20, 10); return; }
  catPic(g, 52, 60); g.strokeStyle = '#c84a64'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(52, 60 + i * 2); g.lineTo(70, 64 + i * 2); g.stroke(); } // all tied up, and pleased about it
  g.fillStyle = '#c84a64'; for (const [hx, hy] of [[80, 46], [86, 40]]) { g.beginPath(); g.arc(hx - 1.5, hy, 2, 0, 7); g.arc(hx + 1.5, hy, 2, 0, 7); g.fill(); g.beginPath(); g.moveTo(hx - 3.4, hy + 0.6); g.lineTo(hx, hy + 4); g.lineTo(hx + 3.4, hy + 0.6); g.fill(); }
  text('THE END', 20, 11);
}

/**
 * The set in the dark, by itself: him, filling the screen, smiling. No eyes, just two black holes with a faint light deep in
 * each, over a wide black smile that goes nearly ear to ear. Now and then the picture rolls, or breaks to snow.
 */
function drawCreep(g, time) {
  const W = 128, H = 96, roll = Math.sin(time * 0.7) > 0.96 ? ((time * 90) % H) : 0;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(0, roll);
  const red = '#7a0c10', rim = '#a01418';
  g.fillStyle = red; g.fillRect(4, 16, 120, 84); g.fillStyle = rim; g.fillRect(0, 8, 128, 10); g.fillStyle = '#0a0a0a'; g.fillRect(0, -8, 128, 16); // the drum, the rim, the dome above
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(4, 16, 14, 84); g.fillRect(110, 16, 14, 84); // (round: darker at the sides)
  const sway = Math.sin(time * 0.9) * 0.8;
  for (const sx of [-1, 1]) { // no eyes: two black holes, each with a faint light deep in it that seems to follow you
    const ex = 64 + sx * 27, ey = 40 + sx * 1.5;
    g.fillStyle = '#2a0406'; g.beginPath(); g.ellipse(ex, ey, 18, 16, 0, 0, 7); g.fill(); // the recess
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(ex, ey, 15.5, 13.5, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(216, 228, 255, ' + (0.55 + 0.35 * Math.sin(time * 1.3 + sx)) + ')'; g.fillRect(Math.round(ex - sx * 2 + sway), ey - 1, 2, 2);
  }
  g.fillStyle = '#000'; g.beginPath(); g.arc(64, 56, 4, 0, 7); g.fill(); // the nose
  g.beginPath(); g.moveTo(12, 60); g.quadraticCurveTo(64, 100, 116, 60); g.quadraticCurveTo(64, 80, 12, 60); g.fill(); // the smile: black, wide, nearly ear to ear
  g.fillStyle = '#000'; g.beginPath(); g.moveTo(12, 62); g.lineTo(16, 63); g.lineTo(14, 66); g.fill(); g.beginPath(); g.moveTo(116, 62); g.lineTo(112, 63); g.lineTo(114, 66); g.fill(); // (it turns up at the ends)
  g.restore();
  for (let y = 0; y < H; y += 2) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y, W, 1); } // scanlines
  if (Math.random() < 0.06) for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 3) { const v = Math.random() * 200 | 0; g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 16) + ',0.85)'; g.fillRect(x, y, 3, 2); } // a moment of snow
}

/** The set: 'on' (static), 'show' (the programme), 'egg' (the cartoon the aerial brings in), 'off'. When the power goes, he's on it. */
export const tv = {
  state: 'on',
  set(st) {
    this.state = st;
    if (st === 'show') { show.t = SHOW_LEN; show.said = 0; }
    if (st === 'egg') show.t = EGG_LEN;
    if (st === 'off') show.t = 0;
  },
  /** The remote (a knockable now: o is it), batted where it lies: the programme comes on. */
  pokeRemote(camera, o = null) {
    if (this.state !== 'on' || (o && camera && !near(camera, _c.set(o.x, o.y + 0.02, o.z), 0.7, 0.5))) return false;
    audio.play('tv.show', { pos: { x: 5.3, y: 0.6, z: 2.3 }, refDistance: 2 }); this.set('show');
    return true;
  },
  /** The lamp's plug (the tutorial's last lesson; it used to be the TV's), swiped out of the wall. */
  pokePlug(camera) { return lamp.poke(camera); },
  /** The aerial, batted: the picture swims, and an old cartoon comes in. Only on the plain static, not in the dark. */
  pokeAerial(camera) {
    if (!aerial || this.state !== 'on' || !near(camera, aerial, 0.75, 0.45)) return false;
    audio.play('knock.clink', { pos: aerial, rate: 1.4 }); audio.play('tv.show', { pos: { x: 5.3, y: 0.6, z: 2.3 }, refDistance: 2, rate: 1.25 });
    this.set('egg');
    return true;
  },
};
let aerial = null; // (where the TV's rabbit ears are, in the world)

/**
 * The living-room floor lamp: on from the start, a warm light over that end of the room, until its plug is swiped out of the
 * wall (then it's dark there, and the flex lies loose). It goes out with the power too, and comes back on next run.
 */
export const lamp = {
  on: true, light: null,
  set(on) {
    this.on = on;
    if (lampParts.plugged) lampParts.plugged.visible = on;
    if (lampParts.flexIn) lampParts.flexIn.visible = on;
    if (lampParts.flexOut) lampParts.flexOut.visible = !on;
  },
  poke(camera) {
    const L = LEVEL.lampOutlet, p = _s.set(L.pos[0] + L.n[0] * 0.03, L.pos[1] - 0.01, L.pos[2]);
    if (!this.on || !near(camera, p, 0.6, 0.55)) return false;
    audio.play('vac.unplug', { pos: p, rate: 1.2 }); this.set(false);
    return true;
  },
  reset() { this.set(true); },
};
function near(camera, p, reach, cone) {
  const eye = camera.position, dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z, d = Math.hypot(dx, dy, dz);
  if (d > reach) return false;
  const v = camera.getWorldDirection(_c);
  return (dx * v.x + dy * v.y + dz * v.z) / d >= cone;
}

/** Per fixed tick: the programme runs, and he narrates it. */
export function tvTick(dt) {
  if (tv.state === 'egg') { show.t -= dt; if (show.t <= 0) tv.set('on'); return; }
  if (tv.state !== 'show') return;
  show.t -= dt;
  const u = SHOW_LEN - show.t;
  while (show.said < SHOW.length && u >= SHOW[show.said][0]) { audio.play(`tv.say.${show.said}`, { pos: { x: 5.3, y: 0.6, z: 2.3 }, refDistance: 2.5 }); show.said++; } // (no captions: the programme puts its own words on the screen)
  if (show.t <= 0) tv.set('on');
}

/** Per rendered frame: the television. dark: the power's gone (0..1). */
export function updateScreens(time, dt = 0, dark = 0) {
  const f = Math.floor(time * 12) % 4;
  if (lamp.light) lamp.light.intensity = lamp.on ? TUNING.tutorial.lamp.power * (1 - Math.min(1, dark)) : 0; // (it goes with the power)
  if (tv.state === 'show' && Math.floor(time * 10) !== show.last) { show.last = Math.floor(time * 10); drawShow(SHOW_LEN - show.t); show.tex.needsUpdate = true; }
  if (tv.state === 'egg' && Math.floor(time * 10) !== show.last) { show.last = Math.floor(time * 10); drawEgg(EGG_LEN - show.t); show.tex.needsUpdate = true; }
  const haunted = tv.state !== 'show' && dark > 0.5; // the power's gone, and he's on the set by itself, smiling out at the room
  if (haunted && Math.floor(time * 10) !== show.last) { show.last = Math.floor(time * 10); drawCreep(show.g, time); show.tex.needsUpdate = true; }
  for (const e of screens) {
    e.tex.offset.x = f * 0.25;
    const want = tv.state === 'show' || tv.state === 'egg' || haunted ? show.tex : tv.state === 'off' ? show.black : e.tex;
    if (e.mat.map !== want) { if (e.mat.map) e.mat.map = want; if (e.mat.emissiveMap) e.mat.emissiveMap = want; }
  }
}

export function dressHouse(scene, byId) {
  { const L = TUNING.tutorial.lamp; lamp.light = new THREE.PointLight(L.color, L.power, L.dist, 1.2); lamp.light.position.fromArray(LEVEL.lampLight); scene.add(lamp.light); lamp.set(true); } // the floor lamp, on
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
    if (e.noFlex) m.traverse((o) => { // (the model's own flex: a stub of cord along the floor. The working one is drawn in src/world/house.js, from the base)
      if (!o.isMesh || !o.geometry.index) return;
      const P = o.geometry.attributes.position, I = o.geometry.index.array, keep = [];
      for (let t = 0; t < I.length; t += 3) { let cord = false; for (let k = 0; k < 3; k++) { const v = I[t + k], x = P.getX(v), y = P.getY(v), z = P.getZ(v); if (y < e.noFlex[1] && Math.hypot(x, z) > e.noFlex[0]) cord = true; } if (!cord) keep.push(I[t], I[t + 1], I[t + 2]); }
      o.geometry = o.geometry.clone(); o.geometry.setIndex(keep);
    });
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
    if (e.aerial && !aerial) { // where its rabbit ears are: bat them and the picture changes
      holder.updateMatrixWorld(true);
      const base = m.getObjectByName('antenna_base');
      if (base) { aerial = new THREE.Vector3(); base.getWorldPosition(aerial); _b.setFromObject(base); aerial.copy(_b.getCenter(_c)); aerial.y += 0.14; }
    }
  });
  return Promise.all(jobs);
}
