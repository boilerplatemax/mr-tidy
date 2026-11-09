// The demo: a tiny grey-box yard that shows every kit system working in 30 seconds. Delete this folder when you start
// your own game (main.js imports it in one place). What it shows:
//   • the PS1 look on simple shapes (jitter, dither, nearest pixel textures painted in code), fog at the edge
//   • a small room with a door-sized doorway (0.95 × 2.05 m), a roof, an indoor box (indoor light + reverb + the wind
//     muffled) and a light zone (its bulb never lights the outside of its walls)
//   • a light switch: Hold E (a bar, rising ticks, the view dips) toggles the bulb and its positional hum
//   • a locked cabinet: the greyed reason, and a refused E (a thud + the reason flashes)
//   • footstep surfaces: concrete, gravel, mud (slower), wood (the room, and a platform with a step up)
//   • crates and a barrel: box and cylinder colliders you slide along; a knock now and then, captioned with a direction
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1, uniqueMaterials } from '../render/ps1-material.js';
import { subdivide, canvasTexture, hash, boxUV } from '../render/geometry.js';
import { audio } from '../audio/audio.js';

const D = TUNING.demo;

// ---------------------------------------------------------------- pixel textures painted in code (64 px)
const speckle = (base, spread, seed) => (g, n) => {
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const k = base + (hash(x, y, seed) - 0.5) * spread;
    g.fillStyle = `rgb(${k[0] ?? k},${k[1] ?? k},${k[2] ?? k})`;
    g.fillRect(x, y, 1, 1);
  }
};
const shade = (rgb, f) => `rgb(${Math.round(rgb[0] * f)},${Math.round(rgb[1] * f)},${Math.round(rgb[2] * f)})`;
function noisy(g, n, rgb, amount, seed) {
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = shade(rgb, 1 + (hash(x, y, seed) - 0.5) * amount); g.fillRect(x, y, 1, 1); }
}
const TEX = {
  concrete: () => canvasTexture(64, (g, n) => {
    noisy(g, n, [118, 116, 110], 0.22, 1);
    g.fillStyle = 'rgba(40,38,34,0.5)'; for (let i = 0; i < 40; i++) g.fillRect(Math.floor(hash(i, 3) * n), Math.floor(hash(i, 7) * n), 1, 1 + Math.floor(hash(i, 9) * 3)); // pits and cracks
    g.fillStyle = 'rgba(30,28,26,0.35)'; g.fillRect(0, 0, n, 1); g.fillRect(0, 0, 1, n); // slab joints
  }),
  planks: (rgb = [112, 84, 58]) => canvasTexture(64, (g, n) => {
    for (let x = 0; x < n; x++) { const board = Math.floor(x / 16); for (let y = 0; y < n; y++) { g.fillStyle = shade(rgb, 0.85 + hash(board, 1) * 0.25 + (hash(x, y * 0.25 | 0, 4) - 0.5) * 0.18); g.fillRect(x, y, 1, 1); } }
    g.fillStyle = 'rgba(20,14,10,0.7)'; for (let b = 0; b < 4; b++) g.fillRect(b * 16, 0, 1, n);
    g.fillStyle = 'rgba(20,14,10,0.5)'; for (let b = 0; b < 4; b++) g.fillRect(b * 16 + 7, Math.floor(hash(b, 5) * n), 2, 1); // knots
  }),
  brick: () => canvasTexture(64, (g, n) => {
    g.fillStyle = '#3c3530'; g.fillRect(0, 0, n, n);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 5; col++) {
      const x = col * 16 - (row % 2) * 8, y = row * 8;
      g.fillStyle = shade([96, 58, 46], 0.75 + hash(col, row, 2) * 0.4); g.fillRect(x + 1, y + 1, 15, 7);
    }
  }),
  gravel: () => canvasTexture(64, speckle(118, 90, 6)),
  mud: () => canvasTexture(64, (g, n) => { noisy(g, n, [62, 48, 34], 0.35, 8); g.fillStyle = 'rgba(120,110,90,0.25)'; for (let i = 0; i < 18; i++) g.fillRect(Math.floor(hash(i, 1, 8) * n), Math.floor(hash(i, 2, 8) * n), 3, 1); }),
  crate: () => canvasTexture(64, (g, n) => {
    noisy(g, n, [126, 96, 62], 0.2, 10);
    g.fillStyle = '#4a3622'; g.fillRect(0, 0, n, 6); g.fillRect(0, n - 6, n, 6); g.fillRect(0, 0, 6, n); g.fillRect(n - 6, 0, 6, n);
    for (let i = 0; i < n; i++) g.fillRect(i, i, 4, 1); // the brace
  }),
  metal: () => canvasTexture(64, (g, n) => { noisy(g, n, [70, 78, 74], 0.12, 12); g.fillStyle = 'rgba(110,60,30,0.5)'; for (let i = 0; i < 30; i++) g.fillRect(Math.floor(hash(i, 1, 12) * n), Math.floor(hash(i, 2, 12) * n), 1, 2); g.fillStyle = '#222'; g.fillRect(n / 2 - 1, 0, 2, n); }),
};

