// Knockable objects (build prompt 0.5, 6.2): a small custom physics, no library. Objects rest on surfaces, slide with
// friction when batted, tip when their centre passes an edge, tumble as they fall, and land on whatever is below.
// Hitting the floor counts as a knock-over: each kind of thing does what it does (shatters, breaks into chunks, bounces,
// rolls, thuds), leaves a mess, and makes a noise event. Data for the 25 objects is in src/data/knockable-props.js.
//
// DESIGN NOTE: objects are not colliders for the cat. They're small, and a cat stumbling on a mug would fight the jumps.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { PROPS, PALETTES } from '../data/knockable-props.js';
import { loadGLB } from '../render/geometry.js';
import { makePS1, pixelTexture } from '../render/ps1-material.js';
import { audio } from '../audio/audio.js';

const K = TUNING.knock, S = TUNING.swipe, X = TUNING.knockFx;
const roomAt = (x, z) => LEVEL.rooms.find((r) => x >= r.min[0] && x <= r.max[0] && z >= r.min[1] && z <= r.max[1])?.id || null;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);

const _axis = new THREE.Vector3(), _dq = new THREE.Quaternion(), _up = new THREE.Quaternion();
const _v = new THREE.Vector3(), _vy = new THREE.Vector3(0, 1, 0);

// What the props leave on the floor, and how each survivor gets away.
const MESS = { mug: 'coffee', teapot: 'coffee', dinner_plate: 'china', teacup: 'china', vase: 'china', cookie_jar: 'china', table_lamp: 'china', cat_figurine: 'china', soap_dish: 'china', perfume: 'perfume', snow_globe: 'glass', dentures_glass: 'glass', picture_frame: 'glass', button_jar: 'buttons' };
const SURVIVOR = { dentures_glass__teeth: 'hop', soap_dish__soap: 'roll', cookie_jar__lid: 'roll', cat_figurine__head: 'roll', table_lamp__shade: 'tumble', mantel_clock__face: 'roll', rotary_phone__handset: 'tumble' };

// The shakers come joined together in the pack: each is cut out of the one mesh and knocked about on its own.
const SPLIT = { salt_shaker: -1, pepper_shaker: 1 };
const SHAKER = (side, tint) => ({ mass: 0.1, swipes: 1, noise: 1, landing: 'bounce', tint, size: [0.04, 0.075, 0.04], nodes: { intact: side } });
PROPS.wall_clock = { mass: 0.9, swipes: 1, noise: 5, landing: 'break', tint: '#6a4628', size: [0.324, 0.324, 0.06], nodes: { intact: 'wall_clock' } };
PROPS.urn = { mass: 0.9, swipes: 2, noise: 5, landing: 'shatter', tint: '#8a8782', size: [0.14, 0.26, 0.14], nodes: { intact: 'urn', fx: ['fx_shards', 'fx_puff'] } }; // Grandpa
PROPS.salt_shaker = SHAKER('salt_shaker', '#f4f1ea'); PROPS.pepper_shaker = SHAKER('pepper_shaker', '#2a2a2a');

function buildType(id) {
  const p = PROPS[id], [w, h, d] = p.size;
  return { ...p, id, h, r: Math.max(0.02, Math.min(0.13, Math.max(w, d) / 2)), breakable: p.landing === 'shatter' || p.landing === 'break', points: p.noise * K.noiseScale };
}

