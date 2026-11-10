// Mr. Tidy. He patrols his loop round the house on the waypoint graph, on the end of his cord; he goes to noises he can
// hear, and cleans the messes he finds. Cleaning is cosmetic: the noise already reached Grandma.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { buildVacuum } from './vacuum-model.js';
import { Nav } from './nav.js';
import { Cord } from './cord.js';
import { Hose } from './hose.js';
import { Voxels } from './voxels.js';
import { Blast } from './blast.js';
import { DustCloud } from './dust-cloud.js';
import { audio } from '../audio/audio.js';
import { subtitles } from '../ui/subtitles.js';
import { LINES } from './voice.js';

const UN = TUNING.uncanny, LK = TUNING.lurk, PK = TUNING.peek, BU = TUNING.burst, AM = TUNING.ambush;
const V = TUNING.vac, D = TUNING.drone, C = TUNING.cord, H = TUNING.hose, B = TUNING.blast, SU = TUNING.suck, A = TUNING.alert, RO = TUNING.roam, ST = TUNING.sting, CR = TUNING.creep, F = TUNING.fog, SG = TUNING.surge, FR = TUNING.friend, LU = TUNING.lunge;
const between = ([a, b]) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _s = new THREE.Vector3();

export class Vacuum {
  constructor({ scene, world, camera, noise, knock, debris, player }) {
    this.world = world; this.knock = knock; this.debris = debris; this.camera = camera; this.player = player;
    this.vox = new Voxels(world); this.hose = new Hose(scene, this.vox); this.blast = new Blast(scene, this.vox, knock); this.blast.onHit = (dx, dz) => player.dustHit(dx, dz); this.blasts = [this.blast, ...Array.from({ length: 4 }, () => { const b = new Blast(scene, this.vox, knock); b.onHit = this.blast.onHit; return b; })]; this.spotted = 0; this.volley = 0; this.volleyT = 0; this.sprayT = 0; this.coughI = 0; this.dark = 0; this.surgeT = 0; this.arcV = null; this.sweepBase = 0; this.sweepPh = 0; this.cloud = new DustCloud(scene); this.lob = false; this._v = new THREE.Vector3();
    this.fogPhase = null; this.fogT = 0; this.fogCd = 0; this.creepT = 0; this.creepCd = 0; this.creepV = null; this.alertT = 0; this.alertX = 0; this.alertZ = 0; this.alertCd = 0; this.heardCd = 0; this.stingCd = 0; this.shriekCd = 0; this.freezeT = 0; this.dip = 0; this.thinkT = between(RO.think); this.pauseT = 0; this.pauseYaw = 0; this.pauseThen = null; this.time = 0; this.seenAt = new Map(); this.noises = []; this.lastStop = null; this.blastPhase = null; this.blastT = 0; this.blastCd = 0; this.suckT = 0; this.suckPhase = 0; this.suckY = 0; this.suckV = null; this.coughV = null; this._blastDir = new THREE.Vector3(); this._blastO = new THREE.Vector3(); this.cleanWait = 0; this._cmd = { mode: 'approach', goal: new THREE.Vector3(), speed: 0, turn: 0, hover: false }; this.reachPhase = null; this.reachT = 0; this.reachCd = 0; this.rattle = null; this._snap = new THREE.Vector3(); this._goal = new THREE.Vector3(); this.directX = 0; this.directZ = 0;
    this.greetCd = 0; this.chatCd = 0; this.lungeCd = 0; this.lungePhase = null; this.greetT = 0; this.lungeT = 0;
    this.heat = 0; this.calms = 0; this.calmT = 0; // knock-overs since he last calmed down; how many times he has; how long he's been calming
    this.rushed = false; this.rush = false; this.searchLeft = 0; this.pokeCd = 0; this.shhCd = 0; this.searchSayCd = 0; this.turnFaced = true; this.arcFade = 0;
    this.lurkCd = LK.first; this.lurkPhase = null; this.lurkT = 0; this.lookT = 0;
    this.streak = []; this.burstT = 0; this.burstCd = 0; this.lostFor = 0; this.peekT = 0; this.peekCd = 0; this.peekSide = 1; this.ambush = false; this.ambushCd = AM.first;
    this.crumbs = []; this.crumbT = 0; this.uncannyCd = between(UN.every);
    this.crumbs = []; this.crumbT = 0; this.uncannyCd = between(UN.every);
    this.onTurn = null; this.onSurge = null; // the cut-ins: "...that's enough." and the power surge (src/vacuum/closeup.js)
    this.onCatch = null; this.caught = false; // onCatch(how): 'body' or 'hose'
    this._dirv = { x: 0, y: 0, z: 0 }; this._under = null; this._notUnder = (c) => c.solid && c !== this._under; this.campT = 0; this.ignoreT = 0;
    this.seeT = 0; this.stunT = 0; this.stunCd = 0; this.foundT = 0; this.seesCat = false; this.lastX = 0; this.lastZ = 0; this.loseT = 0; this.replanT = 0; this.direct = false; this.directOK = false; this.chaseNode = null; this.sweep = false; this.sweepT = 0;
    noise.on((ev) => this._hear(ev));
    this.pending = null; this.mess = null; this.cleanT = 0; this.spotT = 0; this.slurp = null; this._h = { x: 0, y: 0, z: 0 }; this._a = { x: 0, y: 0, z: 0 }; this._b = { x: 0, y: 0, z: 0 };
    this.model = buildVacuum();
    scene.add(this.model.root);
    this.nav = new Nav();
    const start = this.nav.nodes.get(LEVEL.vacStart);
    this.x = this.px = start.x; this.z = this.pz = start.z;
    this.heading = this.prevHeading = 0; // the way the hole faces: rotation about y, 0 = +z
    this.state = 'PATROL';
    this.anger = 1;
    this.frozen = false; // F8
    this.voice = null; this.droneT = 0;
    this.off = false; // Grandma pulled the plug (for now: she woke)
    this.route = [...new Set(LEVEL.patrol)].map((id) => this.nav.nodes.get(id)); // the places he might go next
    this.routeI = 0;
    this.path = [start]; // the node list he's following right now (the debug overlay draws it)
    this.pathI = 0;
    this.cord = new Cord(scene);
    // The tether: the waypoints the cord is lying along, from the outlet end to the last one he reached.
    this.root = this.nav.nodes.get(this.cord.outlet.node);
    this.tether = this.nav.path(this.root, start);
    this.plugState = 'in'; this.plugT = 0; this.plugLock = 0; // 'in' | 'retract' | 'dead' | 'extend'
    this.spin = 0; this.lastPaid = this._paid();
    this.model.root.position.set(this.x, 0, this.z);
    this.model.root.updateMatrixWorld(true);
  }

  get ready() { return this.model.ready; }

  /** Back to the start, for a new run. */
  /** outlet: the one he starts plugged into, by its index in LEVEL.outlets (he starts at its waypoint); omitted: the first. */
  reset(outlet = null) {
    const o = LEVEL.outlets[outlet ?? 0], start = outlet == null ? this.nav.nodes.get(LEVEL.vacStart) : this.nav.nodes.get(o.node);
    this.hush(0.05);
    this.voice?.stop(0.05); this.voice = null; // (a fresh motor every run: whatever the last one was doing, it's gone)
    this.x = this.px = start.x; this.z = this.pz = start.z; this.heading = this.prevHeading = 0;
    this.state = 'PATROL'; this.off = false; this.caught = false; this.frozen = false; this.pending = null; this.mess = null;
    this.campT = 0; this.ignoreT = 0;
    this.reachCd = 0; this.seeT = 0; this.seesCat = false; this.loseT = 0; this.direct = false; this.chaseNode = null; this.sweep = false; this.cleanT = 0;
    this.plugState = 'in'; this.plugT = 0; this.plugLock = 0;
    this.cord.setOutlet(o); this.cord.setTrim(0);
    this.root = this.nav.nodes.get(o.node);
    this.tether = this.nav.path(this.root, start);
    this.routeI = 0; this.path = [start]; this.pathI = 0;
    this.spin = 0; this.lastPaid = this._paid();
    this.hose.reset(); this.blast.reset(); this._endBlast(); this._endSuck(); this._endCreep(); this._endFog(); this.cloud.reset(); this.blastCd = 0;
    this.sayCd = 0; this.huffCd = 0; this.stalk = false; this.huffMess = null; this.model.dead = false; this.model.maw = false; this.model.calm = false; this.spotted = 0; this.dark = 0; this.arcV?.stop(0.05); this.arcV = null; this.surgeT = 0; this.volley = 0; for (const b of this.blasts) b.reset(); this.stunT = 0; this.stunCd = 0; this.foundT = 0; this.fogCd = 0; this.creepCd = 0; this.greetCd = 0; this.chatCd = 0; this.lungeCd = 0; this.lungePhase = null; this.alertCd = 0; this.heardCd = 0; this.stingCd = 0; this.shriekCd = 0; this.freezeT = 0; this.dip = 0; this.thinkT = between(RO.think); this.pauseThen = null; this.seenAt.clear(); this.noises.length = 0; this.lastStop = null; this.model.shriekT = 0; this.model.flick = 0;
    this.lurkCd = LK.first; this.lurkPhase = null; this.lurkT = 0; this.lookT = 0;
    this.heat = 0; this.calms = 0; this.calmT = 0; this.rushed = false; this.rush = false; this.searchLeft = 0; this.pokeCd = 0; this.shhCd = 0; this.searchSayCd = 0; this.turnFaced = true; this.arcFade = 0;
    this.model.face.visible = true; this.tremble = 0;
    this.anger = 1; this.setAnger(1); this.model.setFace(1); // (quietly: no "all tidy" tune at the start of a run)
    this.sayCd = TUNING.voice.quietStart; this.greetCd = TUNING.voice.quietStart + 1; // a moment's peace before he says anything
    this.streak = []; this.burstT = 0; this.burstCd = 0; this.lostFor = 0; this.peekT = 0; this.peekCd = 0; this.peekSide = 1; this.ambush = false; this.ambushCd = AM.first;
    this.startSound();
  }

  /** Cheerful (stage 1: the first few knock-overs, and again whenever he has calmed down): pleased to see you, and chats if you bat him. */
  get friendly() { return this.anger === 1 && !this.off && this.plugState === 'in' && !this.dormant; }

  /** He stops, turns to you, and says something nice (group: 'hi' when he spots you, 'chat' when you bat him). */
  _greet(group) {
    if (this.state === 'CLEAN') { this.slurp?.stop(0.1); this.slurp = null; this.mess = null; }
    if (this.direct) this._rejoin();
    this.state = 'GREET'; this.greetT = FR.greetTime; this.greetCd = FR.greetEvery;
    this._say(group, true); this.model.giggle(group === 'chat' ? 0.7 : 0.35);
  }

