// Entry point: renderer → scene/camera → collision → input → player → audio → UI → the loop.
//
// URL flags: ?dev (overlay on) · ?play (no click needed: headless checks; input runs unlocked)
import * as THREE from 'three';
import { TUNING } from './data/tuning.js';
import { LEVEL } from './data/level.js';
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
import { Blackout } from './world/blackout.js';
import { Ending } from './world/ending.js';
import { Tutorial } from './world/tutorial.js';
import { Curb } from './world/curb.js';
import { Tail } from './player/tail.js';
import { tvParts } from './world/house.js';

const params = new URLSearchParams(location.search);
const _portraitV = new THREE.Vector3(), _portraitP = new THREE.Vector3();
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
let updateScreens = null, tvTick = null, grandmaDoor = () => null, tv = null;
import('./world/dress.js').then((m) => { house.dressed = m.dressHouse(scene, house.byId); updateScreens = m.updateScreens; tvTick = m.tvTick; grandmaDoor = m.grandmaDoor; tv = m.tv; tv.plug = { pos: new THREE.Vector3(...LEVEL.tvOutlet.pos), pull(inWall) { if (tvParts.plug) tvParts.plug.visible = inWall; if (tvParts.plugged) tvParts.plugged.visible = inWall; if (tvParts.loose) tvParts.loose.visible = !inWall; } }; if (!params.has('play') && !tutorialRun) tv.set('off'); });
PS1.setLightZones(house.zones);
PS1.setIndoorBoxes(house.indoor);
const noise = new Noise();
const debris = new Debris(scene, world);
const knock = new Knockables({ scene, world, byId: house.byId, noise, debris });
player.onStep = (gait) => { if (!player.groundCollider) noise.emit({ kind: 'step', gait, x: player.pos.x, y: player.feetY, z: player.pos.z }); }; // only on the floor: furniture is quiet, and slinking makes no steps at all
player.onSneeze = () => noise.emit({ kind: 'thud', x: player.pos.x, y: player.feetY, z: player.pos.z, radius: TUNING.vac.hearSneeze }); // a sneeze gives you away
player.onLand = (impact, heavy, quiet) => { const L = TUNING.vac; noise.emit({ kind: 'thud', x: player.pos.x, y: player.feetY, z: player.pos.z, radius: L.hearLand[heavy ? 1 : 0] * (quiet ? L.quietLand : 1) }); };
const grandma = new Grandma({ noise, house });
const vac = new Vacuum({ scene, world, camera, noise, knock, debris, player });
knock.vac = vac; // (something dropped on him stuns him)
player.onSwipe = () => { knock.swipe(player, camera); if (!vac.swipeOutlet(camera)) vac.swipeBody(camera); tutorial?.onSwipe(camera); }; // the paw bats objects, and the outlet he's plugged into
const S = house.spawn;
player.teleport(S.x, S.y, S.z, S.yaw);

const blackout = new Blackout({ scene, env, house, knock, vac });
/** Looking at a portrait from nearby, its nameplate shows as a caption (it can't be read at this resolution). */
function portraitWords() {
  const v = camera.getWorldDirection(_portraitV), e = camera.position;
  if (ended || catchSeq.active || !input.live) return;
  for (const p of house.portraits) {
    const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z, d = Math.hypot(dx, dy, dz);
    _portraitP.set(p.x, p.y, p.z - 0.12);
    if (d < TUNING.hud.portraitRange && (dx * v.x + dy * v.y + dz * v.z) / d > TUNING.hud.portraitCos && world.countOccluders(e, _portraitP, 1) === 0) subtitles.show(p.text, 'portrait:' + p.text, 2.2, '', true);
  }
}
const marker = new LandingMarker(camera);
const shimmer = new LandingShimmer(scene);
const paws = new Paws(camera);
const tail = new Tail(camera);