export class Knockables {
  constructor({ scene, world, byId, noise, debris }) {
    this.world = world; this.noise = noise; this.debris = debris; this.scene = scene;
    this.count = 0; // knock-overs so far (the vac's anger and the win screen read this)
    this.list = [];
    this.byId = new Map();
    this.lib = null; // the loaded pack
    this._g = { y: 0, surface: '', collider: null };
    this._clip = (nx, nz) => { const o = this._cur, vn = o.vx * nx + o.vz * nz; if (vn < 0) { o.vx -= nx * vn * (1 + K.wallBounce); o.vz -= nz * vn * (1 + K.wallBounce); } };
    const types = new Map();
    for (const d of LEVEL.knockables) {
      if (!types.has(d.type)) types.set(d.type, buildType(d.type));
      const t = { ...types.get(d.type), topple: !!d.topple };
      const mesh = new THREE.Group(); // (the model goes in once the pack has loaded)
      const top = d.on === 'floor' ? 0 : byId.get(d.on).max[1];
      const o = {
        id: d.id, type: d.type, t, mesh, mass: t.mass, h: t.h, r: t.r, hits: 0, node: null,
        x: d.x, y: top, z: d.z, vx: 0, vy: 0, vz: 0, q: new THREE.Quaternion(), wx: 0, wy: 0, wz: 0,
        px: d.x, py: top, pz: d.z, pq: new THREE.Quaternion(),
        state: 'rest', tipT: 0, bounces: 0, dirty: true, knocked: false, start: { x: d.x, y: top, z: d.z },
      };
      if (d.yaw) { o.startQ = new THREE.Quaternion().setFromAxisAngle(_axis.set(0, 1, 0), d.yaw); o.q.copy(o.startQ); o.pq.copy(o.startQ); }
      scene.add(mesh);
      this.list.push(o); this.byId.set(o.id, o);
    }
    this.frame(1);
    this.ready = loadGLB('game-assets/models/house/psx_wall_clock.glb').then((g) => { this.clockLib = g.scene; }).catch(() => {}).then(() => loadGLB(TUNING.assets.knockables)).then((g) => this._dress(g)).catch((e) => console.warn('knockables failed to load:', e?.message || e));
  }

  /** A fresh copy of a node from the pack, at the origin. */
  _clone(name) {
    if (name === 'picture_frame') return this._frame();
    if (SPLIT[name]) return this._shaker(name);
    if (name === 'button_jar') return this._jarFill();
    if (name === 'urn') return this._urn();
    if (name === 'wall_clock' && this.clockLib) { const c = this.clockLib.clone(true); c.position.y = -1.638; return c; } // (modelled hanging at its height on the wall)
    const n = this.lib?.getObjectByName(name);
    if (!n) { console.warn(`knockables: no node ${name}`); return new THREE.Group(); }
    const c = n.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
    return c;
  }

