// Entry point: renderer → scene/camera → collision → input → player → audio → UI → the loop.
//
// URL flags: ?dev (overlay on) · ?play (no click needed: headless checks; input runs unlocked)
import * as THREE from 'three';
import { TUNING } from './data/tuning.js';
import { settings } from './data/settings.js';
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
import { Knockables } from './world/knockables.js';
import { Debris } from './world/debris.js';
import { Noise } from './world/noise.js';
import { Grandma } from './world/grandma.js';
import { Vacuum } from './vacuum/vacuum.js';
import { CatchSequence } from './vacuum/catch.js';
import { WakeIcon } from './ui/wake-icon.js';
import { EndScreen } from './ui/end-screen.js';
import { Debug } from './debug/debug.js';
import { LandingMarker } from './player/landing-marker.js';
import { Paws } from './player/paws.js';
import { LandingShimmer } from './player/landing-shimmer.js';
import { StaminaBar } from './ui/stamina-bar.js';

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
const noise = new Noise();
const debris = new Debris(scene, world);
const knock = new Knockables({ scene, world, byId: house.byId, noise, debris });
player.onStep = (gait) => { if (gait === 'run') noise.emit({ kind: 'step', x: player.pos.x, y: player.feetY, z: player.pos.z }); }; // slink and walk are quiet
player.onLand = (impact, heavy) => { if (heavy) noise.emit({ kind: 'thud', x: player.pos.x, y: player.feetY, z: player.pos.z }); };
const grandma = new Grandma({ noise, house });
const vac = new Vacuum({ scene, world, camera, noise, knock, debris, player });
player.onSwipe = () => { knock.swipe(player, camera); vac.swipeOutlet(camera); }; // the paw bats objects, and the outlet he's plugged into
const S = house.spawn;
player.teleport(S.x, S.y, S.z, S.yaw);

const marker = new LandingMarker(camera);
const shimmer = new LandingShimmer(scene);
const paws = new Paws(camera);

// ---------------------------------------------------------------- audio + captions
audio.world = world;
audio.indoorBoxes = house.indoor;
subtitles.isIndoor = (p) => audio.isIndoor(p);
audio.onCaption = (label, pos) => subtitles.sound(label, pos, audio.listenerPos, player.yaw);
audio.onStart.push(() => { house.startSound(); grandma.startSound(); vac.startSound(); });

// ---------------------------------------------------------------- UI
const hudLayer = new HudLayer(canvas);
const overlay = new DevOverlay();
const staminaBar = new StaminaBar(hudLayer);
const wakeIcon = TUNING.hud.wakeIcon ? new WakeIcon(hudLayer) : null;
const roomLabel = hudLayer.label('hud-room').place('center', 0, 0.14);
roomLabel.set([{ text: "Grandma's room" }], 'center');
let roomShown = false;
const endScreen = new EndScreen();
let runTime = 0, ended = false;
grandma.onWin = () => { ended = true; player.frozen = true; vac.powerDown(); };
const catchSeq = new CatchSequence({ camera, vac, onEnd: () => {
  endScreen.show('Try again', [`Time  ${Math.floor(runTime / 60)}:${String(Math.floor(runTime % 60)).padStart(2, '0')}`, `Objects broken  ${knock.count}`]);
} });
vac.onCatch = (how) => { ended = true; player.resetMotion(); player.frozen = true; catchSeq.start(how); };
grandma.onScreen = () => {
  const m = Math.floor(runTime / 60), s = Math.floor(runTime % 60);
  endScreen.show('Good Kitty', [`Time  ${m}:${String(s).padStart(2, '0')}`, `Objects broken  ${knock.count}`]);
};
const menu = new Menu(() => input.requestLock()); // the click is a user gesture: lock + (first time) start audio
input.on('firstClick', () => audio.start(THREE.Vector3));
input.on('pause', () => { if (ended) return; menu.show(input.started); audio.suspend(); }); // (the end screen takes the mouse back itself)
input.on('resume', () => { menu.hide(); audio.resume(); });
menu.show(false);

if (params.has('play')) { // headless / tests: no click, no pointer lock
  input.allowUnlocked = true; input.started = true;
  input.setPaused(false); menu.hide();
}

// ---------------------------------------------------------------- debug
const debug = new Debug({ input, player, world, scene, camera, overlay, env, ps1, audio, knock, debris, noise, grandma, vac });

// ---------------------------------------------------------------- the loop
const titleCam = TUNING.house.titleCamera;
let wallTime = 0;
function tick(dt) {
  player.snapView(); // last tick's view offsets, so the frame can interpolate them (see src/core/loop.js)
  debug.tick();
  if (input.live) {
    if (!catchSeq.active) player.tick(dt);
    knock.tick(dt);
    debris.tick(dt);
    grandma.tick(dt, player.pos.x, player.pos.z);
    vac.tick(dt);
    if (!ended) runTime += dt;
    house.tick(dt, player.pos);
  }
  input.consumeEdges();
}

function frame(alpha, dt, frameMs) {
  wallTime += dt;
  const onTitle = !menu.el.hidden && !menu.started;
  if (catchSeq.active) catchSeq.update(dt);
  else if (catchSeq.phase === 'done') { /* black, the restart screen is up: hold the view */ }
  else if (onTitle) { // the title: a slow, still view of the scene
    camera.position.set(titleCam.x + Math.sin(wallTime * 0.31) * titleCam.sway, titleCam.y + Math.sin(wallTime * 0.23) * titleCam.sway * 0.5, titleCam.z);
    camera.rotation.set(titleCam.pitch, titleCam.yaw + Math.sin(wallTime * 0.17) * titleCam.sway * 0.3, 0, 'YXZ');
    camera.updateMatrixWorld();
  } else {
    if (input.live) player.look();
    player.render(alpha);
    debug.frame();
    marker.update(player.aim, dt, player);
    shimmer.update(player.aim, wallTime, dt);
    paws.frame(player, dt, input.live ? alpha : 1, debug.thirdPerson);
    knock.frame(input.live ? alpha : 1);
    debris.frame(input.live ? alpha : 1);
    staminaBar.frame(player, dt);
  }
  vac.frame(input.live ? alpha : 1);
  env.update(camera);
  audio.update(dt, camera);
  subtitles.update(dt);
  hudLayer.sync();
  wakeIcon?.set(grandma.stage);
  { const near = !onTitle && grandma.distanceTo(player.pos.x, player.pos.z) < TUNING.grandma.labelNear; if (near !== roomShown) { roomShown = near; roomLabel.show(near); } }
  ps1.render(scene, camera);
  overlay.frame(frameMs, dt);
  window.__kitReady = true;
}

const loop = new FixedLoop({ tick, frame, live: () => input.live });
loop.start();
document.getElementById('loading').hidden = true;

// ---------------------------------------------------------------- dev / headless handles
window.__kit = { ps1, scene, camera, env, world, input, player, audio, subtitles, menu, overlay, house, settings, loop, tick, debug, knock, debris, noise, marker, grandma, endScreen, vac, catchSeq, get runTime() { return runTime; } };
if (params.has('play')) window.__routeBot = () => import('./debug/route-bot.js').then((b) => b.runRouteBot(window.__kit));
window.__startAudio = () => audio.start(THREE.Vector3); // headless only (normally the first click)
window.__menuFit = () => menu.fitReport();