// ---------------------------------------------------------------- audio + captions
audio.world = world;
audio.indoorBoxes = house.indoor;
subtitles.isIndoor = (p) => audio.isIndoor(p);
// Only speech is captioned (a subtitle in quotes), and plainly: no "[the bed creaks, to your left]". Noises speak for
// themselves; his lines, the programme and the portraits put up their own words.
audio.onCaption = (label) => { if (label.startsWith('"')) subtitles.line(null, label, TUNING.subtitles.seconds); };
audio.onStart.push(() => {
  house.startSound(); grandma.startSound(); vac.startSound();
  staticVoice = null;
  startClock();
  staticVoice = audio.play('amb.static', { pos: { x: 5.55, y: 0.5, z: 2.3 }, refDistance: 1.4, rolloff: 1.4 }); // the television, left on
});

/** The clock ticking somewhere, never quite placeable (it stops when it's knocked down, and starts again next run). */
function startClock() { clockVoice?.stop(0.05); clockVoice = audio.play('amb.clock', { pos: { x: 5.9, y: 1.6, z: -4.5 }, refDistance: 3, rolloff: 0.7 }); }

// ---------------------------------------------------------------- UI
const hudLayer = new HudLayer(canvas);
const overlay = new DevOverlay();
const staminaBar = new StaminaBar(hudLayer);
const wakeIcon = TUNING.hud.wakeIcon ? new WakeIcon(hudLayer) : null;
const roomLabel = hudLayer.label('hud-room').place('center', 0, 0.14);
roomLabel.set([{ text: "Grandma's room" }], 'center');
let roomShown = false;
const endScreen = new EndScreen(() => { resetRun(); input.requestLock(); });
/** A whole new run, without a reload. */
function resetRun() {
  if (curb.active) curb.stop();
  tutorial.reset(); tutorial.opened(); if (tv && tutorialRun) tv.set('off');
  audio.stopOneShots(); // (nothing left over from the last run)
  blackout.reset(); ending.reset(); grandma.holdScreen = false;
  ended = false; runTime = 0;
  catchSeq.reset(); endScreen.hide();
  audio.resume(); startClock();
  knock.reset(); debris.reset(); grandma.reset(); vac.reset();
  player.frozen = false; player.noclip = false; player.resetMotion();
  player.teleport(S.x, S.y, S.z, S.yaw); player.pitch = 0;
  debug.thirdPerson = false;
}
let runTime = 0, ended = false, introT = -1, clockVoice = null, staticVoice = null;
const INTRO = [[0.8, "Grandma's asleep. The house is quiet."], [4.3, 'Too quiet. Make some noise.'], [7.8, "Knock things over. Wake Grandma. Don't let Mr. Tidy catch you."]];
const stats = () => { const m = Math.floor(runTime / 60), s = Math.floor(runTime % 60); return [`Time  ${m}:${String(s).padStart(2, '0')}`, `Objects broken  ${knock.count}`, `Times spotted  ${vac.spotted}`]; };
const tvProxy = { get state() { return tv?.state; }, set: (st) => tv?.set(st), pokeRemote: (c) => tv?.pokeRemote(c), pokePlug: (c) => tv?.pokePlug(c) };
var tutorialRun = false; // (the tutorial runs once, on the first run of a session)
const tutorial = new Tutorial({ hud: hudLayer, player, camera, input, vac, tv: tvProxy, world, scene, knock, byId: house.byId });
const curb = new Curb({ scene, camera, vac, env, knock });
const ending = new Ending({ scene, camera, vac, onDone: () => {
  if (knock.bonus >= knock.bonusTotal && knock.bonusTotal > 0) { ending.clearFade(); curb.play(() => endScreen.show('Good Kitty', [...stats(), 'Secret ending: kicked to the kerb'])); } // all of his things: he's out
  else endScreen.show('Good Kitty', stats());
} });
knock.onBonus = (o) => { // one of his things: no help with Grandma, and he knows it was you
  knock.count += TUNING.bonus.anger; vac.bonusBroken(o);
  subtitles.show(`You knocked down ${o.t.bonus} (${knock.bonus} of ${knock.bonusTotal}). Grandma slept through it. He didn't.`, 'bonus' + knock.bonus, 4.5, '', true);
};
ending.instant = params.has('play'); // (the headless checks go straight to the end screen)
grandma.onWin = () => {
  ended = true; player.frozen = true;
  if (ending.instant) { vac.powerDown(); return; }
  grandma.holdScreen = true; player.resetMotion(); ending.start();
};
const catchSeq = new CatchSequence({ camera, vac, onEnd: () => {
  endScreen.show('Mr. Tidy keeps a clean house.', stats(), 'Try again', { small: true, images: [['game-assets/textures/portraits/portrait_09_empty.png', 64], ['game-assets/textures/portraits/nameplate_player_dead.png', 64]] });
} });
ending.vox = catchSeq.vox; // (free space, to put the camera in front of him)
vac.onCatch = (how) => { ended = true; player.resetMotion(); player.frozen = true; catchSeq.start(how); };
grandma.onScreen = () => endScreen.show('Good Kitty', stats());
const menu = new Menu(() => input.requestLock()); // the click is a user gesture: lock + (first time) start audio
input.on('firstClick', () => { audio.start(THREE.Vector3); if (!params.has('play') && !tutorialRun) { tutorialRun = true; tutorial.start(); } else introT = 0; });
input.on('pause', () => { if (ended) return; menu.show(input.started); audio.suspend(); }); // (the end screen takes the mouse back itself)
input.on('resume', () => { menu.hide(); audio.resume(); });
input.on('lockFailed', () => { if (!ended && input.paused) { menu.show(input.started); audio.suspend(); } }); // (the browser said no to the mouse, e.g. a click too soon after letting it go: the menu, so one more click starts it)
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
  if (input.pressed('F10') && !curb.active) { ended = true; player.frozen = true; curb.play(() => endScreen.show('Kicked to the kerb', ['(F10: the secret ending)'], 'Play again')); } // the secret ending, any time
  if (input.pressed('KeyP')) subtitles.show('paws: ' + paws.cycleMode(), 'pawmode', 1.6, '', true); // (the walking-paws experiment)
  if (introT >= 0 && input.live) { const b = introT; introT += dt; for (const [at, line] of INTRO) if (b < at && introT >= at) subtitles.show(line, line, 3.3, 'speech', true); if (introT > 9) introT = -1; } // (the words at the very start)
  if (input.live) {
    tutorial.tick(dt); tvTick?.(dt);
    if (!catchSeq.active && !ending.active) player.tick(dt);
    knock.tick(dt);
    debris.tick(dt);
    if (clockVoice && knock.byId.get('wallClock')?.knocked) { clockVoice.stop(0.05); clockVoice = null; } // (the ticking stops when the clock's on the floor)
    grandma.tick(dt, player.pos.x, player.pos.z);
    vac.tick(dt);
    if (!ended) runTime += dt;
    house.tick(dt, player.pos);
  }
  input.consumeEdges();
}