  /** One shaker: the triangles on its side of the joined mesh, moved to the middle. */
  _shaker(name) {
    if (!this.shakerGeo) this.shakerGeo = {};
    const side = SPLIT[name], src = this.lib.getObjectByName('salt_pepper');
    if (!this.shakerGeo[name]) {
      let g0 = src.geometry; if (g0.index) g0 = g0.toNonIndexed();
      const keep = [], p = g0.attributes.position;
      for (let i = 0; i < p.count; i += 3) if ((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) * side > 0) keep.push(i, i + 1, i + 2);
      const g = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(g0.attributes)) { const arr = new Float32Array(keep.length * a.itemSize); keep.forEach((v, j) => { for (let c = 0; c < a.itemSize; c++) arr[j * a.itemSize + c] = a.array[v * a.itemSize + c]; }); g.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize)); }
      g.computeBoundingBox(); g.translate(-(g.boundingBox.min.x + g.boundingBox.max.x) / 2, 0, 0);
      this.shakerGeo[name] = g;
    }
    return new THREE.Mesh(this.shakerGeo[name], src.material);
  }

  /** Grandpa: a brass urn with a lid and a little knob. */
  _urn() {
    const brass = this.urnMat ??= makePS1(new THREE.MeshLambertMaterial({ color: 0xb08a3a })), dark = this.urnDark ??= makePS1(new THREE.MeshLambertMaterial({ color: 0x3a2a12 }));
    const pts = [[0, 0], [0.05, 0], [0.055, 0.02], [0.045, 0.04], [0.065, 0.1], [0.07, 0.15], [0.06, 0.19], [0.04, 0.21], [0.042, 0.22]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), brass);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.02, 10), brass); lid.position.y = 0.23;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 4), brass); knob.position.y = 0.25;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.071, 0.071, 0.012, 10), dark); band.position.y = 0.13;
    g.add(body, lid, knob, band);
    return g;
  }

  /** What's in the button jar: buttons, lying every which way, and a lid. */
  _jarFill() {
    const g = new THREE.Group(), src = this.lib.getObjectByName('fx_button');
    for (let i = 0; i < 34; i++) {
      const b = src.clone(true), a = Math.random() * 6.28, y = 0.008 + Math.pow(Math.random(), 1.2) * 0.078, R = Math.random() * (0.03 - y * 0.03);
      b.position.set(Math.cos(a) * R, y, Math.sin(a) * R); b.rotation.set(Math.random() * 1.2 - 0.6, Math.random() * 6.28, Math.random() * 1.2 - 0.6); b.scale.setScalar(1.15);
      const tint = pick(PALETTES.buttons); b.traverse((q) => { if (q.isMesh) q.material = this.debris.tinted(q.material, tint); });
      g.add(b);
    }
    if (!this.lidMat) { this.lidMat = makePS1(new THREE.MeshLambertMaterial({ color: 0xc9a44a })); this.lidGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.018, 12); }
    const lid = new THREE.Mesh(this.lidGeo, this.lidMat); lid.position.y = 0.128; g.add(lid);
    return g;
  }

  /** A little gold photo frame on a stand, made here (the pack's one came out garbled). */
  _frame() {
    if (!this.frameParts) {
      const c = document.createElement('canvas'); c.width = 16; c.height = 24; const g = c.getContext('2d');
      g.fillStyle = '#8f9ba8'; g.fillRect(0, 0, 16, 24); g.fillStyle = '#5c7a52'; g.fillRect(0, 15, 16, 9); g.fillStyle = '#6a4a30'; g.fillRect(3, 13, 3, 4); g.fillStyle = '#3f6b3a'; g.fillRect(1, 8, 7, 6);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; pixelTexture(t);
      this.frameParts = { gold: makePS1(new THREE.MeshLambertMaterial({ color: 0xc9a44a })), pic: makePS1(new THREE.MeshLambertMaterial({ map: t })), body: new THREE.BoxGeometry(0.12, 0.16, 0.012), face: new THREE.PlaneGeometry(0.096, 0.136), strut: new THREE.BoxGeometry(0.03, 0.15, 0.006) };
    }
    const P = this.frameParts, grp = new THREE.Group(), tilt = new THREE.Group();
    tilt.position.set(0, 0, 0.012); tilt.rotation.x = -0.2;
    const body = new THREE.Mesh(P.body, P.gold); body.position.y = 0.08;
    const pic = new THREE.Mesh(P.face, P.pic); pic.position.set(0, 0.08, 0.0065);
    tilt.add(body, pic);
    const strut = new THREE.Mesh(P.strut, P.gold); strut.position.set(0, 0.066, -0.048); strut.rotation.x = 0.36;
    grp.add(tilt, strut);
    return grp;
  }

  _dress(gltf) {
    this.lib = gltf.scene;
    const shard = this.lib.getObjectByName('fx_shard_0');
    let geo = null; shard?.traverse((m) => { if (m.isMesh && !geo) geo = m.geometry; });
    if (geo) this.debris.setShardShape(geo);
    for (const o of this.list) this._dressOne(o);
    this.frame(1);
  }

  _dressOne(o) {
    const n = o.t.nodes, group = new THREE.Group();
    group.position.y = -o.h / 2; // (the group's origin is the middle of the object; the models stand on their base)
    group.add(this._clone(n.intact));
    for (const part of n.parts || []) group.add(this._clone(part));
    for (const g of n.glass || []) if (g !== n.intact) group.add(this._clone(g));
    o.node = group; o.mesh.add(group);
  }

  /** Back as it was, for a new run. */
  reset() {
    this.count = 0;
    for (const o of this.list) {
      o.x = o.px = o.start.x; o.y = o.py = o.start.y; o.z = o.pz = o.start.z;
      o.vx = o.vy = o.vz = 0; o.wx = o.wy = o.wz = 0; o.startQ ? (o.q.copy(o.startQ), o.pq.copy(o.startQ)) : (o.q.identity(), o.pq.identity());
      o.state = 'rest'; o.tipT = 0; o.bounces = 0; o.knocked = false; o.dirty = true; o.mesh.visible = true; o.hits = 0; o.hitVac = false; o.roll = null; if (o.node) { o.node.scale.set(1, 1, 1); o.node.position.y = -o.h / 2; }
      if (o.swapped && this.lib) { o.mesh.remove(o.node); o.swapped = false; this._dressOne(o); }
    }
    this.frame(1);
  }

  /** The bat of a paw: everything in a short cone in front of the eye gets a shove. Returns how many it hit. */
  swipe(player, camera) {
    camera.getWorldDirection(_v);
    const eye = camera.position, right = { x: Math.cos(player.yaw), z: -Math.sin(player.yaw) };
    let dx = player.fx - right.x * S.sideBias, dz = player.fz - right.z * S.sideBias; // the paw sweeps right to left
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let hits = 0;
    for (const o of this.list) {
      if (o.state === 'gone') continue;
      const cx = o.x - eye.x, cy = o.y + o.h / 2 - eye.y, cz = o.z - eye.z, d = Math.hypot(cx, cy, cz);
      if (d > S.reach + o.r || d < 1e-3 || (cx * _v.x + cy * _v.y + cz * _v.z) / d < S.cone) continue;
      // heavy things take a few hits: the early ones only rock them
      o.hits++; if (o.t.id === 'yarn_ball') this._softHit = true;
      const free = o.hits >= o.t.swipes, speed = free ? Math.max(S.minSpeed, Math.min(S.maxSpeed, S.impulse / o.mass)) : S.nudge;
      this.shove(o, dx, dz, speed);
      hits++;
    }
    if (hits) audio.play(this._softHit ? 'knock.soft' : 'knock.clink', { pos: eye, rate: 0.9 + Math.random() * 0.3 });
    this._softHit = false;
    return hits;
  }

  /** Give an object a push along (dx, dz) at this speed. */
  shove(o, dx, dz, speed) {
    if (o.roll) { const u = o.roll; u.yaw = Math.atan2(dz, dx); u.dx = dx; u.dz = dz; u.v = Math.max(u.v, Math.min(X.rollStart * 1.3, speed)); o.state = 'unroll'; o.dirty = true; return; }
    if (o.t.topple && !o.knocked) { if (speed >= K.toppleSpeed) { o.y = 0; this._knockOver(o); } return; } // knocked over where it stands
    o.vx += dx * speed; o.vz += dz * speed; o.dirty = true;
    if (o.state === 'rest') o.state = 'slide';
  }

  /** The particular thing this one does when it lands. Returns the pieces it threw clear. */
  _fx(o) {
    const t = o.t, n = t.nodes, D = this.debris, bits = [], fx = n.fx || [], x = o.x, z = o.z;
    if (!this.lib) return bits;
    for (const part of n.parts || []) { // what survives flies off on its own (they all share the object's origin)
      const m = this._clone(part);
      const handset = part.includes('handset');
      const b = D.bit(m, x, Math.max(0.03, o.y), z, SURVIVOR[part] || 'tumble', { life: part.includes('teeth') ? X.chatter : X.roll, r: t.r * 0.7, speed: handset ? 0.5 : undefined, up: handset ? 1 : undefined });
      if (handset) { b.leash = X.handsetLeash; b.base = o; }
      bits.push(b);
    }
    const lie = (name, yaw) => { const m = this._clone(name); m.rotation.y = yaw; return m; };
    if (fx.includes('fx_ribbon') && !X.rollers[t.id]) { // a long trail of paper or wool across the floor, as far as there's floor
      const paper = t.id === 'toilet_roll', mat = (() => { let r = null; this.lib.getObjectByName('fx_ribbon').traverse((m) => { if (m.isMesh && !r) r = m.material; }); return r; })();
      let px = x, pz = z, yaw = Math.random() * 6.28;
      for (let i = 0; i < (paper ? X.paperPieces : X.woolPieces); i++) {
        const dx = Math.sin(yaw) * 0.6, dz = Math.cos(yaw) * 0.6;
        if (this.world.penetration(px + dx, pz + dz, 0.02, 0.005, 0.05) > 0 || this.world.penetration(px + dx / 2, pz + dz / 2, 0.02, 0.005, 0.05) > 0) break;
        const m = lie('fx_ribbon', yaw); m.traverse((c) => { if (c.isMesh) c.material = D.tinted(mat, t.tint); }); if (!paper) m.scale.set(0.25, 1, 1);
        m.position.set(px, 0.006, pz);
        bits.push(D.bit(m, px, 0.006 + i * 0.0015, pz, 'lie'));
        px += dx; pz += dz; yaw += rand(-0.5, 0.5);
      }
    }
    if (fx.includes('fx_puff')) {
      const m = this._clone('fx_puff'); m.traverse((c) => { if (c.isMesh) { c.material = c.material.clone(); c.material.userData = {}; c.material.transparent = true; c.material.depthWrite = false; c.material.color.set(t.tint); m.material = c.material; } });
      if (t.id === 'urn') m.scale.setScalar(2.2); // (that's Grandpa)
      bits.push(D.bit(m, x, 0.1, z, 'puff', { life: X.puffLife }));
    }
    if (fx.includes('fx_button')) for (let i = 0; i < X.buttons; i++) { const m = this._clone('fx_button'), c = pick(PALETTES.buttons); m.traverse((q) => { if (q.isMesh) q.material = D.tinted(q.material, c); }); bits.push(D.bit(m, x, 0.05, z, 'tumble', { speed: rand(0.6, 2), up: rand(0.8, 2.2), r: 0.012 })); }
    if (fx.includes('fx_feather')) for (let i = 0; i < X.feathers; i++) { const m = this._clone('fx_feather'), c = pick(PALETTES.feathers); m.traverse((q) => { if (q.isMesh) q.material = D.tinted(q.material, c); }); bits.push(D.bit(m, x, rand(0.25, 0.7), z, 'drift', { speed: rand(0.4, 1.2) })); }
    if (fx.includes('fx_cord')) { // the handset's curly cord, stretched back to the phone
      const hand = bits[0], m = this._clone('fx_cord');
      this.scene.add(m);
      hand.link = { mesh: m, from: o };
      bits.push({ mesh: m, x, y: o.y, z, scale: 1, settled: true, mode: 'lie', drawn: true, from: null, q: m.quaternion, px: x, py: o.y, pz: z, link: null });
      D.bits.push(bits[bits.length - 1]);
    }
    if (n.variants && t.id !== 'toilet_roll') { // it stays whole but it's changed: it pops open, cracks, or runs out of paper
      const name = Object.values(n.variants)[0];
      o.mesh.remove(o.node); const g = new THREE.Group(); g.position.y = -o.h / 2; g.add(this._clone(name)); o.node = g; o.mesh.add(g); o.swapped = true;
    }
    return bits;
  }

  /** It hit the floor for the first time: that's a knock-over. Counts once, makes the noise and the mess, and breaks if it can. */
  _knockOver(o) {
    o.knocked = true; this.count++;
    const t = o.t, room = roomAt(o.x, o.z), D = this.debris, chunks = t.landing === 'break';
    if (t.breakable && this.lib) { o.mesh.remove(o.node); o.swapped = true; }
    const bits = this._fx(o);
    const size = chunks ? X.chunkSize : TUNING.debris.cubeSize, n = chunks ? 3 + (Math.random() * 2 | 0) : 6 + (Math.random() * 7 | 0);
    const cubes = t.breakable ? D.burst(o.x, o.z, size, n, t.tint) : [];
    const decal = D.decal(o.x, o.z, X.decalSize, MESS[t.id], Math.random() * Math.PI);
    D.messes.push({ id: o.id, x: o.x, z: o.z, room, decal, cubes, bits, cleaned: false });
    if (t.breakable) {
      o.state = 'gone'; o.mesh.visible = false; o.vx = o.vy = o.vz = 0;
      audio.play('knock.break', { pos: o, rate: (chunks ? 0.7 : 0.9) + Math.random() * 0.25 });
    } else if (t.id === 'yarn_ball') audio.play('knock.soft', { pos: o });
    else if (t.id === 'rubber_duck') audio.play('knock.squeak', { pos: o, rate: 0.9 + Math.random() * 0.25 });
    else audio.play('knock.thud', { pos: o, gain: 0.6 });
    this.noise.emit({ kind: 'crash', x: o.x, y: 0, z: o.z, loud: t.points, room, objectId: o.id });
    if (X.rollers[t.id]) this._startRoll(o, bits);
  }

  /** Toilet paper and wool: it goes on rolling, and unwinds behind it. Hit it again and it goes again, until it's spent. */
  _startRoll(o, bits) {
    const R = X.rollers[o.t.id], n = Math.ceil(R.len / R.step) + 6, a = Math.hypot(o.vx, o.vz) > 0.05 ? Math.atan2(o.vz, o.vx) : Math.random() * 6.28;
    const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 6), nor = new Float32Array(n * 6), idx = [];
    for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
    for (let i = 0; i < n - 1; i++) { const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(idx); g.setDrawRange(0, 0);
    const m = new THREE.Mesh(g, makePS1(new THREE.MeshLambertMaterial({ color: o.t.tint, side: THREE.DoubleSide }))); m.frustumCulled = false;
    const strip = this.debris.bit(m, 0, 0, 0, 'lie'); strip.ribbon = true; bits.push(strip);
    o.vx = o.vz = o.vy = 0; o.wx = o.wy = o.wz = 0; o.bounces = 0;
    o.roll = { R, n, pos, g, strip, yaw: a, dx: Math.cos(a), dz: Math.sin(a), v: X.rollStart, L: 0, next: 0, count: 0, spent: false };
    if (!R.uniform) o.q.setFromUnitVectors(_vy, _axis.set(o.roll.dz, 0, -o.roll.dx)); // a roll goes over on its side
    o.state = 'unroll';
    this._layTrail(o);
  }

  _layTrail(o) {
    const u = o.roll, ax = (-u.dz * u.R.width) / 2, az = (u.dx * u.R.width) / 2, i = u.count * 6, y = 0.004 + (u.R.uniform ? 0.002 : 0), bx = o.x - u.dx * u.R.r0 * 0.7, bz = o.z - u.dz * u.R.r0 * 0.7;
    u.pos[i] = bx + ax; u.pos[i + 1] = y; u.pos[i + 2] = bz + az; u.pos[i + 3] = bx - ax; u.pos[i + 4] = y; u.pos[i + 5] = bz - az;
    u.count++; u.g.attributes.position.needsUpdate = true; u.g.setDrawRange(0, Math.max(0, u.count - 1) * 6);
  }

  _roll(o, dt) {
    const u = o.roll, R = u.R, k = Math.min(1, u.L / R.len), r = R.r0 + (R.r1 - R.r0) * k;
    u.v = Math.max(0, u.v - X.rollFriction * dt);
    u.yaw += Math.sin(o.x * 3.1 + o.z * 2.3) * 0.5 * dt; u.dx = Math.cos(u.yaw); u.dz = Math.sin(u.yaw);
    const step = u.v * dt, nx = o.x + u.dx * step, nz = o.z + u.dz * step;
    if (this.world.penetration(nx + u.dx * r, nz + u.dz * r, 0.02, 0.01, 0.1) > 0) { u.yaw += Math.PI * (0.55 + Math.random() * 0.9); u.v *= 0.55; } // off whatever it ran into
    else {
      o.x = nx; o.z = nz; o.q.premultiply(_dq.setFromAxisAngle(_axis.set(u.dz, 0, -u.dx), step / r));
      if (!u.spent) u.L += step;
      if (!u.spent && !u.strip.total && u.L >= u.next && u.count < u.n) { this._layTrail(o); u.next = u.L + R.step; }
    }
    o.y = r - o.h / 2;
    if (o.node) { const s0 = r / R.r0; o.node.scale.set(s0, R.uniform ? s0 : 1, s0); if (R.uniform) o.node.position.y = (-o.h / 2) * s0; }
    if (!u.spent && u.L >= R.len) { // nothing left on it
      u.spent = true;
      if (R.vanish) { o.state = 'gone'; o.mesh.visible = false; return; } // (the last of the wool)
      if (this.lib && o.t.nodes.variants?.unrolled) { o.mesh.remove(o.node); const g = new THREE.Group(); g.position.y = -o.h / 2; g.add(this._clone(o.t.nodes.variants.unrolled)); o.node = g; o.mesh.add(g); o.swapped = true; }
    }
    if (u.v <= X.rollStop) {
      o.state = 'rest'; o.dirty = true;
      if (u.spent && !u.tubeMess) { u.tubeMess = { id: o.id + ':tube', x: o.x, z: o.z, room: null, decal: -1, cubes: [], bits: [], obj: o, cleaned: false }; this.debris.messes.push(u.tubeMess); } // an empty tube: he'll come and suck it up
      else if (u.tubeMess && !u.tubeMess.cleaned) { u.tubeMess.x = o.x; u.tubeMess.z = o.z; }
    }
  }

  /** Something falling on him: it bounces off, and he reels for a moment. */
  _hitVac(o) {
    const v = this.vac;
    if (!v || o.hitVac || o.vy >= 0) return;
    const V = TUNING.vac, dx = o.x - v.x, dz = o.z - v.z, d = Math.hypot(dx, dz);
    if (d > V.radius + o.r * 0.5 || o.y > V.height * v.model.k || o.y < 0.12) return;
    o.hitVac = true; v.stun(o);
    const l = d || 1; o.vy = X.vacBounce; o.vx = (dx / l) * X.vacThrow; o.vz = (dz / l) * X.vacThrow;
  }

  /** Per fixed tick. */
  tick(dt) {
    for (const o of this.list) {
      if (o.state === 'rest' || o.state === 'gone') continue;
      o.px = o.x; o.py = o.y; o.pz = o.z; o.pq.copy(o.q); o.dirty = true;
      this._cur = o;
      if (o.state === 'unroll') { this._roll(o, dt); continue; }
      if (o.state === 'slide') this._slide(o, dt);
      else if (o.state === 'tip') this._tip(o, dt);
      else this._fall(o, dt);
    }
    this._separate();
  }

  _slide(o, dt) {
    const W = this.world;
    const speed = Math.hypot(o.vx, o.vz);
    if (speed > 1e-4) {
      const s = Math.max(0, speed - K.friction * dt) / speed;
      o.vx *= s; o.vz *= s;
    }
    o.x += o.vx * dt; o.z += o.vz * dt;
    W.resolve(o, o.r, o.y + 0.012, o.y + o.h, this._clip, 3, o.y);
    const g = W.ground(o.x, o.z, K.supportR, o.y + 0.04, this._g);
    if (g.y < o.y - 0.01) { this._startTip(o); return; } // the centre has passed the edge
    o.y = g.y;
    const up = o.startQ && o.bounces === 0 && !o.knocked ? o.startQ : _up.identity();
    if (1 - Math.abs(o.q.dot(up)) > 1e-4) o.q.slerp(up, 0.3); // settle upright after a landing
    if (Math.hypot(o.vx, o.vz) < K.stopSpeed && 1 - Math.abs(o.q.dot(up)) <= 1e-4) { o.vx = o.vz = 0; o.q.copy(up); o.state = 'rest'; }
  }

  _startTip(o) {
    let dx = o.vx, dz = o.vz, l = Math.hypot(dx, dz);
    if (l < 1e-3) { dx = 1; dz = 0; l = 1; }
    dx /= l; dz /= l;
    if (l < K.tipSpeed) { o.vx = dx * K.tipSpeed; o.vz = dz * K.tipSpeed; }
    // tips toward the edge: the rotation axis is up × direction
    o.wx = dz * K.tipRate; o.wy = 0; o.wz = -dx * K.tipRate;
    o.vy = 0; o.state = 'tip'; o.tipT = 0; o.bounces = 0;
  }

  _spin(o, dt) {
    const w = Math.hypot(o.wx, o.wy, o.wz);
    if (w < 1e-3) return;
    _axis.set(o.wx / w, o.wy / w, o.wz / w);
    o.q.premultiply(_dq.setFromAxisAngle(_axis, w * dt));
  }

  _tip(o, dt) {
    o.tipT += dt;
    this._spin(o, dt);
    o.x += o.vx * dt; o.z += o.vz * dt;
    o.vy -= K.gravity * K.tipGravity * dt; o.y += o.vy * dt;
    this._landing(o, dt);
    if (o.state === 'tip' && o.tipT >= K.tipTime) {
      o.wx += (Math.random() - 0.5) * K.spin; o.wy += (Math.random() - 0.5) * K.spin; o.wz += (Math.random() - 0.5) * K.spin;
      o.state = 'fall';
    }
  }

  _fall(o, dt) {
    this._spin(o, dt);
    o.x += o.vx * dt; o.z += o.vz * dt;
    o.vy -= K.gravity * dt; o.y += o.vy * dt;
    this._hitVac(o);
    // landing first: on the tick it passes a surface's top, that surface is under it, not a wall to be pushed out of
    this._landing(o, dt);
    if (o.state === 'fall') this.world.resolve(o, o.r, o.y + 0.012, o.y + o.h, this._clip, 3, o.y);
  }

  /** Coming down onto the floor or any surface below (it lands on a chair or a lower shelf, it doesn't clip through). */
  _landing(o) {
    if (o.vy >= 0) return;
    const g = this.world.ground(o.x, o.z, K.supportR, o.py + 0.012, this._g);
    if (o.y > g.y) return;
    const impact = -o.vy, floor = !g.collider;
    o.y = g.y;
    if (floor && !o.knocked) { this._knockOver(o); if (o.state === 'gone' || o.state === 'unroll') return; }
    if (impact > K.bounceMin && o.bounces < 1) { // one bounce, then it settles
      o.bounces++;
      o.vy = impact * K.bounce * (o.t.landing === 'bounce' ? X.bounceMul : 1);
      o.vx *= K.bounceKeep; o.vz *= K.bounceKeep; o.wx *= 0.5; o.wy *= 0.5; o.wz *= 0.5;
      o.state = 'fall';
      audio.play(o.t.id === 'yarn_ball' ? 'knock.soft' : floor ? 'knock.thud' : 'knock.clink', { pos: o, gain: Math.min(1, impact / 5) });
      return;
    }
    o.vy = 0; o.wx = o.wy = o.wz = 0; o.bounces = 0;
    o.vx *= K.bounceKeep; o.vz *= K.bounceKeep;
    if (o.t.landing === 'roll' && !o.roll) { const l = Math.hypot(o.vx, o.vz) || 1, a = l < 0.01 ? Math.random() * 6.28 : 0; o.vx = l < 0.01 ? Math.cos(a) * X.rollSpeed : (o.vx / l) * X.rollSpeed; o.vz = l < 0.01 ? Math.sin(a) * X.rollSpeed : (o.vz / l) * X.rollSpeed; } // a ball carries on
    o.state = 'slide';
  }

  /** Two objects on the same level push each other apart, and pass some of their speed on. */
  _separate() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (a.state === 'gone' || b.state === 'gone' || (a.state === 'rest' && b.state === 'rest') || Math.abs(a.y - b.y) > 0.05) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
        if (d >= min || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d, push = min - d, ma = a.mass, mb = b.mass, tot = ma + mb;
        a.x -= nx * push * (mb / tot); a.z -= nz * push * (mb / tot);
        b.x += nx * push * (ma / tot); b.z += nz * push * (ma / tot);
        const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (rel <= 0) continue;
        const imp = (rel * (1 + K.objBounce)) / tot;
        a.vx -= imp * mb * nx; a.vz -= imp * mb * nz;
        b.vx += imp * ma * nx; b.vz += imp * ma * nz;
        if (a.state === 'rest') a.state = 'slide';
        if (b.state === 'rest') b.state = 'slide';
      }
    }
  }

  /** Per rendered frame: draw what moved, interpolated between ticks. */
  frame(alpha) {
    for (const o of this.list) {
      if (!o.dirty || o.state === 'gone') continue;
      o.mesh.position.set(o.px + (o.x - o.px) * alpha, o.py + (o.y - o.py) * alpha + o.h / 2, o.pz + (o.z - o.pz) * alpha);
      o.mesh.quaternion.slerpQuaternions(o.pq, o.q, alpha);
      if (o.state === 'rest') { o.px = o.x; o.py = o.y; o.pz = o.z; o.pq.copy(o.q); o.dirty = alpha < 1; }
    }
  }
}
