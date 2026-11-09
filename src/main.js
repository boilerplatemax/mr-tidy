// Entry point: renderer → scene/camera → collision → input → player → audio → UI → the loop.
//
// URL flags: ?dev (overlay on) · ?play (no click needed: headless checks; input runs unlocked)
import * as THREE from 'three';
import { TUNING } from './data/tuning.js';
import { settings, setSetting, applyLookPreset } from './data/settings.js';
import { PS1Renderer } from './render/ps1-renderer.js';
import { PS1 } from './render/ps1-material.js';
import { Environment } from './render/environment.js';
import { CollisionWorld } from './physics/collision.js';
import { Input } from './core/input.js';
import { FixedLoop } from './core/loop.js';
import { Player } from './player/player.js';
import { audio } from './audio/audio.js';
import { subtitles } from './ui/subtitles.js';
import { HudLayer } from './ui/pixel-label.js';
import { Menu } from './ui/menu.js';
import { DevOverlay } from './ui/dev-overlay.js';
import { buildHouse } from './world/house.js';

const params = new URLSearchParams(location.search);
const R = TUNING.render;

// ---------------------------------------------------------------- renderer, scene, camera
const canvas = document.getElementById('game');
const ps1 = new PS1Renderer(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(R.fov, ps1.aspect, R.near, R.far);
scene.add(camera); // (so things parented to the camera, like the paws, render)
ps1.onResize = () => { camera.aspect = ps1.aspect; camera.updateProjectionMatrix(); };
ps1.onResize();
const env = new Environment(scene);
env.apply(TUNING.house.preset);

// ---------------------------------------------------------------- world, player
const world = new CollisionWorld();
const input = new Input(canvas);
const player = new Player(camera, world, input);
const house = buildHouse({ scene, world });
PS1.setLightZones(house.zones);
PS1.setIndoorBoxes(house.indoor);
const S = house.spawn;
player.teleport(S.x, S.y, S.z, S.yaw);

// ---------------------------------------------------------------- audio + captions
audio.world = world;
audio.indoorBoxes = house.indoor;
subtitles.isIndoor = (p) => audio.isIndoor(p);
audio.onCaption = (label, pos) => subtitles.sound(label, pos, audio.listenerPos, player.yaw);
audio.onStart.push(() => house.startSound());

// ---------------------------------------------------------------- UI
const hudLayer = new HudLayer(canvas);
const overlay = new DevOverlay();
const menu = new Menu(() => input.requestLock()); // the click is a user gesture: lock + (first time) start audio
input.on('firstClick', () => audio.start(THREE.Vector3));
input.on('pause', () => { menu.show(input.started); audio.suspend(); });
input.on('resume', () => { menu.hide(); audio.resume(); });
menu.show(false);

if (params.has('play')) { // headless / tests: no click, no pointer lock
  input.allowUnlocked = true; input.started = true;
  input.setPaused(false); menu.hide();
}

// ---------------------------------------------------------------- debug keys
const LOOKS = ['authored', 'clean'];
const DEV_HELP = [
  'Debug keys', 'F1 overlay', 'F9 this list',
  'With the overlay open:', 'L light preset', '1 / 2 / 3 jitter / warp / dither', '4 look: authored <-> clean',
  'URL: ?dev ?play',
].join('\n');
function devKeys() {
  const I = input;
  if (I.pressed('F1') || I.pressed('Backquote')) overlay.toggle();
  if (I.pressed('F9')) overlay.toggleHelp(DEV_HELP);
  if (!I.live || !overlay.visible) return;
  if (I.pressed('KeyL')) { const o = TUNING.lighting.order; const next = o[(o.indexOf(env.preset) + 1) % o.length]; env.apply(next); overlay.note('light: ' + next); }
  for (const [code, key] of [['Digit1', 'jitter'], ['Digit2', 'warp'], ['Digit3', 'dither']]) if (I.pressed(code)) { setSetting(key, !settings[key]); overlay.note(`${key} ${settings[key] ? 'on' : 'off'}`); }
  if (I.pressed('Digit4')) { const next = LOOKS[(LOOKS.indexOf(settings.look) + 1) % LOOKS.length]; applyLookPreset(next); overlay.note('look: ' + next); }
}
overlay.lines = () => [
  `${ps1.stats.calls} draw calls · ${(ps1.stats.triangles / 1000).toFixed(1)}k tris`,
  `${ps1.width}x${ps1.height} x${ps1.scale}${ps1.ss > 1 ? ' (2x ss)' : ''} · look ${settings.look} · light ${env.preset}`,
  `pos ${player.pos.x.toFixed(2)}, ${player.feetY.toFixed(2)}, ${player.pos.z.toFixed(2)} · ${player.gait} on ${player.surface}`,
  `audio ${audio.ready ? audio.voices.size + ' voices' : 'not started (first click)'}`,
];

// ---------------------------------------------------------------- the loop
const titleCam = TUNING.house.titleCamera;
let wallTime = 0;
function tick(dt) {
  player.snapView(); // last tick's view offsets, so the frame can interpolate them (see src/core/loop.js)
  devKeys();
  if (input.live) {
    player.tick(dt);
    house.tick(dt, player.pos);
  }
  input.consumeEdges();
}

function frame(alpha, dt, frameMs) {
  wallTime += dt;
  const onTitle = !menu.el.hidden && !menu.started;
  if (onTitle) { // the title: a slow, still view of the scene
    camera.position.set(titleCam.x + Math.sin(wallTime * 0.31) * titleCam.sway, titleCam.y + Math.sin(wallTime * 0.23) * titleCam.sway * 0.5, titleCam.z);
    camera.rotation.set(titleCam.pitch, titleCam.yaw + Math.sin(wallTime * 0.17) * titleCam.sway * 0.3, 0, 'YXZ');
    camera.updateMatrixWorld();
  } else {
    if (input.live) player.look();
    player.render(alpha);
  }
  env.update(camera);
  audio.update(dt, camera);
  subtitles.update(dt);
  hudLayer.sync();
  ps1.render(scene, camera);
  overlay.frame(frameMs, dt);
  window.__kitReady = true;
}

const loop = new FixedLoop({ tick, frame, live: () => input.live });
loop.start();
document.getElementById('loading').hidden = true;

// ---------------------------------------------------------------- dev / headless handles
window.__kit = { ps1, scene, camera, env, world, input, player, audio, subtitles, menu, overlay, house, settings, loop, tick };
window.__startAudio = () => audio.start(THREE.Vector3); // headless only (normally the first click)
window.__menuFit = () => menu.fitReport();