const ps1Mat = (map, extra = {}) => makePS1(new THREE.MeshLambertMaterial({ map, ...extra }));

/** A box mesh + its collider. size [x, y, z]; pos = the bottom-centre (pivot at the base, like every placed asset).
 *  opts.tile: metres per texture repeat (box-projected UVs: the same texel density on every face); 0 = the box's own UVs. */
function box(scene, world, mat, pos, size, opts = {}) {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  if (opts.tile !== 0) boxUV(g, opts.tile || 1);
  const m = new THREE.Mesh(opts.subdivide ? subdivide(g, opts.subdivide) : g, mat);
  m.position.set(pos[0], pos[1] + size[1] / 2, pos[2]);
  m.rotation.y = opts.yaw || 0;
  scene.add(m);
  if (opts.collide !== false) m.userData.collider = world.addBox(pos[0], pos[1] + size[1] / 2, pos[2], size[0], size[1], size[2], opts.yaw || 0, { surface: opts.surface || 'wood', occludes: opts.occludes ?? true, tag: opts.tag || '' });
  return m;
}

/** A flat ground patch (a surface region + its decal, 1 cm above the floor so it never z-fights). */
function patch(scene, world, mat, minX, maxX, minZ, maxZ, surface, tile = 1.5) {
  const g = subdivide(boxUV(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ).rotateX(-Math.PI / 2), tile), 1);
  const m = new THREE.Mesh(g, mat);
  m.position.set((minX + maxX) / 2, 0.01, (minZ + maxZ) / 2);
  scene.add(m);
  world.addRegion(minX, maxX, minZ, maxZ, surface);
  return m;
}

