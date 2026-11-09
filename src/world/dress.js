// Dresses the house: real models placed from LEVEL.dress. Gameplay never touches these; the collision boxes in the level stay
// the truth. An entry either stands at a point ({ model, at, rot }) or is stretched to fill the box(es) it replaces
// ({ model, fit: [solid ids], rot, h, top }): that way a jump that was checked against the box is still right for the sofa.
import * as THREE from 'three';
import { LEVEL } from '../data/level.js';
import { loadGLB } from '../render/geometry.js';
import { makePS1 } from '../render/ps1-material.js';

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

const screens = [];
/** Per rendered frame: the televisions flicker through their four frames of static. */
export function updateScreens(time) { const f = Math.floor(time * 12) % 4; for (const t of screens) t.offset.x = f * 0.25; }

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
      if (scr) { scr.material = scr.material.clone(); scr.material.userData = {}; makePS1(scr.material); const t = scr.material.map || scr.material.emissiveMap; if (t) { const c = t.clone(); c.needsUpdate = true; c.wrapS = THREE.RepeatWrapping; if (scr.material.map) scr.material.map = c; if (scr.material.emissiveMap) scr.material.emissiveMap = c; screens.push(c); } }
    }
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
  });
  return Promise.all(jobs);
}