  _tickGreet(dt) {
    const P = this.player, want = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), diff = wrap(want - this.heading), turn = V.turnRate * dt;
    this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, diff)));
    this.greetT -= dt;
    if (this.greetT <= 0) this._resumePatrol();
  }

  /**
   * The paw hit him? While nothing's broken he chats back; after that he's only put out (a huff), or takes no notice.
   * Returns true if it hit him.
   */
  swipeBody(camera) {
    if (this.dormant || this.hidden || this.off || this.caught || this.plugState !== 'in') return false;
    const S = TUNING.swipe, eye = camera.position, y = Math.min(eye.y, this.model.faceCenterY());
    const dx = this.x - eye.x, dy = y - eye.y, dz = this.z - eye.z, d = Math.hypot(dx, dy, dz);
    if (d > S.reach + V.radius || d < 1e-3) return false;
    camera.getWorldDirection(_s);
    if ((dx * _s.x + dy * _s.y + dz * _s.z) / d < S.cone * 0.75) return false;
    audio.play('knock.soft', { pos: { x: this.x, y, z: this.z }, gain: 1.8, rate: 0.7 });
    this.model.giggle(0.5);
    if (this.friendly) { if (this.chatCd <= 0) { this.chatCd = FR.chatEvery; this._greet('chat'); } return true; }
    if (this.anger <= 2 && this.state !== 'CHASE' && !this._attacking() && this.huffCd <= 0) { this.huffCd = TUNING.voice.huffEvery; audio.play('vac.huff', { follow: this.model.hoseSocket, refDistance: 3, rolloff: 0.8 }); this.model.cough(); }
    if (this.pokeCd <= 0) { this.pokeCd = TUNING.voice.pokeEvery; this._say(this.anger <= 2 ? 'poke2' : 'poke3', true); } // and he tells you what he thinks of it
    return true;
  }

  /** Anger level 1–3: his face, his speed, the pitch of his motor. */
  /** dramatic: the change happens in front of you (a knock-over did it), so he makes a show of it. */
  setAnger(level, dramatic = false) {
    const was = this.anger;
    this.anger = Math.max(1, Math.min(5, level));
    this.model.setFace(this.anger);
    if (this.anger < was && this.anger === 1 && !this.dormant) { this._say('calm', true); this.model.giggle(0.5); audio.play('vac.calm', { follow: this.model.hoseSocket, refDistance: 6, rolloff: 0.25 }); } // and his little tune // calmed down: all smiles again
    if (this.anger > was) {
      if (this.anger === 4) { this._shriek(true); if (dramatic) this._say('turn4', true); }
      if (this.anger === 5) { this._startSurge(); if (dramatic) this._say('turn5', true); }
      if (this.anger === 3 && was < 3 && dramatic && !this.off && this.plugState === 'in') this._startTurn();
    }
  }

  /** The knock-overs (since he last calmed down) at which he reaches stages 2–5: fewer each time he has calmed down. */
  _angerAt() {
    let last = 0;
    return V.angerAt.map((a) => (last = Math.max(last + 1, Math.round(a * V.calmEase ** this.calms))));
  }

  _stageFor(heat) { const A = this._angerAt(); return heat >= A[3] ? 5 : heat >= A[2] ? 4 : heat >= A[1] ? 3 : heat >= A[0] ? 2 : 1; }

  /**
   * Left alone long enough with every mess cleared up, he calms down and is cheerful again (never once the power's gone).
   * Each time it's quicker to set him off and longer before he calms down again.
   */
  _tickCalm(dt) {
    if (!V.calmFrom.includes(this.anger) || this.off || this.plugState !== 'in' || this.caught) { this.calmT = 0; return; }
    if (this.state === 'CHASE' || this.state === 'TURN' || this._attacking() || this.seesCat) { this.calmT = 0; return; }
    if (this.debris.messes.some((m) => !m.cleaned)) return; // (a mess still lying about: he can't settle)
    this.calmT += dt;
    if (this.calmT < V.calmTime * V.calmLonger ** this.calms) return;
    this.heat = 0; this.calms++; this.calmT = 0; this.stalk = false; this.searchLeft = 0; this.sweep = false;
    if (this.state === 'CLEAN') { this.slurp?.stop(0.1); this.slurp = null; this.mess = null; }
    this.setAnger(1);
    this._resumePatrol();
  }

  /** A line from his repertoire, if he hasn't just spoken. Heard, and captioned, only near him. */
  _say(group, force = false, quiet = false, everywhere = false) {
    const VO = TUNING.voice, set = LINES[group];
    if (!set || this.dormant || this.off || (!force && this.sayCd > 0)) return;
    this.sayCd = VO.every;
    let i = Math.floor(Math.random() * set[1].length); if (set[1].length > 1 && i === this.lastLine?.[group]) i = (i + 1) % set[1].length;
    (this.lastLine ??= {})[group] = i;
    audio.play(`vac.say.${group}.${i}`, { follow: this.model.hoseSocket, refDistance: everywhere ? 8 : 3, rolloff: everywhere ? 0.2 : 0.7 });
    const L = audio.listenerPos; if (everywhere || Math.hypot(this.x - L.x, this.z - L.z) < VO.hear) if (!quiet) subtitles.line(null, set[1][i], 3); // (no name: it's obviously him)
  }

  /** You broke one of his things: he's coming, whatever his mood, and he's angrier for it. */
  bonusBroken(o) {
    if (this.dormant || this.off) return;
    this._say('mine', true, true); // (the caption for this one is the game's own, in one line)
    if (this.state !== 'CHASE' && !this._attacking()) { this.state = 'INVESTIGATE'; this.stalk = false; this.routeTo(this.nav.nearest(o.x, o.z)); }
  }

  /** Stage 3 arrives: he stops dead, the lights stutter, his face goes, and he says so. */
  _startTurn() {
    if (this.direct) this._rejoin();
    this._endReach(); this._endBlast(); this._endSuck(); this._endCreep();
    if (this.state === 'CLEAN') { this.slurp?.stop(0.1); this.slurp = null; this.mess = null; }
    this.state = 'TURN'; this.turnT = 0; this.turnFaced = false;
    this.model.setFace(2); // (still annoyed, for a moment, on camera: then it goes)
    if (this.voice) { this.voice.setRate(D.rate[1] * 0.6, 0.5); } // the motor groans down, and comes back angry
    this.onTurn?.();
  }

  _tickTurn(dt) {
    this.turnT += dt;
    if (!this.turnFaced && this.turnT >= TUNING.voice.turnFace) { this.turnFaced = true; this.model.setFace(this.anger); this.stingCd = 0; this._sting(); this._say('turn3', true); }
    if (this.turnT >= TUNING.voice.turn) { this.dark = this.anger >= 5 ? 1 : 0; this._say('warn', true); this._resumePatrol(); } // and a word about Grandma on his way
  }

  /** Harmless but put out: a huff through the nose and an angry shake of the hose, then he gets on with it. */
  _startHuff(m) {
    this.state = 'HUFF'; this.huffT = 0; this.huffMess = m; this.huffCd = TUNING.voice.huffEvery;
    audio.play('vac.huff', { follow: this.model.hoseSocket, refDistance: 3, rolloff: 0.8 }); this.model.cough();
  }

  _tickHuff(dt) {
    this.huffT += dt;
    if (this.huffT < TUNING.voice.huff) return;
    const m = this.huffMess; this.huffMess = null;
    if (m && !m.cleaned) this._startClean(m, true); else this._resumePatrol();
  }

  /** The scream. Heard all over the house. */
  _shriek(force = false) {
    if (!force && this.shriekCd > 0) return;
    this.shriekCd = ST.shriekEvery;
    this.model.shriek(ST.shriekFace);
    audio.play('vac.shriek', { follow: this.model.hoseSocket, refDistance: 4, rolloff: 0.35 });
  }

  /** Stage 5: he stops and drags the power out of the house. The lights stutter, and go. */
  _startSurge() {
    if (this.direct) this._rejoin();
    this._endReach(); this._endBlast(); this._endSuck(); this._endCreep(); this._endFog();
    this.surgeReturn = this.state === 'CHASE' || this._attacking() ? 'CHASE' : 'PATROL';
    this.state = 'SURGE'; this.surgeT = 0;
    this._shriek(true);
    audio.play('vac.surgeBuzz');
    this.onSurge?.();
  }

  _tickSurge(dt) {
    const was = this.surgeT;
    this.surgeT += dt;
    { const u = Math.min(1, this.surgeT / SG.flickerUntil); this.dark = u * u * (3 - 2 * u); } // the lights sink, all the way down
    if (was < SG.flickerUntil && this.surgeT >= SG.flickerUntil) { audio.play('power.out'); this.arcV = audio.play('vac.arc', { follow: this.model.hoseSocket, refDistance: 1.2, rolloff: 1.1 }); }
    if (this.surgeT >= SG.time) { this.arcFade = SG.arcAfter; this.arcV?.stop(SG.arcAfter); this.arcV = null; this.state = this.surgeReturn; this.loseT = 0; if (this.state === 'CHASE') { this.lastX = this.player.pos.x; this.lastZ = this.player.pos.z; } }
  }

  /** The stinger when he spots you. */
  _sting() {
    if (this.stingCd > 0) return;
    this.stingCd = ST.cooldown;
    audio.play('sting.spot');
  }

  /** Volume for a distance: steep near him, and never quite silent. */
  droneLevel(d) { return D.floor + (1 - D.floor) / (1 + (d / D.closeness) ** 2); }

  /** Once audio exists (the first click). */
  /** Not here yet (the tutorial): no body, no sound, nothing. */
  sleep() { this.dormant = true; this.setHidden(true); this.voice?.stop(0.05); this.voice = null; }

  /** He turns up, at the far end of the hallway by her door, and says hello. */
  arrive() {
    if (!this.dormant) return;
    this.dormant = false; this.setHidden(false);
    const n = this.nav.nodes.get(LEVEL.outlets[0].node);
    this.x = this.px = n.x; this.z = this.pz = n.z; this.heading = this.prevHeading = -Math.PI / 2;
    this.tether = [this.root]; this.path = [n]; this.pathI = 0; this._resumePatrol(); this.lastPaid = this._paid();
    this.hose.reset();
    audio.play('vac.power', { pos: { x: n.x, y: 0.3, z: n.z } });
    this.startSound(); this._say('hello', true);
  }

  setHidden(on) { this.model.root.visible = !on; this.hose.mesh.visible = !on; this.hose.nozzle.visible = !on; this.cord.mesh.visible = !on; this.cord.plug.visible = !on; this.hidden = on; }

  /** The title screen: a happy little lap of the living room, with no cord and no sound. */
  titleLap(time, dt) {
    if (this.dormant) return; // (the run has started and he isn't here yet)
    const a = time * 0.55, cx = 1.95, cz = 2.55, r = 0.5;
    this.x = this.px = cx + Math.cos(a) * r; this.z = this.pz = cz + Math.sin(a) * r; this.heading = this.prevHeading = Math.atan2(-Math.sin(a), Math.cos(a));
    if (this.model.stage !== 1) this.setAnger(1);
    this.cord.mesh.visible = false; this.cord.plug.visible = false; this.model.root.visible = true; this.hose.mesh.visible = this.hose.nozzle.visible = false; // (no hose trailing across the title)
    this.hose.tick(dt, this._hole(), this.heading, null);
  }

  startSound() {
    if (this.off || this.voice || this.dormant) return;
    // no distance rolloff in the panner (rolloff: 0): droneLevel is the whole volume curve, the panner gives the direction
    this.voice = audio.play('vac.drone', { follow: this.model.hoseSocket, rolloff: 0, fadeIn: 0.5, gain: D.gain, wet: 0.5 });
  }

  /** The motor at the end of a catch: flat out and rising. */
  scream() {
    if (!this.voice) return;
    const K = TUNING.catch;
    this.voice.setRate(K.screamRate, K.screamRamp);
    this.voice.fadeTo(K.screamGain, K.screamRamp * 0.5);
  }

  /** Cut the sound dead (the hard cut to black). */
  silence() { this.voice?.stop(0.01); this.voice = null; }

  _updateDrone(dt) {
    // the motor falls away when he stops to listen, and nearly dies while the hose creeps
    const dipTo = this.stunT > 0 ? 0.85 : this.stalk && (this.state === 'INVESTIGATE' || this.state === 'SEARCH') ? TUNING.stalk.dip : this.state === 'ALERT' ? A.dip : this.state === 'CREEP' ? 1 - CR.motor : this.state === 'PAUSE' ? A.dip * 0.45 : this.state === 'LURK' && this.lurkPhase === 'watch' ? LK.dip : 0;
    this.dip += (dipTo - this.dip) * (1 - Math.exp(-A.dipEase * dt));
    if (!this.voice || this.off || this.caught || this.plugState !== 'in') return;
    this.droneT -= dt;
    if (this.droneT > 0) return;
    this.droneT = D.update;
    const L = audio.listenerPos, d = Math.hypot(this.x - L.x, 0.2 - L.y, this.z - L.z), near = 1 / (1 + (d / D.closeness) ** 2);
    const hunting = this.state === 'CHASE' || this._attacking();
    this.voice.fadeTo(this.droneLevel(d) * (1 - this.dip) * D.stageLevel[this.anger - 1] * (hunting ? D.hunting : 1), D.update);
    this.voice.setRate((D.rate[this.anger - 1] + D.nearRate * near) * (1 - A.rateDip * (this.dip / A.dip)), D.update * 2);
  }

  /**
   * Every sound of his except the motor: the slurp (it loops, and would go on for ever if he was cleaning when he was
   * stopped), the creep, the arcing, and anything else still riding on his hose or nozzle.
   */
  hush(fade = 0.15) {
    this.slurp?.stop(fade); this.slurp = null; this.mess = null;
    this.arcV?.stop(fade); this.arcV = null;
    this._endReach(); this._endBlast(); this._endSuck(); this._endCreep(); this._endFog();
    const mine = [this.model.hoseSocket, this.hose.nozzle];
    for (const v of [...audio.voices]) if (v !== this.voice && mine.includes(v.follow)) v.stop(fade);
  }

  /** Everything stops: the motor winds down and the face goes dark. */
  powerDown() {
    this.hush(0.2); this.cloud.thin();
    this.off = true; this.state = 'OFF'; this.model.face.visible = false;
    if (this.voice) { this.voice.setRate(0.2, D.windDown); this.voice.stop(D.windDown); this.voice = null; }
  }

  /**
   * The paw hit an outlet? Only the one he's plugged into does anything, from the side the plate faces. The cord whips
   * back, he dies for a moment, then plugs into the nearest outlet. Returns true if it unplugged him.
   */
  swipeOutlet(camera) {
    if (this.off || this.plugState !== 'in' || this.caught) return false;
    const S = TUNING.swipe, p = this.cord.plugPos, eye = camera.position, o = this.cord.outlet;
    const dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z, d = Math.hypot(dx, dy, dz);
    if (d > S.reach || d < 1e-3 || (eye.x - p.x) * o.n[0] + (eye.z - p.z) * o.n[2] <= 0) return false; // too far, or the other side of the wall
    camera.getWorldDirection(_s);
    if ((dx * _s.x + dy * _s.y + dz * _s.z) / d < S.cone) return false;
    if (this.plugLock > 0) { audio.play('knock.clink', { pos: p }); return false; } // jammed in for now
    if (this.anger >= 5) { // the power's all his now: the plug's live, and it throws the cat back
      audio.play('vac.surgeBuzz', { pos: p, gain: 1.2 }); audio.play('vac.stun', { pos: p, rate: 1.6 });
      this.model.arcsOn(1); this.arcFade = SG.arcAfter;
      const P = this.player; P.shock?.(eye.x - p.x, eye.z - p.z);
      this._investigate(p.x, p.z);
      return true;
    }
    if (this.state === 'CLEAN') { this.slurp?.stop(0.1); this.slurp = null; this.mess = null; }
    this._endReach(); this._endBlast(); this._endSuck(); this._endCreep(); this._endFog(); this.cloud.thin();
    this.direct = false;
    this.plugState = 'retract'; this.plugT = 0; this.state = 'UNPLUGGED';
    this.setAnger(C.unplugAnger); // he comes back at this stage, whatever he was before
    this.model.face.visible = false;
    audio.play('vac.unplug', { pos: p });
    if (this.voice) { this.voice.setRate(0.2, D.windDown); this.voice.fadeTo(0, D.windDown); }
    return true;
  }

  /** The cord reeling back, the dead time, then the cord going out to whichever outlet is nearest him. */
  _tickPlug(dt) {
    this.plugT += dt;
    if (this.plugState === 'retract') {
      this.cord.setTrim(this.plugT / C.retract);
      if (this.plugT >= C.retract) { this.plugState = 'dead'; this.plugT = 0; }
    } else if (this.plugState === 'dead') {
      if (this.plugT >= C.off) { this._chooseOutlet(); this.plugState = 'extend'; this.plugT = 0; }
    } else {
      this.cord.setTrim(1 - this.plugT / C.extend);
      if (this.plugT >= C.extend) {
        this.plugState = 'in'; this.plugT = 0; this.plugLock = C.lock; this.state = 'PATROL'; this.cord.setTrim(0);
        this.model.face.visible = true;
        audio.play('vac.power', { pos: this.cord.plugPos });
        this.droneT = 0;
      }
    }
  }

  /** Plug into the outlet closest along the floor, and lay the cord from it to him. */
  _chooseOutlet() {
    const here = this._nearestClear(); // (a waypoint he can actually get to: not the one on the far side of a wall)
    let best = this.cord.outlet, bd = Infinity;
    for (const o of LEVEL.outlets) { const d = this.nav.lengthOf(this.nav.path(this.nav.nodes.get(o.node), here)); if (d < bd) { bd = d; best = o; } }
    this.cord.setOutlet(best);
    this.root = this.nav.nodes.get(best.node);
    this.tether = this.nav.path(this.root, here);
    this.path = [here]; this.pathI = 0;
    this.lastPaid = this._paid();
  }

  /** Metres of cord down right now, including the stretch to where he is between waypoints. */
  _paid() {
    const T = this.tether, top = T[T.length - 1], base = this.nav.lengthOf(T);
    const d = Math.hypot(this.x - top.x, this.z - top.z);
    return this._retracing() ? base - d : base + d;
  }

  _retracing() { const T = this.tether; return T.length >= 2 && this.path[this.pathI] === T[T.length - 2]; }

  /**
   * The route to a waypoint that the cord allows. He can carry on from where he is if there's enough cord; if not, he goes
   * back along it to the nearest point from which there is. Going back over the cord reels it in.
   */
  planTo(target) {
    if (this._retracing()) this.tether.pop(); // changed his mind mid-reel-in: that stretch is already back on the reel
    const T = this.tether, nav = this.nav, along = [0];
    for (let i = 1; i < T.length; i++) along.push(along[i - 1] + nav.lengthOf([T[i - 1], T[i]]));
    const top = T.length - 1;
    let best = null, bestCost = Infinity;
    for (let k = top; k >= 0; k--) {
      if (T[k].virtual) continue; // (a point he strayed through, off the graph)
      const onward = nav.path(T[k], target);
      if (!onward.length) continue;
      const len = nav.lengthOf(onward);
      if (along[k] + len > C.length - 0.4) continue; // (a little in hand: he cuts corners and changes his mind mid-stretch)
      const cost = along[top] - along[k] + len;
      if (cost < bestCost) { bestCost = cost; best = { k, onward }; }
    }
    if (!best) return [T[top]];
    const back = T.slice(best.k, top + 1).reverse();
    return back.concat(best.onward.slice(1));
  }

  /** Where next? Not a circuit: somewhere he hasn't been lately, somewhere noisy, a roll of the dice, and not too far. */
  _nextLeg() {
    const now = this.time, here = this.path[this.pathI];
    const scored = this.route.map((n, i) => {
      if (n === here) return { n, i, v: -1e9 };
      let v = Math.min(120, now - (this.seenAt.get(n) ?? -60)) + Math.random() * RO.randomWeight - Math.hypot(n.x - this.x, n.z - this.z) * RO.distWeight;
      if (this.anger >= 2) for (const c of this.noises) if (Math.hypot(n.x - c.x, n.z - c.z) < 4) { v += RO.noiseBonus; break; }
      return { n, i, v };
    }).sort((a, b) => b.v - a.v);
    for (const c of scored) { // (the first he has enough cord to reach)
      const p = this.planTo(c.n);
      if (p.length < 2) continue;
      this.lastStop = here; this.routeI = c.i; this.path = p; this.pathI = 0;
      return;
    }
  }

  /** Second thoughts while he's on his way: he stops to look around, turns back, or follows a hunch. */
  _think() {
    this.thinkT = between(RO.think);
    const a = this.anger - 1, r = Math.random();
    if (this.lurkCd <= 0 && Math.random() < LK.chance[a] && this._startLurk()) return;
    if (this.ambushCd <= 0 && Math.random() < AM.chance[a] && this._startAmbush()) return;
    if (Math.random() < RO.hunchChance[a] && !this.player.noclip) {
      let best = null, bd = Infinity; const P = this.player;
      for (const n of this.route) { const d = Math.hypot(n.x - P.pos.x, n.z - P.pos.z); if (d < bd) { bd = d; best = n; } }
      if (best && best !== this.path[this.pathI]) { this._pause(this.heading, 'continue'); this.hunch = best; this.pauseThen = 'hunch'; }
      return;
    }
    if (r < RO.pauseChance) { this._pause(this.heading + (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 1.8), 'continue'); return; }
    if (r < RO.pauseChance + RO.backChance[a] && this.lastStop) this._pause(this.heading + Math.PI, 'back');
  }

  _pause(yaw, then) { this.state = 'PAUSE'; this.pauseT = between(RO.pause); this.pauseYaw = yaw; this.pauseThen = then; }

  _tickPause(dt) {
    const diff = wrap(this.pauseYaw - this.heading), turn = RO.lookSpeed * dt;
    this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, diff)));
    this.pauseT -= dt;
    if (this.pauseT > 0) return;
    this.state = 'PATROL';
    if (this.pauseThen === 'back' && this.lastStop) { const n = this.lastStop; this.lastStop = this.path[this.path.length - 1]; this.routeTo(n); }
    else if (this.pauseThen === 'hunch' && this.hunch) this.routeTo(this.hunch);
    this.pauseThen = null;
  }

  // ---- lurking: he goes and stands somewhere he can see you, and watches. Look away and he's nearer; look at him and he
  // goes still; stare him out and he slips off round the corner.
  _startLurk() {
    const P = this.player;
    if (P.noclip || this.anger < LK.minAnger || this.cloud.active) return false;
    const a = this._a, b = this._b, picks = [], corner = Math.random() < LK.cornerChance, near = corner ? LK.cornerNear : LK.near;
    b.x = P.pos.x; b.y = P.feetY + 0.15; b.z = P.pos.z;
    for (const n of this.nav.nodes.values()) {
      const d = Math.hypot(n.x - P.pos.x, n.z - P.pos.z);
      if (d < near[0] || d > near[1]) continue;
      a.x = n.x; a.y = 0.35; a.z = n.z;
      if (!!this.world.countOccluders(a, b, 1, true) !== corner) continue; // in plain view of you, or (round the corner) just out of it: look round and he's already there
      picks.push(n);
    }
    while (picks.length) {
      const n = picks.splice(Math.floor(Math.random() * picks.length), 1)[0], path = this.planTo(n);
      if (path.length < 2) continue;
      this.state = 'LURK'; this.lurkPhase = 'go'; this.lurkCd = LK.cooldown; this.lookT = 0; this.stalk = true; this.lurkCorner = corner; this.seenLurk = false; this.jumpCd = 0;
      this.path = path; this.pathI = 0;
      return true;
    }
    this.lurkCd = 4; return false;
  }

  _roomOf(x, z) { return LEVEL.rooms.find((r) => x > r.min[0] && x < r.max[0] && z > r.min[1] && z < r.max[1])?.id ?? null; }

  /** Somewhere out of sight, just outside the room you're in, within the hose's reach: he goes there quietly. */
  _startAmbush() {
    const P = this.player;
    if (P.noclip || this.anger < AM.minAnger || this.cloud.active) return false;
    const room = this._roomOf(P.pos.x, P.pos.z), a = this._a, b = this._b, picks = [];
    b.x = P.pos.x; b.y = P.feetY + 0.15; b.z = P.pos.z;
    for (const n of this.nav.nodes.values()) {
      const d = Math.hypot(n.x - P.pos.x, n.z - P.pos.z);
      if (d < AM.near[0] || d > AM.near[1] || this._roomOf(n.x, n.z) === room) continue;
      a.x = n.x; a.y = 0.35; a.z = n.z;
      if (!this.world.countOccluders(a, b, 1, true)) continue; // (out of sight: you mustn't see him get there)
      picks.push(n);
    }
    while (picks.length) {
      const n = picks.splice(Math.floor(Math.random() * picks.length), 1)[0], path = this.planTo(n);
      if (path.length < 2) continue;
      this.state = 'INVESTIGATE'; this.ambush = true; this.stalk = true; this.ambushCd = AM.cooldown; this.path = path; this.pathI = 0;
      return true;
    }
    this.ambushCd = 6; return false;
  }

  /** Hunting for you, both out of sight of each other: now and then he skips a stretch of his way toward you, all at once. */
  _tickUncanny(dt) {
    if ((this.uncannyCd -= dt) > 0) return;
    const P = this.player, d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z);
    if (this.anger < UN.minAnger || this.direct || this.sweep || P.noclip || d < UN.near[0] || d > UN.near[1] || !['PATROL', 'INVESTIGATE', 'SEARCH'].includes(this.state)) { this.uncannyCd = 2; return; }
    const c = this.camera, f = c.getWorldDirection(_s), dx = this.x - c.position.x, dz = this.z - c.position.z, l = Math.hypot(dx, dz) || 1, a = this._a;
    a.x = this.x; a.y = 0.3; a.z = this.z;
    if ((dx * f.x + dz * f.z) / l > UN.outView || !this.world.countOccluders(c.position, a, 1, true)) { this.uncannyCd = 1.5; return; } // (only ever where you can't see it happen)
    const n = this.path[this.pathI]; if (!n || Math.hypot(P.pos.x - n.x, P.pos.z - n.z) > d) { this.uncannyCd = 3; return; } // (only if his way takes him toward you)
    const state = this.state, sp = 1.2, steps = Math.round(UN.jump / (sp / 60));
    for (let i = 0; i < steps && this.state === state && !this.sweep; i++) this._followPath(1 / 60, sp);
    this.px = this.x; this.pz = this.z; this.prevHeading = this.heading; this.lastPaid = this._paid(); this.hose.reset();
    this.uncannyCd = between(UN.every);
  }

  /** Is the cat looking straight at him, with nothing in the way? */
  _watched() {
    const c = this.camera; c.getWorldDirection(_s);
    const y = this.model.faceCenterY(), dx = this.x - c.position.x, dy = y - c.position.y, dz = this.z - c.position.z, l = Math.hypot(dx, dy, dz) || 1;
    if ((dx * _s.x + dy * _s.y + dz * _s.z) / l < LK.lookCos || l > LK.near[1] + 2) return false;
    const a = this._a; a.x = this.x; a.y = y; a.z = this.z;
    return this.world.countOccluders(c.position, a, 1, true) === 0;
  }

  _tickLurk(dt) {
    const P = this.player, d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z);
    if (this.lurkPhase === 'go' || this.lurkPhase === 'leave') { this._followPath(dt, V.speed[this.anger - 1] * (this.lurkPhase === 'leave' ? LK.leaveSpeed : TUNING.stalk.speed)); return; }
    // watching: he turns to you, slowly, and doesn't take his eyes off you
    const want = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), diff = wrap(want - this.heading), turn = V.turnRate * 0.35 * dt;
    this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, diff)));
    this.lurkT -= dt;
    if (this._watched()) { // seen: dead still
      this.lookT += dt; this.seenLurk = true;
      if (this.lookT >= LK.stare) { // and away he goes, out of sight
        if (Math.random() < LK.sayChance) this._say(this.anger >= 5 ? 'lurk5' : 'lurk', true);
        this.lurkPhase = 'leave'; if (this.direct) this._rejoin();
        let best = null, bd = -1;
        for (const n of this.nav.nodes.values()) { const dn = Math.hypot(n.x - this.x, n.z - this.z), away = Math.hypot(n.x - P.pos.x, n.z - P.pos.z) - d; if (dn > 1 && dn < 4 && away > bd) { const path = this.planTo(n); if (path.length > 1) { bd = away; best = path; } } }
        if (best) { this.path = best; this.pathI = 0; } else { this.lurkPhase = null; this._resumePatrol(); }
      }
      return;
    }
    if (this.lookT > 0) this.lookT = Math.max(0, this.lookT - dt * 0.5);
    if (this.jumpCd > 0) this.jumpCd -= dt;
    { // you looked at him, then away: and when you look back he's a good deal nearer (never where it would catch you)
      const c = this.camera, f = c.getWorldDirection(_s), dx = this.x - c.position.x, dz = this.z - c.position.z, l = Math.hypot(dx, dz) || 1, outOfView = (dx * f.x + dz * f.z) / l < LK.outView;
      if (this.seenLurk && outOfView && this.jumpCd <= 0 && d > LK.close + 0.6 && (this.jumpCd = LK.jumpEvery) && Math.random() < LK.jumpChance) { // (a roll every jumpEvery s while you look away)
        const go = Math.min(LK.jump, d - LK.close - 0.4), hx = (P.pos.x - this.x) / d, hz = (P.pos.z - this.z) / d, tx = this.x + hx * go, tz = this.z + hz * go;
        if (go > 0.3 && this._clear(tx, tz) && this._paid() + go < C.length - 0.3) { this.x = this.px = tx; this.z = this.pz = tz; this.heading = this.prevHeading = Math.atan2(hx, hz); this.direct = true; this._guardCord(); this.hose.reset(); }
      }
    }
    if (!this.lurkCorner && d > LK.close + 0.4 && Math.abs(diff) < 0.5 && this._paid() < C.length - 0.3) { // not looking? he's a little nearer
      const tx = this.x + Math.sin(this.heading) * 0.3, tz = this.z + Math.cos(this.heading) * 0.3;
      if (this._clear(tx, tz)) { this.x += Math.sin(this.heading) * LK.creep * dt; this.z += Math.cos(this.heading) * LK.creep * dt; this.world.resolve(this, V.radius - 0.02, 0.03, V.height, null, 2, 0.03); this._guardCord(); this.direct = true; }
    }
    if (this.lurkT <= 0) { this.lurkPhase = null; this.stalk = false; if (this.direct) this._rejoin(); this._resumePatrol(); }
  }

  // ---- he heard something: he stops dead, the motor falls away, the nozzle lifts toward it
  _startAlert(x, z) {
    this.state = 'ALERT'; this.alertT = A.time[this.anger - 1]; this.alertCd = A.cooldown; this.alertX = x; this.alertZ = z;
    if (this.heardCd <= 0) { this.heardCd = A.stingEvery; audio.play('vac.listen', { follow: this.model.hoseSocket, refDistance: 3, rolloff: 0.6 }); audio.play('sting.heard'); } // (the motor dropping away is the cue every time; the sounds only now and then)
  }

  _tickAlert(dt) {
    const want = Math.atan2(this.alertX - this.x, this.alertZ - this.z), diff = wrap(want - this.heading), turn = V.turnRate * dt;
    this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, diff)));
    this.alertT -= dt;
    if (this.alertT > 0) return;
    this.state = 'INVESTIGATE'; this._maybeStalk();
    this.routeTo(this.nav.nearest(this.alertX, this.alertZ));
  }

  // ---- the long reach: a hose that comes for a cat hiding up high, slowly
  _canCreep() {
    const P = this.player, h = this._hole();
    return !P.noclip && this.anger >= CR.minAnger && this.creepCd <= 0 && (P.feetY >= CR.minHeight || this.foundT > 0 || this._catUnder()) && Math.hypot(P.pos.x - h.x, P.feetY + 0.12 - h.y, P.pos.z - h.z) <= CR.range;
  }

  /** Is the cat on the floor with something over it (under a table, a bed, a chair)? His body can't get in there; the hose can. */
  _catUnder() {
    const P = this.player;
    if (P.feetY >= 0.3) return false;
    const o = this._a, d = this._dirv; o.x = P.pos.x; o.y = P.feetY + 0.1; o.z = P.pos.z; d.x = 0; d.y = 1; d.z = 0;
    return !!this.world.raycast(o, d, 1.1, (c) => c.solid, false);
  }

  _startCreep() {
    if (this.direct) this._rejoin();
    this.state = 'CREEP'; this.creepT = 0; this.campT = 0;
    this.creepV = audio.play('vac.creep', { follow: this.hose.nozzle, refDistance: 0.8, rolloff: 1.2 });
  }

  _endCreep() { this.creepV?.stop(0.2); this.creepV = null; if (this.state !== 'CREEP') this.ambush = false; }

  _creepOver() { this._endCreep(); this.creepCd = CR.cooldown[this.anger - 1]; }

  _tickCreep(dt) {
    const P = this.player, want = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), diff = wrap(want - this.heading), turn = V.turnRate * 0.4 * dt;
    this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, diff)));
    this.creepT += dt;
    if (this.hose.tip.distanceTo(this._catChest(this._goal)) <= H.hit + 0.02) { this._creepOver(); this._catch('hose'); return; }
    if (!this.ambush && P.feetY < CR.floorY && !this._catHidden() && !this._catUnder()) { this._creepOver(); this.lastX = P.pos.x; this.lastZ = P.pos.z; this._startChase(); return; } // it came down: forget the hose
    const t = this.ambush ? AM.time : CR.maxTime;
    if (this.creepT >= t || this.hose.maxed || this.hose.stuck) {
      this._creepOver();
      if (this.ambush) { this.ambush = false; this.lastX = P.pos.x; this.lastZ = P.pos.z; this._startChase(); return; } // you dodged it: and here he comes
      this.ignoreT = V.ignoreTime * 0.5; this._giveUp();
    }
  }

  // ---- the dust cloud
  _canFog() {
    if (this.anger < F.minAnger || this.fogCd > 0 || this.cloud.active || this.player.noclip) return false;
    const P = this.player;
    return this.seesCat ? Math.hypot(P.pos.x - this.x, P.pos.z - this.z) >= F.minDist : this.loseT >= F.lostFor;
  }

  _startFog() {
    if (this.direct) this._rejoin();
    this.state = 'FOG'; this.fogPhase = 'wind'; this.fogT = 0; this.coughI = 0;
    this._shriek(true);
    this._say(this.anger >= 5 ? 'fog5' : 'fog', true, false, true); // (heard and captioned wherever you are: it's coming for the whole house)
  }

  _endFog() { this.fogPhase = null; }

  _tickFog(dt) {
    const P = this.player, t = this.hose.tip, turn = V.turnRate * dt, want = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), diff = wrap(want - this.heading);
    this.fogT += dt;
    if (this.fogPhase === 'wind') { // bringing it up: he coughs, and a little comes out each time
      this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, diff)));
      if (this.coughI < F.coughs.length && this.fogT >= F.coughs[this.coughI]) {
        this.coughI++; this.model.cough();
        audio.play('vac.cough', { follow: this.model.hoseSocket, rolloff: 0, rate: 0.7 + Math.random() * 0.25 });
        for (let i = 0; i < 4; i++) this.cloud.emit(t.x, t.y, t.z, this.hose.dir.x, this.hose.dir.y, this.hose.dir.z, 1.4);
      }
      if (this.fogT < F.wind) return;
      this.cloud.release(t.x, Math.max(0.4, t.y), t.z);
      this.fogCd = F.cooldown; this.fogPhase = 'spray'; this.fogT = 0; this.sprayT = 0;
      audio.play('vac.exhale', { pos: t });
      return;
    }
    if (this.fogPhase === 'spray') { // pouring out of the nozzle as it swings
      this.sprayT -= dt;
      if (this.sprayT <= 0) { this.sprayT = F.sprayEvery * (0.6 + Math.random() * 0.8); const a = this.hose.pts[this.hose.n - 1], dx = t.x - a.x, dy = t.y - a.y, dz = t.z - a.z, l = Math.hypot(dx, dy, dz) || 1; this.cloud.emit(t.x, t.y, t.z, dx / l, dy / l, dz / l, F.spraySpeed); }
      if (this.fogT < F.spray) return;
      this.fogPhase = 'recover'; this.fogT = 0;
      return;
    }
    if (this.fogT >= F.recover) { this._endFog(); if (this.seesCat) { this.lastX = P.pos.x; this.lastZ = P.pos.z; } this._startSearch(); }
  }

  /** Something fell on him: everything stops for a moment. */
  stun(o) {
    if (this.stunCd > 0 || this.off || this.caught || this.plugState !== 'in') return false;
    const S = TUNING.stun;
    this.stunT = Math.min(S.max, S.time + o.mass * S.perKg); this.stunCd = S.cooldown + this.stunT;
    const wasHunting = this.state === 'CHASE' || this._attacking();
    this._endReach(); this._endBlast(); this._endSuck(); this._endCreep(); this._endFog();
    if (wasHunting) { this.lastX = this.player.pos.x; this.lastZ = this.player.pos.z; this.reachCd = Math.max(this.reachCd, 1); this.state = 'CHASE'; this.loseT = 0; }
    this.model.flicker();
    audio.play('vac.stun', { follow: this.model.hoseSocket, refDistance: 3, rolloff: 0.7 });
    return true;
  }

  /** Is the cat low down in one of the hiding places? */
  _catHidden() {
    const P = this.player;
    if (P.feetY >= 0.3) return false;
    for (const h of LEVEL.hides) if (P.pos.x > h.min[0] && P.pos.x < h.max[0] && P.pos.z > h.min[1] && P.pos.z < h.max[1]) return true;
    return false;
  }

  /** He has reached where you went: does he think to look in there? */
  _checkHides() {
    const P = this.player, H0 = TUNING.hide;
    if (P.noclip || !this._catHidden() || Math.hypot(P.pos.x - this.x, P.pos.z - this.z) > H0.range || Math.random() >= H0.chance[this.anger - 1]) return false;
    this.foundT = H0.time; this.lastX = P.pos.x; this.lastZ = P.pos.z; this.sweep = false;
    this._sting(); this.creepCd = 0;
    if (this._canCreep()) this._startCreep(); else this._startChase(); // the hose goes in after it
    return true;
  }

  /** His body is solid, whatever his mood: the cat can't walk through him, and he shoves it aside. */
  _bump() {
    const P = this.player;
    if (P.noclip || this.caught || P.feetY >= V.height * this.model.k) return;
    const dx = P.pos.x - this.x, dz = P.pos.z - this.z, min = V.radius + TUNING.player.radius * V.solidShare, d = Math.hypot(dx, dz);
    if (d >= min) return;
    const nx = d > 1e-4 ? dx / d : Math.sin(this.heading), nz = d > 1e-4 ? dz / d : Math.cos(this.heading);
    P.pos.x = this.x + nx * min; P.pos.z = this.z + nz * min;
    const vn = P.vel.x * nx + P.vel.z * nz;
    if (vn < 0) { P.vel.x -= nx * vn; P.vel.z -= nz * vn; }
  }

  // ---- hearing, investigating, cleaning
  /** Where the middle of the hole is, in the world. */
  _hole() {
    const h = this._h, M = V.model;
    const hz = this.model.holeZ ? this.model.holeZ() : M.holeZ;
    h.x = this.x + Math.sin(this.heading) * hz; h.y = this.model.holeY(); h.z = this.z + Math.cos(this.heading) * hz;
    return h;
  }

  _hear(ev) {
    if (this.off || this.plugState !== 'in' || this.dormant) return; // (not here yet: the tutorial's breakages don't count against you)
    if (ev.kind === 'crash') { // every knock-over can raise his anger, whether he hears it or not
      this.heat++; this.calmT = 0;
      this.streak.push(this.time); while (this.streak.length && this.time - this.streak[0] > V.streakWindow) this.streak.shift();
      const want = this._stageFor(this.heat);
      if (want > this.anger) this.setAnger(want, true);
    }
    if (ev.kind === 'crash') { this.noises.push({ x: ev.x, z: ev.z, t: this.time }); while (this.noises.length && this.time - this.noises[0].t > RO.noiseLasts) this.noises.shift(); }
    const d = Math.hypot(ev.x - this.x, ev.z - this.z);
    if (ev.kind === 'crash' && !this.rushed && this.state !== 'CHASE' && !this._attacking()) { // the very first mess of the night: he's there in a flash
      this.rushed = true; this.rush = true; this.stalk = false;
      if (this.state === 'CLEAN') { this.slurp?.stop(0.1); this.slurp = null; this.mess = null; }
      const m = this.debris.messes.find((x) => x.id === ev.objectId); if (m) m.known = true;
      this.state = 'INVESTIGATE'; this.routeTo(this.nav.nearest(ev.x, ev.z)); this._say('rush', true);
      return;
    }
    if (ev.kind === 'crash' && this.anger <= 2 && this.shhCd <= 0 && d <= V.hearNear) { this.shhCd = TUNING.voice.shhEvery; this._say(this.anger === 1 ? 'shh1' : 'shh2', true); } // "Shh! You'll wake Granny!"
    const heard = ev.kind === 'crash' ? this.anger >= 3 || d <= V.hearNear || this.streak.length >= 3
      : ev.kind === 'thud' ? this.anger >= 2 && d <= (ev.radius ?? V.hearLand[0]) // a landing gives away where you are
        : this.anger >= 3 && d <= (ev.gait === 'walk' ? V.hearWalk : V.hearSteps);
    if (!heard) return;
    if (ev.kind === 'crash') { const m = this.debris.messes.find((x) => x.id === ev.objectId); if (m) m.known = true; } // on his to-do list now
    this._investigate(ev.x, ev.z);
  }

  _investigate(x, z) {
    this.ambush = false; // (a noise takes him off whatever he was setting up)
    if (this.state === 'CHASE') { if (!this.seesCat) { this.lastX = x; this.lastZ = z; } return; } // something to go on while he has lost sight of you
    if (this._attacking()) return; // busy: a crash doesn't pull him off an attack (his own can cause one)
    if (this.state === 'CLEAN') { this.pending = { x, z }; return; } // he finishes the job in hand first
    if (this.state === 'ALERT') { this.alertX = x; this.alertZ = z; return; } // (already listening: it's that way)
    if (this.alertCd <= 0) { this._startAlert(x, z); return; }
    this.state = 'INVESTIGATE';
    this.routeTo(this.nav.nearest(x, z));
  }

  _attacking() { const s = this.state; return s === 'TURN' || s === 'SURGE' || s === 'HOSE_REACH' || s === 'BLAST' || s === 'SUCK' || s === 'FOG' || s === 'CREEP' || s === 'LUNGE'; }

  routeTo(node) { // (if the new route carries on the way he's already going, he doesn't turn back to the last waypoint first)
    const cur = this.path[this.pathI];
    this.path = this.planTo(node);
    this.pathI = this.path.length > 1 && this.path[1] === cur ? 1 : 0;
  }

  /** Back to the patrol, at whichever stop of the loop is nearest. */
  _resumePatrol() {
    this.state = 'PATROL'; this.rush = false;
    let best = 0, bd = Infinity;
    this.route.forEach((n, i) => { const d = (n.x - this.x) ** 2 + (n.z - this.z) ** 2; if (d < bd) { bd = d; best = i; } });
    this.routeI = best;
    this.routeTo(this.route[best]);
  }

  _nearestMess(radius, needSight) {
    let best = null, bd = radius;
    for (const m of this.debris.messes) {
      if (m.cleaned) continue;
      const d = Math.hypot(m.x - this.x, m.z - this.z);
      if (d >= bd) continue;
      if (needSight) { const a = this._a, b = this._b; a.x = this.x; a.y = 0.3; a.z = this.z; b.x = m.x; b.y = 0.1; b.z = m.z; if (this.world.countOccluders(a, b, 1, true)) continue; }
      bd = d; best = m;
    }
    return best;
  }

  /** The nearest mess he knows about (heard or seen) and hasn't got to yet. */
  _nextKnownMess() {
    let best = null, bd = Infinity;
    for (const m of this.debris.messes) { if (m.cleaned || !m.known) continue; const d = (m.x - this.x) ** 2 + (m.z - this.z) ** 2; if (d < bd) { bd = d; best = m; } }
    return best;
  }

  _startClean(m, huffed = false) {
    this.rush = false;
    if (!huffed && this.anger === 2 && this.huffCd <= 0) { this._startHuff(m); return; }
    if (!m.obj) this._say(m.id === 'urn' ? 'urn' : this.anger <= 1 ? 'mess1' : this.anger === 2 ? 'mess2' : 'mess3', m.id === 'urn');
    m.known = true;
    this.cleanWait = 0; this.cleanFacing = false;
    this.state = 'CLEAN'; this.mess = m; this.cleanT = 0;
    this.slurp = audio.play('vac.slurp', { follow: this.model.hoseSocket, rolloff: 0, gain: 1 });
  }

  _tickClean(dt) {
    // turn to face it and get the nozzle on it first: the mess goes up the tip of the hose
    const want = Math.atan2(this.mess.x - this.x, this.mess.z - this.z), diff = wrap(want - this.heading), maxTurn = V.turnRate * dt;
    this.heading = wrap(this.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
    this.cleanFacing = Math.abs(diff) < 0.3; // the nozzle only comes out once he's facing it: straight out of the front
    const tip = this.hose.tip, touching = Math.hypot(tip.x - this.mess.x, tip.z - this.mess.z) < V.cleanTouch && tip.y < 0.3;
    if (!this.cleanFacing || (!touching && this.cleanT <= 0)) { // nothing goes until the tip of the nozzle is on it
      this.cleanWait += dt;
      if (this.cleanFacing && this.cleanWait > H.cleanTimeout && Math.hypot(this.mess.x - this.x, this.mess.z - this.z) > V.radius + 0.3) this._steer(dt, this.mess.x, this.mess.z, V.speed[this.anger - 1] * 0.7); // the hose can't get there from here: he goes closer
      if (this.cleanWait < H.cleanTimeout * 3) return; // (and if it still can't, he gets on with it anyway rather than stand there)
    }
    this.cleanT += dt / V.cleanTime;
    const u = Math.min(1, this.cleanT), h = this.hose.tip; // the debris flies into the nozzle
    this.debris.cleanStep(this.mess, u, h.x, h.y, h.z);
    if (u < 1) return;
    this.mess.cleaned = true; this.mess = null;
    this.state = 'PATROL'; // (done cleaning, whatever comes next)
    this.slurp?.stop(0.15); this.slurp = null;
    const p = this.pending; this.pending = null;
    if (p) { this._investigate(p.x, p.z); return; }
    const near = this._nearestMess(V.cleanSee, true);
    if (near) { this._startClean(near); return; }
    const next = this._nextKnownMess();
    if (next) { this.state = 'INVESTIGATE'; this.routeTo(this.nav.nearest(next.x, next.z)); } else this._resumePatrol();
  }

  // ---- sight, the chase, the search
  /** Can he see the cat right now? A cone in front of him, shorter if it's slinking, blocked by walls and tall furniture. */
  _canSee(range = null) { // (range: look this far instead, whatever his mood: saying hello)
    const P = this.player;
    if (P.noclip) return false;
    if (this._catHidden()) return this.foundT > 0; // tucked away: he can't see you unless he has found you
    const dx = P.pos.x - this.x, dz = P.pos.z - this.z, d = Math.hypot(dx, dz) || 1;
    const slinking = P.slink > 0.5;
    if (d > (range ?? V.sightRange[this.anger - 1]) * (slinking ? V.slinkSight : 1) * (P.feetY >= H.minPerch ? V.perchSight : 1) * (this.state === 'CLEAN' ? V.cleanSight : 1)) return false;
    if ((dx * Math.sin(this.heading) + dz * Math.cos(this.heading)) / d < V.sightCos) return false;
    const a = this._a, b = this._b;
    a.x = this.x; a.y = 0.35; a.z = this.z; b.x = P.pos.x; b.y = P.feetY + 0.15; b.z = P.pos.z;
    // what the cat is standing on doesn't hide it: from the floor, a cat on a fridge is just on top of the fridge
    const under = P.groundCollider, was = under ? under.occludes : false;
    if (under) under.occludes = false;
    let clear = this.world.countOccluders(a, b, 1, true) === 0;
    if (under) under.occludes = was;
    if (clear && slinking && P.dust <= 0) { // crouched behind anything at all, even a low table, the cat is hidden (not while it's covered in dust)
      const o = this._a, dir = this._dirv, dy = b.y - a.y, len = Math.hypot(dx, dy, dz);
      dir.x = dx / len; dir.y = dy / len; dir.z = dz / len;
      this._under = under;
      if (this.world.raycast(o, dir, len - 0.05, this._notUnder, false)) clear = false;
    }
    return clear;
  }

  _perceive(dt) {
    this.seesCat = this._canSee();
    if (this.seesCat) { this.lastX = this.player.pos.x; this.lastZ = this.player.pos.z; }
    else if (this.state === 'CHASE' && this.loseT < V.trackGrace && !this.player.noclip) { this.lastX = this.player.pos.x; this.lastZ = this.player.pos.z; } // (just round the corner: he knows which way you went)
    if (this.state === 'CHASE' && (this.seesCat || this.loseT < V.trackGrace) && (this.crumbT -= dt) <= 0) { this.crumbT = V.crumbs; this.crumbs.push({ x: this.player.pos.x, z: this.player.pos.z }); if (this.crumbs.length > V.crumbMax) this.crumbs.shift(); }
    if (this.seesCat && this.anger >= 3 && this.stingCd <= 0 && !this._attacking()) { // eye contact: you're looking at him, and he's looking at you
      const c = this.camera; c.getWorldDirection(_s);
      const dx = this.x - c.position.x, dy = 0.2 - c.position.y, dz = this.z - c.position.z, l = Math.hypot(dx, dy, dz) || 1;
      if ((dx * _s.x + dy * _s.y + dz * _s.z) / l > ST.eyeCos) { this._sting(); this.freezeT = ST.freeze; }
    }
    if (this.state === 'CHASE' || this._attacking()) return;
    if (this.friendly) { // nothing broken: no chasing, just a hello now and then
      this.seeT = 0;
      if (this.state !== 'GREET' && this.state !== 'CLEAN' && this.greetCd <= 0 && this._canSee(FR.greetRange)) this._greet('hi');
      return;
    }
    if (this.ignoreT > 0) { this.ignoreT -= dt; this.seeT = 0; return; } // recently gave up on this cat
    if (this.state === 'LURK' && this.lurkPhase !== 'go' && Math.hypot(this.player.pos.x - this.x, this.player.pos.z - this.z) > LK.close) { this.seeT = 0; return; } // (watching: he only comes for you if you come too close)
    this.seeT = this.seesCat ? this.seeT + dt : Math.max(0, this.seeT - dt);
    if (this.seeT >= V.noticeTime[this.anger - 1] * (this.player.slink > 0.5 ? V.slinkNotice : 1)) this._startChase();
  }

  _startChase() {
    if (this.state === 'CLEAN') { this.slurp?.stop(0.1); this.slurp = null; this.mess = null; }
    this.spotted++; this.stalk = false;
    if (this.anger >= 3 && Math.random() < 0.5) this._say(this.anger >= 5 ? 'hunt5' : this.anger === 4 ? 'hunt4' : 'hunt3');
    this.rush = false; this.ambush = false; this.crumbs.length = 0; this.pending = null; this.state = 'CHASE'; this.loseT = 0; this.lostFor = 0; this.peekT = 0; this.peekCd = PK.every[this.anger - 1] * 0.5; this.replanT = 0; this.chaseNode = null; this.seeT = 0; this.sweep = false;
    audio.play('vac.surge', { follow: this.model.hoseSocket, rolloff: 0 });
    this._sting();
    if (this.anger === 4) this._shriek();
  }

  /** Is the straight line to this point clear for his body? */
  _clear(tx, tz) {
    const len = Math.hypot(tx - this.x, tz - this.z), steps = Math.max(1, Math.ceil(len / 0.1));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.world.penetration(this.x + (tx - this.x) * t, this.z + (tz - this.z) * t, V.radius, 0.03, V.height) > 0) return false;
    }
    return true;
  }

  /** The nearest waypoint with nothing in the way of his body. */
  _nearestClear() {
    let best = null, bd = Infinity;
    for (const n of this.nav.nodes.values()) { const d = (n.x - this.x) ** 2 + (n.z - this.z) ** 2; if (d < bd && this._clear(n.x, n.z)) { bd = d; best = n; } }
    return best || this.nav.nearest(this.x, this.z);
  }

  /** Stuck? If he's been trying to move and hasn't, he finds another way; failing that he's put somewhere he can go from. */
  _stuckCheck(dt) {
    const S = TUNING.stuck, moving = (['PATROL', 'INVESTIGATE', 'SEARCH', 'CHASE'].includes(this.state) || (this.state === 'LURK' && this.lurkPhase !== 'watch')) && !this.sweep && !this.direct;
    // (parked on purpose in a chase: under a perched cat, at the end of his route, or at the end of his cord. That's not stuck)
    const end = this.path[this.pathI], parked = this.state === 'CHASE' && (this._paid() >= C.length - 0.1 || (this.direct ? Math.hypot(this.directX - this.x, this.directZ - this.z) <= V.arrive + 0.05 : this.pathI >= this.path.length - 1 && end && Math.hypot(end.x - this.x, end.z - this.z) < V.arrive + 0.05));
    if (!moving || parked) { this.stuckT = 0; this.stuckX = this.x; this.stuckZ = this.z; return; }
    if (Math.hypot(this.x - this.stuckX, this.z - this.stuckZ) > S.move) { this.stuckT = 0; this.stuckTries = 0; this.stuckX = this.x; this.stuckZ = this.z; return; }
    this.stuckT += dt;
    if (this.stuckT < S.after) return;
    this.stuckT = 0; this.stuckTries = (this.stuckTries || 0) + 1;
    const n = this._nearestClear();
    if (this.stuckTries > S.tries) { this.x = this.px = n.x; this.z = this.pz = n.z; this.stuckTries = 0; }
    this._arrived(n); this.path = [n]; this.pathI = 0;
    this._resumePatrol();
  }

  /** He's been heading straight for the cat, off the graph: pick the graph back up at the nearest waypoint he can reach. */
  _rejoin() {
    this.direct = false;
    const T = this.tether;
    let best = T[T.length - 1], bd = Infinity;
    for (const n of this.nav.nodes.values()) { const d = (n.x - this.x) ** 2 + (n.z - this.z) ** 2; if (d < bd && this._clear(n.x, n.z)) { bd = d; best = n; } }
    if (Math.hypot(this.x - T[T.length - 1].x, this.z - T[T.length - 1].z) > 0.1) T.push({ x: this.x, z: this.z, virtual: true }); // the cord comes this way
    this._arrived(best);
    this.path = [best]; this.pathI = 0;
  }

  // ---- really close: the sweep
  _catFromHole() { const h = this._hole(), P = this.player; return Math.hypot(P.pos.x - h.x, P.pos.z - h.z); }

  _canSuck() { return !this._catHidden() && this.anger >= SU.minAnger && this.seesCat && this.player.feetY <= SU.enterY && this._catFromHole() <= SU.enter; }

  _startSuck() {
    if (this.anger >= 5) this.model.maw = true; // the last stage: the mouth opens as the suction pulls you in
    if (this.direct) this._rejoin();
    const P = this.player;
    this.state = 'SUCK'; this.suckT = 0; this.loseT = 0; this.suckY = P.feetY + 0.12;
    this.suckPhase = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2; // it starts out to one side
    this.suckV = audio.play('vac.slurp', { follow: this.model.hoseSocket, rolloff: 0 });
  }

  _endSuck() { this.suckV?.stop(0.1); this.suckV = null; if (!this.caught) this.model.maw = false; }

  _tickSuck(dt) {
    const P = this.player, want = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), diff = wrap(want - this.heading), maxTurn = V.turnRate * dt;
    this.heading = wrap(this.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
    this.suckT += dt;
    if (P.grounded) this.suckY = P.feetY + 0.12; // the height of what the cat is standing on: a jump goes over it
    if (this.seesCat) this.loseT = 0; else this.loseT += dt;
    if (this.loseT >= (P.slink > 0.5 ? V.hideLose : V.loseTime)) { this._endSuck(); this._startSearch(); return; }
    if (this._catFromHole() > SU.exit || P.feetY > SU.maxY) { this._endSuck(); this._startChase(); return; }
    if (this.suckT < SU.windup) return;
    this.suckPhase += SU.rate[this.anger - 1] * dt;
    const t = this.hose.tip, chest = this._catChest(this._goal), dx = t.x - chest.x, dz = t.z - chest.z, d = Math.hypot(dx, dz);
    if (t.distanceTo(chest) <= H.hit) { this._endSuck(); this._catch('hose'); return; }
    if (d > 1e-4 && d < SU.pullRadius && Math.abs(t.y - chest.y) < 0.4) { const k = SU.pull * (1 - d / SU.pullRadius) / d; P.pullX = dx * k; P.pullZ = dz * k; }
  }

  // ---- the berserker lunge: a wind-up, then he throws himself at you with the hose rammed out straight
  _canLunge() {
    const P = this.player;
    if (this.anger < LU.minAnger || this.lungeCd > 0 || !this.seesCat || P.noclip || P.feetY > LU.maxY || this._catHidden() || this._catUnder()) return false;
    const h = this._hole(), d = Math.hypot(P.pos.x - h.x, P.pos.z - h.z);
    if (d < LU.min || d > LU.max) return false;
    if (Math.random() > LU.chance) { this.lungeCd = 0.8; return false; } // (not this time: he thinks again in a moment)
    const bx = P.pos.x - this.x, bz = P.pos.z - this.z, bl = Math.hypot(bx, bz) || 1, go = Math.min(bl - 0.3, LU.speed * LU.time);
    return this._paid() + go < C.length - 0.3 && this._clear(this.x + (bx / bl) * go, this.z + (bz / bl) * go);
  }

  _startLunge() {
    if (this.direct) this._rejoin();
    this.state = 'LUNGE'; this.lungePhase = 'coil'; this.lungeT = 0;
    this.model.shriek(LU.coil + LU.time); this.model.cough();
    audio.play('vac.surge', { follow: this.model.hoseSocket, rolloff: 0, rate: 1.35, gain: 1.2 });
    if (this.voice) { this.voice.setRate(D.rate[this.anger - 1] * 1.5, LU.coil); this.droneT = LU.coil + LU.time; } // the motor screams up
  }

  _tickLunge(dt) {
    const P = this.player;
    this.lungeT += dt;
    if (this.lungePhase === 'coil') { // rearing back, turning on you
      const tx = P.pos.x + P.vel.x * LU.lead, tz = P.pos.z + P.vel.z * LU.lead, want = Math.atan2(tx - this.x, tz - this.z), diff = wrap(want - this.heading), turn = V.turnRate * 2 * dt;
      this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, diff)));
      if (this.lungeT < LU.coil) return;
      this.lungePhase = 'thrust'; this.lungeT = 0; this.direct = true;
      audio.play('vac.fwoomp', { follow: this.model.hoseSocket, rolloff: 0.6, gain: 0.8 });
      audio.play('vac.shriek', { follow: this.model.hoseSocket, refDistance: 4, rolloff: 0.35, rate: 1.15 }); // screaming as he comes
      if (Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < 3) P.landDip = Math.max(P.landDip, 0.04); // (the floor jolts)
      return;
    }
    if (this.lungePhase === 'thrust') { // flat out, dead straight
      if (this._paid() < C.length - 0.05) {
        this.x += Math.sin(this.heading) * LU.speed * dt; this.z += Math.cos(this.heading) * LU.speed * dt;
        this.world.resolve(this, V.radius - 0.02, 0.03, V.height, null, 2, 0.03);
        this._guardCord();
      }
      if (this.hose.tip.distanceTo(this._catChest(this._goal)) <= H.hit + 0.03) { this._catch('hose'); return; }
      if (this.lungeT >= LU.time) { this.lungePhase = 'recover'; this.lungeT = 0; }
      return;
    }
    if (this.hose.tip.distanceTo(this._catChest(this._goal)) <= H.hit) { this._catch('hose'); return; }
    if (this.lungeT < LU.recover) return; // spent: standing there, the hose out
    this.lungePhase = null; this.lungeCd = LU.cooldown[this.anger - 1]; this.droneT = 0;
    if (this.direct) this._rejoin();
    if (this.seesCat) this._startChase(); else { this.lastX = P.pos.x; this.lastZ = P.pos.z; this._startSearch(); }
  }

  // ---- the dust blast
  _canBlast() {
    if (this.anger < B.minAnger || this.blastCd > 0 || !this.seesCat || this.blasts.some((b) => b.active)) return false;
    const P = this.player, h = this._hole(), d = Math.hypot(P.pos.x - h.x, P.feetY + 0.12 - h.y, P.pos.z - h.z);
    return d >= B.minRange && d <= B.range;
  }

  _startBlast() {
    if (this.direct) this._rejoin();
    this.state = 'BLAST'; this.blastPhase = 'aim'; this.blastT = 0;
    // a straight shot, or a lob: always a lob at a cat up high or with something in the way
    { const P = this.player, h = this._hole(); this.lob = P.feetY >= B.lobAbove || Math.random() < B.lobChance || !this.vox.lineFree(_s.set(h.x, h.y + 0.3, h.z), this._catChest(this._goal)); }
    this.coughV = audio.play('vac.cough', { follow: this.model.hoseSocket, rolloff: 0 });
  }

  _endBlast() { this.blastPhase = null; this.coughV?.stop(0.05); this.coughV = null; }

  _tickBlast(dt) {
    this.blastT += dt;
    const P = this.player;
    if (this.blastPhase === 'aim') {
      const want = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), diff = wrap(want - this.heading), maxTurn = V.turnRate * dt;
      this.heading = wrap(this.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
      if (this.blastT < B.aim) return;
      this._shoot(this.blast, 0);
      this.volley = B.volley[this.anger - 1] - 1; this.volleyT = B.volleyGap;
      this.blastCd = B.cooldown[this.anger - 1];
      this.blastPhase = 'recover'; this.blastT = 0;
      return;
    }
    if (this.volley > 0) { // furious: a burst of them
      this.volleyT -= dt;
      if (this.volleyT <= 0) { const b = this.blasts.find((q) => !q.active); if (b) this._shoot(b, B.volleySpread * (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random())); this.volley--; this.volleyT = B.volleyGap; this.model.cough(); }
      return;
    }
    if (this.blastT >= B.recover) {
      this._endBlast();
      if (this.seesCat) this._startChase(); else { this.lastX = P.pos.x; this.lastZ = P.pos.z; this._startSearch(); }
    }
  }

  /** One shot, at where the cat is plus some of where it's going. spread: rad off to the side. */
  _shoot(blast, spread) {
    const P = this.player, o = this._blastO.copy(this.hose.tip), t = this._catChest(this._goal);
    if (spread) { const dx = t.x - o.x, dz = t.z - o.z, c = Math.cos(spread), sn = Math.sin(spread); t.x = o.x + dx * c - dz * sn; t.z = o.z + dx * sn + dz * c; }
    if (this.lob) { // a high arc that comes down on it: up to a peak above both ends, and down again
      const g = B.lobGravity, top = Math.min(LEVEL.ceiling - B.lobCeiling, Math.max(o.y, t.y) + B.lobApex), up = Math.sqrt(2 * g * Math.max(0.05, top - o.y)), T = up / g + Math.sqrt(2 * g * Math.max(0.02, top - t.y)) / g;
      t.x += P.vel.x * T * B.lead; t.z += P.vel.z * T * B.lead;
      blast.fire(o, this._v.set((t.x - o.x) / T, up, (t.z - o.z) / T), g, true);
    } else {
      const d = o.distanceTo(t), fly = d / B.speed;
      t.x += P.vel.x * fly * B.lead; t.z += P.vel.z * fly * B.lead;
      t.y += 0.5 * B.gravity * fly * fly; // allowing for the droop
      blast.fire(o, this._v.copy(t).sub(o).normalize().multiplyScalar(B.speed));
    }
  }

  // ---- the hose
  _catChest(out) { out.set(this.player.pos.x, this.player.feetY + 0.12, this.player.pos.z); return out; }

  _inReach(margin) {
    const P = this.player, h = this._hole();
    return P.feetY <= H.reachTop + margin && Math.hypot(P.pos.x - h.x, P.pos.z - h.z) <= H.reachH + margin;
  }

  _canReach() { return false; } // (the strike is retired: up close he sweeps, on anything higher the hose creeps)

  _startReach() {
    if (this.direct) this._rejoin();
    this.state = 'HOSE_REACH'; this.reachPhase = 'rise'; this.reachT = 0;
    this.rattle = audio.play('vac.rattle', { follow: this.model.hoseSocket, refDistance: 1, rolloff: 1.1 });
  }

  _endReach() {
    this.reachPhase = null;
    this.rattle?.stop(0.1); this.rattle = null;
  }

  _reachDone() {
    this._endReach();
    this.reachCd = H.cooldown[this.anger - 1];
    if (this.seesCat) this._startChase(); else { this.lastX = this.player.pos.x; this.lastZ = this.player.pos.z; this._startSearch(); }
  }

  _tickReach(dt) {
    this.reachT += dt;
    if (this.reachPhase === 'rise') { // the prep: it rises, hovers, sniffs at you
      const want = Math.atan2(this.player.pos.x - this.x, this.player.pos.z - this.z), diff = wrap(want - this.heading), maxTurn = V.turnRate * dt;
      this.heading = wrap(this.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
      if (this.reachT >= H.windup) {
        if (!this._inReach(H.giveUp) || !this.seesCat) { this.reachPhase = 'stall'; this.reachT = H.stall * 0.6; this.rattle?.stop(0.1); this.rattle = null; return; } // gone: it doesn't bother
        this.reachPhase = 'charge'; this.reachT = 0; this.hose.aimAt(this._catChest(this._goal));
      }
    } else if (this.reachPhase === 'charge') { // the homing charge
      if (this.hose.tip.distanceTo(this._catChest(this._goal)) <= H.hit) { this._endReach(); this._catch('hose'); return; }
      if (this.reachT >= H.homeTime || this.hose.maxed || this.hose.stuck) this._slap();
    } else if (this.reachT >= H.stall) this._reachDone();
  }

  _slap() { // a miss: the nozzle comes down on whatever is there, and anything it sends over the edge still counts
    const t = this.hose.tip;
    audio.play('vac.slap', { pos: t });
    for (const o of this.knock.list) {
      if (o.state === 'gone') continue;
      const dx = o.x - t.x, dz = o.z - t.z, d = Math.hypot(dx, dz) || 1;
      if (d <= H.slapRadius && Math.abs(o.y - t.y) < 0.4) this.knock.shove(o, dx / d, dz / d, H.slapSpeed);
    }
    this.rattle?.stop(0.1); this.rattle = null;
    this.reachPhase = 'stall'; this.reachT = 0;
  }

  _updateHose(dt) {
    if (this.caught) return; // the catch rides the hose exactly as it was
    const cmd = this._hoseCommand();
    this.hose.tick(dt, this._hole(), this.heading, cmd);
  }

  _hoseCommand() {
    const c = this._cmd, P = this.player;
    c.hover = false; c.maxLen = undefined; c.replan = undefined; c.straight = false; c.wobble = null;
    if (this.state === 'GREET') { // a little wave of the nozzle: up in front of him like a trunk, turning with him as he turns to you
      const h = this._hole(), g = c.goal, fx = Math.sin(this.heading), fz = Math.cos(this.heading), w = Math.sin(this.time * 7) * 0.07;
      g.set(h.x + fx * FR.trunkOut - fz * w, h.y + FR.trunkUp + Math.abs(w) * 0.6, h.z + fz * FR.trunkOut + fx * w);
      c.mode = 'sweep'; c.speed = A.sniffSpeed * 1.6; // (sweep: straight from the hole, never left hanging where it was)
      return c;
    }
    if (this.state === 'LUNGE') { // reared back and up, then rammed out straight at chest height
      const h = this._hole(), g = c.goal, s = Math.sin(this.heading), co = Math.cos(this.heading);
      if (this.lungePhase === 'coil') { g.set(h.x - s * 0.12, h.y + 0.42, h.z - co * 0.12); c.mode = 'approach'; c.speed = H.riseSpeed; c.hover = true; return c; }
      const y = Math.max(0.1, Math.min(0.7, P.feetY + 0.12));
      let r = LU.reach; while (r > 0.2 && this.vox.blocked(h.x + s * r, y, h.z + co * r)) r -= 0.05;
      g.set(h.x + s * r, y, h.z + co * r); c.mode = 'sweep'; c.speed = LU.hoseSpeed;
      return c;
    }
    if (this.reachPhase === 'rise') { // up out of the hole, stopping a little short of the cat
      const h = this._hole(), g = c.goal;
      this._catChest(g);
      const dx = g.x - h.x, dy = g.y - h.y, dz = g.z - h.z, l = Math.hypot(dx, dy, dz) || 1;
      const back = this.foundT > 0 && this._catHidden() ? 0 : Math.min(H.hover, l * 0.6); // (and never behind him, if the cat is very close. Found in a hiding place: right above it, to come straight down)
      g.x -= (dx / l) * back; g.z -= (dz / l) * back;
      g.y = Math.max(H.rearMin, g.y + H.rear); // the cobra: reared up above the cat, looking down at it
      c.mode = 'approach'; c.speed = H.riseSpeed; c.hover = true;
      return c;
    }
    if (this.state === 'SUCK') { // low and side to side, passing at the cat's distance, and never into anything
      const h = this._hole(), g = c.goal, a = this.heading + SU.arc * Math.sin(this.suckPhase), s = Math.sin(a), co = Math.cos(a);
      const r = Math.max(SU.minR, Math.min(SU.reach, Math.hypot(P.pos.x - h.x, P.pos.z - h.z)));
      g.set(h.x, this.suckY, h.z);
      for (let q = r; q >= 0.2; q -= 0.05) if (!this.vox.blocked(h.x + s * q, this.suckY, h.z + co * q)) { g.x = h.x + s * q; g.z = h.z + co * q; break; }
      c.mode = 'sweep'; c.speed = SU.speed;
      return c;
    }
    if (this.state === 'ALERT') { // lifted a little toward the sound, sniffing
      const h = this._hole(), g = c.goal, dx = this.alertX - h.x, dz = this.alertZ - h.z, l = Math.hypot(dx, dz) || 1;
      g.set(h.x + (dx / l) * A.sniffOut, h.y + A.sniffUp, h.z + (dz / l) * A.sniffOut);
      c.mode = 'approach'; c.speed = A.sniffSpeed; c.hover = true;
      return c;
    }
    if (this.state === 'FOG') { // up and flailing the whole time, like an inflatable tube man: never stiff, never still
      const h = this._hole(), sp = this.fogPhase === 'spray', ph = this.fogT + (this.sprayPh ??= Math.random() * 9);
      const a = this.heading + (sp ? Math.sin(ph * F.sprayRate[0]) * F.sprayArc + Math.sin(ph * 5.3) * 0.25 : Math.sin(ph * 1.9) * 0.8 + Math.sin(ph * 4.1) * 0.2);
      const r = sp ? 0.75 + 0.35 * Math.sin(ph * 1.7) : 0.35 + 0.15 * Math.sin(ph * 2.7), y = sp ? 0.85 + 0.45 * (0.5 + 0.5 * Math.sin(ph * F.sprayRate[1])) : 1.0 + 0.18 * Math.sin(ph * 2.3);
      c.goal.set(h.x + Math.sin(a) * r, Math.min(y, LEVEL.ceiling - 0.2), h.z + Math.cos(a) * r); // waving all over, low and high
      c.mode = 'sweep'; c.speed = F.swaySpeed; c.wobble = F.wobble; // (sweep: the hose is always the way back to the hole, so it never runs out of length and locks up)
      return c;
    }
    if (this.state === 'LURK' && this.lurkPhase === 'watch') { // up, straight, quite still: watching you
      const h = this._hole(), fx = Math.sin(this.heading), fz = Math.cos(this.heading), sway = Math.sin(this.time * 0.9) * 0.02;
      c.goal.set(h.x + fx * 0.14 - fz * sway, h.y + LK.hoseUp, h.z + fz * 0.14 + fx * sway); c.mode = 'sweep'; c.speed = 1.2;
      return c;
    }
    if (this.state === 'CHASE' && this.peekT > 0) { // right behind you: the nozzle comes past you, at the very edge of your view, snapping
      const cam = this.camera.position, f = this.camera.getWorldDirection(_s), rx = -f.z, rz = f.x, rl = Math.hypot(rx, rz) || 1, a = this.anger - 1, snap = Math.sin(this.time * PK.snapRate) * PK.snap;
      c.goal.set(cam.x + f.x * (PK.ahead[a] + snap) + (rx / rl) * this.peekSide * PK.side, Math.max(H.floorY, cam.y + PK.down), cam.z + f.z * (PK.ahead[a] + snap) + (rz / rl) * this.peekSide * PK.side);
      c.mode = 'sweep'; c.speed = PK.speed;
      return c;
    }
    if (this.state === 'CREEP') { // the long way, slowly
      this._catChest(c.goal); c.mode = 'approach'; c.speed = CR.speed * Math.min(CR.maxBoost, 1 + CR.perKnock * this.knock.count); c.maxLen = CR.length; c.replan = CR.replan; c.straight = true;
      return c;
    }
    if (this.blastPhase) { // lifted and pointed at the cat, and held there a moment after it fires
      const h = this._hole(), g = c.goal;
      this._catChest(g);
      const dx = g.x - h.x, dz = g.z - h.z, l = Math.hypot(dx, dz) || 1, out = this.lob ? B.lobAimOut : B.aimOut, up = this.lob ? B.lobAimUp : B.aimUp;
      g.set(h.x + (dx / l) * out, h.y + up, h.z + (dz / l) * out);
      c.mode = 'approach'; c.speed = H.riseSpeed; c.hover = false;
      return c;
    }
    if (this.reachPhase === 'charge') { c.mode = 'home'; this._catChest(c.goal); c.speed = H.homeSpeed; c.turn = H.homeTurn; return c; }
    if (this.state === 'CLEAN' && this.mess && this.cleanFacing) { // the nozzle goes to the mess, and circles over it as it sucks
      const k = this.cleanT > 0 ? V.cleanCircle : 0, a = this.time * 6;
      c.mode = 'approach'; c.goal.set(this.mess.x + Math.cos(a) * k, 0.07, this.mess.z + Math.sin(a) * k); c.speed = H.cleanSpeed; return c;
    }
    void P;
    return null;
  }

  /** Off the graph, the cord bends round whatever he has gone past rather than cutting through it. */
  _guardCord() {
    const T = this.tether, top = T[T.length - 1], len = Math.hypot(this.x - top.x, this.z - top.z), steps = Math.ceil(len / 0.08);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.world.penetration(top.x + (this.x - top.x) * t, top.z + (this.z - top.z) * t, 0.02, 0.005, 0.03) > 0) { T.push({ x: this.px, z: this.pz, virtual: true }); return; }
    }
  }

  /** Right behind you and you're running from him: now and then his nozzle comes past you at the edge of the view. */
  _tickPeek(dt) {
    if (this.peekT > 0) { this.peekT -= dt; if (this.peekT <= 0) this.peekCd = PK.every[this.anger - 1] * (0.7 + Math.random() * 0.6); return; }
    if (this.peekCd > 0) { this.peekCd -= dt; return; }
    const P = this.player, a = this.anger - 1, d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z);
    if (d > PK.reach[a] || P.feetY > 0.5 || P.noclip) return;
    const f = this.camera.getWorldDirection(_s), away = ((this.x - P.pos.x) * f.x + (this.z - P.pos.z) * f.z) / (d || 1) < -0.3; // (he's behind you)
    if (away) { this.peekT = PK.hold[a]; this.peekSide = -this.peekSide; }
  }

  _tickChase(dt) {
    this._tickPeek(dt);
    // lost you round a corner... and then there you are again: he lunges round it, all at once
    if (this.seesCat) { if (this.lostFor >= BU.lost && this.burstCd <= 0 && this.anger >= BU.minAnger) { this.burstT = BU.time; this.burstCd = BU.cooldown[this.anger - 1]; this._shriek(true); audio.play('vac.surge', { follow: this.model.hoseSocket, rolloff: 0, rate: 1.3 }); } this.lostFor = 0; }
    else this.lostFor += dt;
    if (this.burstT > 0) this.burstT -= dt;
    if (this.burstCd > 0) this.burstCd -= dt;
    if (this._canSuck()) { this._startSuck(); return; }
    if (this._canLunge()) { this._startLunge(); return; }
    if (this._canReach()) { this._startReach(); return; }
    if (this._canFog()) { this._startFog(); return; }
    if (this._canBlast()) { this._startBlast(); return; }
    if (this.seesCat) this.loseT = 0; else this.loseT += dt;
    if (this.loseT >= (this.player.slink > 0.5 ? V.hideLose : V.loseTime)) { if (this._canCreep()) this._startCreep(); else this._startSearch(); return; } // gone to ground somewhere high: he knows where you went
    // staring up at a cat he can't get to: the long hose, and if that fails he gives up and goes back to work
    if (this.seesCat && this.player.feetY >= CR.minHeight) { // up on something: the hose comes for it
      this.campT += dt;
      if (this.campT >= CR.after && this._canCreep()) { this._startCreep(); return; }
      if (this.campT >= V.campTime) { this.campT = 0; this.ignoreT = V.ignoreTime; this._giveUp(); return; }
    } else if ((this.seesCat || this.foundT > 0) && this._catUnder()) { // under something he can't get under: the hose goes in after it
      this.campT += dt;
      if (this.campT >= CR.under && this._canCreep()) { this._startCreep(); return; }
    } else this.campT = 0;
    this.replanT -= dt;
    if (this.replanT <= 0) {
      this.replanT = V.replan;
      // a cat up on something can't be driven at: he parks within hose range of it instead
      const perched = this.player.feetY >= H.minPerch, dx = this.x - this.lastX, dz = this.z - this.lastZ, d = Math.hypot(dx, dz) || 1;
      this.directX = perched ? this.lastX + (dx / d) * H.standoff : this.lastX;
      this.directZ = perched ? this.lastZ + (dz / d) * H.standoff : this.lastZ;
      this.directOK = this.seesCat && this._clear(this.directX, this.directZ);
      if (!this.directOK && !perched) for (let i = this.crumbs.length - 1; i >= 0; i--) { const c = this.crumbs[i]; if (Math.hypot(c.x - this.x, c.z - this.z) > V.arrive && this._clear(c.x, c.z)) { this.directX = c.x; this.directZ = c.z; this.directOK = true; break; } } // (hugging the corner doesn't shake him off: he goes the way you went)
      if (this.directOK) { this.direct = true; this._guardCord(); }
      else {
        if (this.direct) this._rejoin();
        const n = this.nav.nearest(this.lastX, this.lastZ);
        if (n !== this.chaseNode) { this.chaseNode = n; this.routeTo(n); }
      }
    }
    const speed = this.burstT > 0 ? BU.speed : V.chaseSpeed[this.anger - 1];
    if (this.direct) { // the cord still only goes so far
      if (this._paid() < C.length - 0.05 && Math.hypot(this.directX - this.x, this.directZ - this.z) > V.arrive) this._steer(dt, this.directX, this.directZ, speed);
      return;
    }
    this._followPath(dt, speed);
  }

  _giveUp() {
    if (this.direct) this._rejoin();
    const next = this._nextKnownMess();
    if (next) { this.state = 'INVESTIGATE'; this.routeTo(this.nav.nearest(next.x, next.z)); } else this._resumePatrol();
  }

  /** From angry on, now and then (and always in his own dust) he comes for you slowly and almost silently. */
  _maybeStalk() { const K = TUNING.stalk; this.stalk = this.anger >= 3 && (this.cloud.active || Math.random() < K.chance); }

  /** more: another place to look (a hunch where you went), after the first. */
  _startSearch(more = false) {
    if (this.direct) this._rejoin();
    if (!more) this.searchLeft = V.searchRounds[this.anger - 1];
    this.state = 'SEARCH'; this.sweep = false; this.seeT = 0; this._maybeStalk();
    this.routeTo(this.nav.nearest(this.lastX, this.lastZ));
    if (this.searchSayCd <= 0 && Math.random() < 0.7) { this.searchSayCd = TUNING.voice.searchEvery; this._say(this.anger >= 5 ? 'search5' : 'search'); } // "Come out, kitty kitty."
  }

  _tickSweep(dt) { // at the spot: he turns on the spot, looking
    this.sweepPh += V.searchTurn * dt;
    this.heading = wrap(this.sweepBase + Math.sin(this.sweepPh) * V.searchArc); // side to side, the way something looks around
    this.sweepT -= dt;
    if (this.searchSayCd <= 0 && Math.random() < dt * 0.6) { this.searchSayCd = TUNING.voice.searchEvery; this._say(this.anger >= 5 ? 'search5' : 'search'); }
    if (this.sweepT > 0) return;
    this.sweep = false;
    if (this.searchLeft > 0 && !this.player.noclip) { // not there: he tries somewhere near where you really are
      this.searchLeft--;
      const P = this.player, a = Math.random() * Math.PI * 2, g = V.searchGuess * Math.random();
      this.lastX = P.pos.x + Math.cos(a) * g; this.lastZ = P.pos.z + Math.sin(a) * g;
      this._startSearch(true);
    } else this._resumePatrol();
  }

  /** His body touching a cat on the floor. */
  _touching() {
    const P = this.player;
    if (this.anger <= V.harmlessAt) return false; // neutral and annoyed: harmless
    if (P.slink > 0.5 && !this.seesCat && this.anger <= V.sneakAnger) return false; // crouched and unseen: he doesn't know you're there
    return !P.noclip && P.feetY < V.catchHeight && Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < V.radius + V.catchReach;
  }

  _catch(how) {
    this._endReach(); this._endBlast(); this._endSuck(); this._endCreep(); this._endFog(); this.cloud.thin(); for (const b of this.blasts) b.reset();
    if (how === 'snap') this.hose.snap(this._hole(), this.heading, this._catChest(this._goal)); // it's always the nozzle that gets you
    this.caught = true; this.state = 'CATCH';
    this.slurp?.stop(0.05); this.slurp = null;
    this.onCatch?.(how);
  }

  /** Turn toward a point and glide. Full speed when pointed the right way; he swings round almost on the spot when he isn't. */
  _steer(dt, tx, tz, speed) {
    const want = Math.atan2(tx - this.x, tz - this.z), diff = wrap(want - this.heading), maxTurn = V.turnRate * dt;
    this.heading = wrap(this.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
    const s = speed * Math.max(0, Math.cos(diff));
    this.x += Math.sin(this.heading) * s * dt;
    this.z += Math.cos(this.heading) * s * dt;
    this.world.resolve(this, V.radius - 0.02, 0.03, V.height, null, 2, 0.03); // (cutting a corner, he slides along it rather than into it)
  }

  _followPath(dt, speed) {
    let target = this.path[this.pathI];
    if (Math.hypot(target.x - this.x, target.z - this.z) < V.arrive) {
      this._arrived(target);
      if (this.pathI >= this.path.length - 1) {
        this._routeEnd();
        if (this.state === 'CLEAN' || this.sweep || this.state === 'CHASE') return;
      } else this.pathI++;
      target = this.path[this.pathI];
    }
    this._steer(dt, target.x, target.z, speed);
  }

  /** The end of the route he was on. */
  _routeEnd() {
    if (this.state === 'CHASE') return;
    if (this.state === 'LURK') { // there: watch. Gone: back to work
      if (this.lurkPhase === 'go') { this.lurkPhase = 'watch'; this.lurkT = between(LK.watch); this.lookT = 0; }
      else { this.lurkPhase = null; this.stalk = false; this._resumePatrol(); }
      return;
    } // waits there: the replanning decides what's next
    if (this.state === 'SEARCH') { this.sweep = true; this.sweepT = V.searchTime; this.sweepBase = this.heading; this.sweepPh = 0; this._checkHides(); return; }
    if (this.state === 'INVESTIGATE' && this.ambush) { // in place: the hose goes in after you, wherever you are
      this.foundT = CR.maxTime; this.creepCd = 0; this.lastX = this.player.pos.x; this.lastZ = this.player.pos.z;
      if (Math.hypot(this.player.pos.x - this.x, this.player.pos.z - this.z) < CR.range) { this._startCreep(); return; }
      this.ambush = false; this._resumePatrol(); return;
    }
    if (this.state === 'INVESTIGATE') {
      this.rush = false;
      if (this._checkHides()) return;
      const m = this._nearestMess(V.cleanReach, false);
      if (m) this._startClean(m); else this._resumePatrol();
      return;
    }
    this._nextLeg();
  }

  /** Reached a waypoint: the cord now lies to here, or, if he came back over it, has reeled in to here. */
  _arrived(n) {
    this.seenAt.set(n, this.time);
    const T = this.tether;
    if (T[T.length - 1] === n) return;
    if (T.length >= 2 && T[T.length - 2] === n) T.pop(); else T.push(n);
  }

  /** Per fixed tick. */
  tick(dt) {
    if (this.dormant) return;
    this.time += dt;
    this.px = this.x; this.pz = this.z; this.prevHeading = this.heading;
    for (const k of ['alertCd', 'heardCd', 'stingCd', 'shriekCd', 'creepCd', 'stunCd', 'foundT', 'sayCd', 'huffCd', 'greetCd', 'chatCd', 'lungeCd', 'pokeCd', 'shhCd', 'searchSayCd', 'arcFade', 'lurkCd', 'ambushCd']) if (this[k] > 0) this[k] -= dt;
    if (this.fogCd > 0 && !this.cloud.active) this.fogCd -= dt;
    this.cloud.tick(dt);
    if (!this.frozen) this._bump();
    this._updateDrone(dt);
    this._updateHose(dt);
    if (this.reachCd > 0) this.reachCd -= dt;
    if (this.blastCd > 0) this.blastCd -= dt;
    if (!this.caught) for (const b of this.blasts) b.tick(dt, this.player);
    if (this.plugLock > 0) this.plugLock -= dt;
    if (this.plugState !== 'in' && !this.off && !this.frozen) { this._tickPlug(dt); return; }
    if (this.frozen || this.off || this.caught) return;
    if (this.stunT > 0) { this.stunT -= dt; return; } // reeling
    this._perceive(dt);
    this._tickCalm(dt);
    this._tickUncanny(dt);
    if (this._touching()) { this._catch('snap'); return; }
    if (this.freezeT > 0 && !this._attacking()) { // caught your eye: dead still for a moment, staring back
      this.freezeT -= dt;
      const P = this.player, want = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), diff = wrap(want - this.heading), turn = V.turnRate * dt;
      this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, diff)));
      return;
    }
    this._stuckCheck(dt);
    if (this.state === 'SURGE') { this._tickSurge(dt); return; }
    if (this.state === 'GREET') { this._tickGreet(dt); return; }
    if (this.state === 'LURK') { this._tickLurk(dt); return; }
    if (this.state === 'LUNGE') { this._tickLunge(dt); return; }
    if (this.state === 'TURN') { this._tickTurn(dt); return; }
    if (this.state === 'HUFF') { this._tickHuff(dt); return; }
    if (this.state === 'ALERT') { this._tickAlert(dt); return; }
    if (this.state === 'PAUSE') { this._tickPause(dt); return; }
    if (this.state === 'FOG') { this._tickFog(dt); return; }
    if (this.state === 'CREEP') { this._tickCreep(dt); return; }
    if (this.state === 'HOSE_REACH') { this._tickReach(dt); return; }
    if (this.state === 'BLAST') { this._tickBlast(dt); return; }
    if (this.state === 'SUCK') { this._tickSuck(dt); return; }
    if (this.state === 'CHASE') { this._tickChase(dt); return; }
    if (this.state === 'CLEAN') { this._tickClean(dt); return; }
    if (this.state === 'SEARCH' && this.sweep) { this._tickSweep(dt); return; }
    this.spotT -= dt;
    if (this.spotT <= 0 && this.state !== 'SEARCH') { // a mess right in front of him stops him on his way
      this.spotT = V.spotEvery;
      const m = this._nearestMess(V.cleanSee, true);
      if (m) { this._startClean(m); return; }
    }
    if (this.state === 'PATROL') { this.thinkT -= dt; if (this.thinkT <= 0) { this._think(); if (this.state !== 'PATROL') return; } }
    const pile = this.state === 'INVESTIGATE' || this.state === 'PATROL' ? Math.min(V.messMax, 1 + V.messBoost * Math.max(0, this.debris.messes.filter((m) => !m.cleaned).length - 1)) : 1;
    const rampage = Math.max(pile, this.state !== 'INVESTIGATE' ? 1 : Math.min(V.streakMax, 1 + V.streakBoost * Math.max(0, this.streak.filter((t) => this.time - t < V.streakWindow).length - 1))); // (break things one after another, or leave a pile of them, and he comes running)
    this._followPath(dt, this.rush && this.state === 'INVESTIGATE' ? V.rushSpeed * Math.max(1, rampage * 0.8) : rampage * V.speed[this.anger - 1] * (this.state === 'PATROL' ? 1 : V.investigateMul) * (this.stalk && this.state !== 'PATROL' ? TUNING.stalk.speed : 1));
  }

  /** Per rendered frame. */
  frame(alpha, dt = 1 / 60) {
    const r = this.model.root;
    this.model.animate(dt, this.state === 'ALERT' || this.freezeT > 0);
    // electricity crawls over him only in the surge's cut, and a moment after: in the dark it's his eyes that do it
    this.model.arcsOn(this.state === 'SURGE' && this.surgeT >= SG.cutOutlet ? 1 : this.arcFade > 0 ? this.arcFade / SG.arcAfter : 0);
    this.cloud.frame(dt, this.camera.position);
    r.position.set(this.px + (this.x - this.px) * alpha, 0, this.pz + (this.z - this.pz) * alpha);
    r.rotation.y = this.prevHeading + wrap(this.heading - this.prevHeading) * alpha;
    if (this.caught && this.tremble) { r.position.x += (Math.random() - 0.5) * 2 * this.tremble; r.position.z += (Math.random() - 0.5) * 2 * this.tremble; }
    { const B = this.hose.body || (this.hose.body = {}); B.x = r.position.x; B.z = r.position.z; B.r = V.model.bodyR * (this.model.w ?? 1); B.top = V.height * this.model.k; }
    this.hose.frame(alpha, this.camera.position);
    for (const b of this.blasts) b.frame(alpha);
    const paid = this._paid();
    this.spin += (paid - this.lastPaid) / 0.07; this.lastPaid = paid; // the reel turns as cord goes out or comes in
    this.model.setReel(Math.min(1, (paid / C.length) * (1 - this.cord.trim)), this.spin + this.cord.trim * 40);
    r.updateMatrixWorld(true);
    this.model.cordSocket.getWorldPosition(_s);
    const T = this.tether;
    this.cord.frame(T, this._retracing() ? T.length - 1 : T.length, r.position.x, r.position.z, _s.x, _s.y, _s.z);
    if (this.hidden || this.noCord) { this.cord.mesh.visible = false; this.cord.plug.visible = false; }
  }
}