export function buildDemo({ scene, world, interaction }) {
  const half = 12; // the yard: 24 × 24 m, walled
  // ---- the floor: subdivided so the warp option never swims on it
  const floor = new THREE.Mesh(subdivide(boxUV(new THREE.PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2), 2)), ps1Mat(TEX.concrete()));
  scene.add(floor);
  world.defaultSurface = 'concrete';

  // ---- the perimeter: a brick wall the fog half-hides (the edge of the world has a physical reason)
  const brick = ps1Mat(TEX.brick());
  for (const [x, z, sx, sz] of [[0, -half - 0.2, half * 2 + 0.8, 0.4], [0, half + 0.2, half * 2 + 0.8, 0.4], [-half - 0.2, 0, 0.4, half * 2], [half + 0.2, 0, 0.4, half * 2]]) {
    box(scene, world, brick, [x, 0, z], [sx, 3.2, sz], { surface: 'concrete', subdivide: 2, tile: 1.6 });
  }

  // ---- the room: x −2.5..2.5, z −4..0, walls 0.2 thick, a doorway in the south wall facing the spawn
  const T = 0.2, H = 2.6, doorW = 0.95, doorH = 2.05;
  const wall = ps1Mat(TEX.planks([92, 88, 80]));
  const wallOpts = { surface: 'wood', subdivide: 0.75, tile: 1.4 };
  box(scene, world, wall, [0, 0, -4], [5 + T, H, T], wallOpts); // north
  box(scene, world, wall, [-2.5, 0, -2], [T, H, 4 + T], wallOpts); // west
  box(scene, world, wall, [2.5, 0, -2], [T, H, 4 + T], wallOpts); // east
  const sideW = 2.5 + T / 2 - doorW / 2;
  box(scene, world, wall, [-(doorW / 2 + sideW / 2), 0, 0], [sideW, H, T], wallOpts); // south, left of the door
  box(scene, world, wall, [doorW / 2 + sideW / 2, 0, 0], [sideW, H, T], wallOpts); // south, right of the door
  box(scene, world, wall, [0, doorH, 0], [doorW, H - doorH, T], wallOpts); // the lintel
  box(scene, world, ps1Mat(TEX.planks([70, 62, 54])), [0, H, -2], [5 + T * 2, T, 4 + T * 2], { surface: 'wood', tile: 1.4 }); // roof
  patch(scene, world, ps1Mat(TEX.planks()), -2.4, 2.4, -3.9, -0.1, 'wood', 1.2); // the wooden floor
  world.addRegion(-doorW / 2, doorW / 2, -0.1, 0.1, 'wood'); // the threshold
  const roomBox = new THREE.Box3(new THREE.Vector3(-2.5, 0, -4), new THREE.Vector3(2.5, H + T / 2, 0));

  // ---- the bulb: a cord, a glass bulb, a point light zoned to the room
  const bulbMat = makePS1(new THREE.MeshBasicMaterial({ color: 0xfff0c8 }));
  const bulbOff = new THREE.Color(0x3a3630), bulbOn = new THREE.Color(0xfff0c8);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bulbMat);
  bulb.position.set(0, H - 0.42, -2);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.36, 4), makePS1(new THREE.MeshLambertMaterial({ color: 0x111111 })));
  cord.position.set(0, H - 0.2, -2);
  scene.add(bulb, cord);
  const L = D.lamp;
  const light = new THREE.PointLight(L.color, L.intensity, L.distance, L.decay);
  light.position.copy(bulb.position);
  scene.add(light);
  let hum = null;
  const state = { lampOn: true };
  const setLamp = (on) => {
    state.lampOn = on;
    light.visible = on; bulbMat.color.copy(on ? bulbOn : bulbOff);
    if (on && !hum) hum = audio.play('lamp.hum', { pos: bulb.position, fadeIn: 0.3 });
    if (!on && hum) { hum.stop(0.1); hum = null; }
  };

  // ---- the switch, on the outside wall right of the doorway: Hold E toggles the bulb
  const plate = new THREE.Group();
  const plateMat = ps1Mat(null, { color: 0xc8c0a8 }), nubMat = ps1Mat(null, { color: 0x3a2a20 });
  const pm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.02), plateMat);
  const nub = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.025), nubMat);
  nub.position.z = 0.02;
  plate.add(pm, nub);
  plate.position.set(0.85, 1.3, T / 2 + 0.01);
  scene.add(plate);
  uniqueMaterials(plate); // its own material copies, so only it highlights
  const setNub = () => { nub.position.y = state.lampOn ? 0.012 : -0.012; };
  setNub();
  interaction.add({
    object: plate, kind: 'hold', hold: D.switchHold,
    label: () => (state.lampOn ? 'Turn off the light' : 'Turn on the light'),
    onUse: () => { setLamp(!state.lampOn); setNub(); audio.play('switch.click', { pos: plate.position }); },
  });

  // ---- a locked cabinet inside: the greyed reason and the refused E
  const cabinet = box(scene, world, ps1Mat(TEX.metal()), [1.55, 0, -3.62], [0.8, 1.3, 0.42], { surface: 'wood', tag: 'cabinet', occludes: false, tile: 0 });
  uniqueMaterials(cabinet);
  interaction.add({
    object: cabinet, tag: 'cabinet', kind: 'tap', label: 'Open',
    canUse: (ctx) => !!ctx.hasKey, why: () => 'Locked. Needs a key',
    onUse: () => audio.play('switch.click', { pos: cabinet.position }),
  });

  // ---- props: crates (boxes, one rotated, one stacked) and a barrel (a cylinder collider)
  const crate = ps1Mat(TEX.crate()); // (crates keep their own per-face UVs: tile 0)
  box(scene, world, crate, [-4, 0, 3], [0.8, 0.8, 0.8], { occludes: false, tile: 0 });
  box(scene, world, crate, [-4.9, 0, 2.2], [0.8, 0.8, 0.8], { occludes: false, yaw: 0.3, tile: 0 });
  box(scene, world, crate, [-4.02, 0.8, 3.02], [0.66, 0.66, 0.66], { occludes: false, yaw: -0.2, tile: 0 }); // stacked: fully on the crate below
  box(scene, world, crate, [4.4, 0, 3.8], [0.7, 0.7, 0.7], { occludes: false, yaw: 0.6, tile: 0 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), ps1Mat(TEX.metal()));
  barrel.position.set(3.4, 0.45, 1.2);
  scene.add(barrel);
  world.addCylinder(3.4, 1.2, 0.3, 0, 0.9, { surface: 'wood' });

  // ---- a wooden platform you step onto (0.3 m), with a second step (0.6 m)
  const deck = ps1Mat(TEX.planks());
  box(scene, world, deck, [6, 0, -3], [3, 0.3, 3], { surface: 'wood', occludes: false, tile: 1.2 });
  box(scene, world, deck, [6.7, 0, -3.7], [1.4, 0.6, 1.4], { surface: 'wood', occludes: false, tile: 1.2 });

  // ---- ground patches: gravel (left of the spawn) and mud (right: slower, louder)
  patch(scene, world, ps1Mat(TEX.gravel()), -6.5, -2, 3, 10, 'gravel', 1);
  patch(scene, world, ps1Mat(TEX.mud()), 2.2, 5.5, 5.5, 9, 'mud', 1.2);

  // ---- a knock now and then, somewhere in the fog (positional, occluded by walls, captioned with a direction)
  let knockT = D.knockGap[0] * 0.5;
  const knockPos = new THREE.Vector3();

  return {
    zones: [roomBox], // the bulb lights only this zone
    indoor: [roomBox], // indoor lighting, reverb and the muffled bed
    spawn: D.spawn,
    state, setLamp,
    /** Once audio exists (the first click). */
    startSound() { if (state.lampOn && !hum) hum = audio.play('lamp.hum', { pos: bulb.position, fadeIn: 1.5 }); },
    /** Per fixed tick. listener: { x, z } (the player's feet). */
    tick(dt, listener) {
      knockT -= dt;
      if (knockT <= 0) {
        knockT = D.knockGap[0] + Math.random() * (D.knockGap[1] - D.knockGap[0]);
        const a = Math.random() * Math.PI * 2, r = 7 + Math.random() * 3;
        knockPos.set(Math.max(-11, Math.min(11, listener.x + Math.cos(a) * r)), 1.2, Math.max(-11, Math.min(11, listener.z + Math.sin(a) * r)));
        audio.play('demo.knock', { pos: knockPos });
      }
    },
  };
}
