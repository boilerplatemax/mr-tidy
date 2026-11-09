// Entry point: wires every kit system together around the demo scene. Start your game here: replace buildDemo() with
// your own world (keep the order: renderer → scene/camera → collision → input → player → interaction → audio → UI).
//
// URL flags: ?dev (overlay on) · ?light=day|dusk|night · ?play (no click needed: headless checks; input runs
// unlocked) · ?glb=path/to/model.glb (drop a model 3 m in front of the spawn, PS1-styled: needs the server).
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
import { Interaction } from './player/interaction.js';
import { audio } from './audio/audio.js';
import { subtitles } from './ui/subtitles.js';
import { HudLayer } from './ui/pixel-label.js';
import { Prompt } from './ui/prompt.js';
import { Menu } from './ui/menu.js';
import { DevOverlay } from './ui/dev-overlay.js';
import { buildDemo } from './demo/demo-scene.js';

const params = new URLSearchParams(location.search);
const R = TUNING.render;

// ---------------------------------------------------------------- renderer, scene, camera
const canvas = document.getElementById('game');
const ps1 = new PS1Renderer(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(R.fov, ps1.aspect, R.near, R.far);
scene.add(camera); // (so things parented to the camera, like a viewmodel, render)
ps1.onResize = () => { camera.aspect = ps1.aspect; camera.updateProjectionMatrix(); };
ps1.onResize();
const env = new Environment(scene);
env.apply(TUNING.lighting[params.get('light')] ? params.get('light') : TUNING.demo.preset);

// ---------------------------------------------------------------- world, player, interaction
const world = new CollisionWorld();
const input = new Input(canvas);
const player = new Player(camera, world, input);
const interaction = new Interaction(camera, world, input);
interaction.ctx = { player, hasKey: false }; // your game's state, passed to every interactable's callbacks
const demo = buildDemo({ scene, world, interaction });
PS1.setLightZones(demo.zones);
PS1.setIndoorBoxes(demo.indoor);
const S = demo.spawn;
player.teleport(S.x, S.y, S.z, S.yaw);

// ---------------------------------------------------------------- audio + captions
audio.world = world;
audio.indoorBoxes = demo.indoor;
subtitles.isIndoor = (p) => audio.isIndoor(p);
audio.onCaption = (label, pos) => subtitles.sound(label, pos, audio.listenerPos, player.yaw);
audio.onStart.push(() => { audio.play('amb.wind'); demo.startSound(); });

// ---------------------------------------------------------------- UI: HUD prompt, menu, dev overlay
const hudLayer = new HudLayer(canvas);
const prompt = new Prompt({ layer: hudLayer, interaction, input });
const overlay = new DevOverlay();
const menu = new Menu(() => input.requestLock()); // the click is a user gesture: lock + (first time) start audio
input.on('firstClick', () => audio.start(THREE.Vector3));
input.on('pause', () => { menu.show(input.started); audio.suspend(); });
input.on('resume', () => { menu.hide(); audio.resume(); });
menu.show(false); // the title screen, over the live scene

if (params.has('play')) { // headless / tests: no click, no pointer lock
  input.allowUnlocked = true; input.started = true;
  input.setPaused(false); menu.hide();
}

// ---------------------------------------------------------------- dev keys
const LOOKS = ['authored', 'clean'];
const DEV_HELP = [
  'Dev keys', '` overlay (fps, frame ms, draw calls, triangles)', 'F1 this list',
  'L light preset (' + TUNING.lighting.order.join(' / ') + ')', '1 / 2 / 3 jitter / warp / dither', '4 look: authored <-> clean',
  'URL: ?dev ?light=night ?play ?glb=model.glb',
].join('\n');
function devKeys() {
  const I = input;
  if (I.pressed('Backquote')) overlay.toggle();
  if (I.pressed('F1')) overlay.toggleHelp(DEV_HELP);
  if (!I.live) return;
  if (I.pressed('KeyL')) { const o = TUNING.lighting.order; const next = o[(o.indexOf(env.preset) + 1) % o.length]; env.apply(next); overlay.note('light: ' + next); }
  for (const [code, key] of [['Digit1', 'jitter'], ['Digit2', 'warp'], ['Digit3', 'dither']]) if (I.pressed(code)) { setSetting(key, !settings[key]); overlay.note(`${key} ${settings[key] ? 'on' : 'off'}`); }
  if (I.pressed('Digit4')) { const next = LOOKS[(LOOKS.indexOf(settings.look) + 1) % LOOKS.length]; applyLookPreset(next); overlay.note('look: ' + next); }
}
overlay.lines = () => [
  `${ps1.stats.calls} draw calls · ${(ps1.stats.triangles / 1000).toFixed(1)}k tris`,
  `${ps1.width}x${ps1.height} x${ps1.scale}${ps1.ss > 1 ? ' (2x ss)' : ''} · look ${settings.look} · light ${env.preset}`,
  `pos ${player.pos.x.toFixed(2)}, ${player.feetY.toFixed(2)}, ${player.pos.z.toFixed(2)} · ${player.gait} on ${player.surface}`,
  `audio ${audio.ready ? audio.voices.size + ' voices' : 'not started (first click)'}${audio.listenerIndoor ? ' · indoors' : ''}`,
];

// ---------------------------------------------------------------- the loop
const titleCam = TUNING.demo.titleCamera;
let simTime = 0, wallTime = 0;
function tick(dt) {
  player.snapView(); // last tick's view offsets, so the frame can interpolate them (see src/core/loop.js)
  devKeys();
  if (input.live) {
    interaction.tick(dt);
    // a hold dips the view a little toward the job (motion feedback), eased per tick and interpolated per frame
    player.viewDip += ((interaction.hold ? TUNING.interact.holdDip : 0) - player.viewDip) * (1 - Math.exp(-10 * dt));
    player.tick(dt);
    demo.tick(dt, player.pos);
    prompt.tick(dt);
    simTime += dt;
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
  prompt.frame(dt);
  ps1.render(scene, camera);
  overlay.frame(frameMs, dt);
  window.__kitReady = true;
}

const loop = new FixedLoop({ tick, frame, live: () => input.live });
loop.start();
document.getElementById('loading').hidden = true;

// ---------------------------------------------------------------- ?glb=: try a model in the PS1 look
if (params.get('glb')) {
  import('./render/geometry.js').then(({ loadGLB }) => loadGLB(params.get('glb'))).then((gltf) => {
    gltf.scene.position.set(S.x, S.y, S.z - 3);
    scene.add(gltf.scene);
    overlay.note('loaded ' + params.get('glb'));
  }).catch((e) => console.error('glb failed:', e));
}

// ---------------------------------------------------------------- dev / headless handles
window.__kit = { ps1, scene, camera, env, world, input, player, interaction, audio, subtitles, prompt, menu, overlay, demo, settings, loop, get simTime() { return simTime; } };
window.__startAudio = () => audio.start(THREE.Vector3); // headless only (normally the first click)
window.__menuFit = () => menu.fitReport(); // does any settings tab scroll or overflow at this window size?