function frame(alpha, dt, frameMs) {
  wallTime += dt;
  updateScreens?.(wallTime, dt, vac.dark);
  if (staticVoice) staticVoice.fadeTo(tv?.state === 'on' || (tv?.state === 'off' && vac.dark > 0.5) ? 1 : 0, 0.15); // (the hiss is the set being on)
  house.frame(wallTime);
  const onTitle = !menu.el.hidden && !menu.started;
  if (catchSeq.active) { catchSeq.update(dt); paws.hide(); tail.hide(); marker.update(player.aim, dt, player); shimmer.update(player.aim, wallTime, dt); staminaBar.frame(player, dt); }
  else if (catchSeq.phase === 'done') { /* black, the restart screen is up: hold the view */ }
  else if (curb.active) { curb.update(dt); paws.hide(); tail.hide(); }
  else if (ending.active) { ending.update(dt); paws.hide(); tail.hide(); marker.update(player.aim, dt, player); shimmer.update(player.aim, wallTime, dt); staminaBar.frame(player, dt); }
  else if (ending.done) { /* faded out, the Good Kitty screen is up */ }
  else if (onTitle) { // the title: a slow, still view of the scene, and him doing his happy little laps
    vac.titleLap(wallTime, dt);
    camera.position.set(titleCam.x + Math.sin(wallTime * 0.31) * titleCam.sway, titleCam.y + Math.sin(wallTime * 0.23) * titleCam.sway * 0.5, titleCam.z);
    camera.rotation.set(titleCam.pitch, titleCam.yaw + Math.sin(wallTime * 0.17) * titleCam.sway * 0.3, 0, 'YXZ');
    camera.updateMatrixWorld();
  } else {
    if (input.live) player.look();
    player.render(alpha);
    debug.frame();
    marker.update(player.aim, dt, player);
    shimmer.update(player.aim, wallTime, dt);
    tutorial.frame(dt, wallTime);
    tail.frame(player, dt, debug.thirdPerson || tutorial.watching);
    paws.frame(player, dt, input.live ? alpha : 1, debug.thirdPerson || tutorial.watching);
    knock.frame(input.live ? alpha : 1);
    debris.frame(input.live ? alpha : 1);
    staminaBar.frame(player, dt);
  }
  vac.frame(input.live ? alpha : 1, dt);
  blackout.frame(vac.dark, wallTime, camera);
  portraitWords();
  env.update(camera);
  audio.update(dt, camera);
  subtitles.update(dt);
  hudLayer.sync();
  wakeIcon?.set(grandma.stage);
  { const near = !onTitle && player.pos.z > -1.4 && player.pos.z < 0 && grandma.distanceTo(player.pos.x, player.pos.z) < TUNING.grandma.labelNear; if (near !== roomShown) { roomShown = near; roomLabel.show(near); } }
  ps1.render(scene, camera);
  overlay.frame(frameMs, dt);
  window.__kitReady = true;
}

const loop = new FixedLoop({ tick, frame, live: () => input.live });
loop.start();
reveal();

/**
 * The title appears all at once: the black LOADING screen stays up until every model and texture is in and the shaders
 * are compiled (it all used to pop in piece by piece behind the menu), then fades away.
 */
async function reveal() {
  const el = document.getElementById('loading'), M = THREE.DefaultLoadingManager, n = { done: 0, all: 0 };
  const count = (url, done, all) => { n.done = done; n.all = all; };
  M.onStart = count; M.onProgress = count; M.onError = (url) => { n.done++; };
  const until = (f, max = 20000) => new Promise((ok) => { const t0 = performance.now(), c = () => (f() || performance.now() - t0 > max ? ok() : setTimeout(c, 50)); c(); });
  await until(() => house.dressed);
  await Promise.all([house.dressed, knock.ready, ending.ready].map((p) => Promise.resolve(p).catch(() => {})));
  await until(() => vac.ready);
  let calm = 0; await until(() => { calm = n.done >= n.all ? calm + 1 : 0; return calm >= 6; }); // (nothing left loading for a moment: late arrivals start loading off the back of others)
  const R = ps1.renderer; // every shader built now, not as each thing first comes into view
  if (R.extensions.has('KHR_parallel_shader_compile')) await R.compileAsync(scene, camera).catch(() => {}); else R.compile(scene, camera);
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); // a couple of frames drawn underneath
  el.classList.add('gone'); setTimeout(() => { el.hidden = true; }, 700);
  window.__revealed = true;
}

// ---------------------------------------------------------------- dev / headless handles
window.__kit = { ps1, scene, camera, env, world, input, player, audio, subtitles, menu, overlay, house, settings, loop, tick, debug, knock, debris, noise, marker, grandma, endScreen, vac, catchSeq, ending, tutorial, curb, tail, resetRun, get runTime() { return runTime; }, get ended() { return ended; } };
if (params.has('play')) window.__routeBot = () => import('./debug/route-bot.js').then((b) => b.runRouteBot(window.__kit));
window.__startAudio = () => audio.start(THREE.Vector3); // headless only (normally the first click)
window.__menuFit = () => menu.fitReport();
