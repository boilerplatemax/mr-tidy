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

const V = TUNING.vac, D = TUNING.drone, C = TUNING.cord, H = TUNING.hose, B = TUNING.blast, SU = TUNING.suck, A = TUNING.alert, RO = TUNING.roam, ST = TUNING.sting, CR = TUNING.creep, F = TUNING.fog, SG = TUNING.surge;
const between = ([a, b]) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _s = new THREE.Vector3();

export class Vacuum {
  constructor({ scene, world, camera, noise, knock, debris, player }) {
    this.world = world; this.knock = knock; this.debris = debris; this.camera = camera; this.player = player;
    this.vox = new Voxels(world); this.hose = new Hose(scene, this.vox); this.blast = new Blast(scene, this.vox, knock); this.blast.onHit = (dx, dz) => player.dustHit(dx, dz); this.blasts = [this.blast, ...Array.from({ length: 4 }, () => { const b = new Blast(scene, this.vox, knock); b.onHit = this.blast.onHit; return b; })]; this.spotted = 0; this.volley = 0; this.volleyT = 0; this.sprayT = 0; this.coughI = 0; this.dark = 0; this.surgeT = 0; this.arcV = null; this.sweepBase = 0; this.sweepPh = 0; this.cloud = new DustCloud(scene); this.lob = false; this._v = new THREE.Vector3();
    this.fogPhase = null; this.fogT = 0; this.fogCd = 0; this.creepT = 0; this.creepCd = 0; this.creepV = null; this.alertT = 0; this.alertX = 0; this.alertZ = 0; this.alertCd = 0; this.heardCd = 0; this.stingCd = 0; this.shriekCd = 0; this.freezeT = 0; this.dip = 0; this.thinkT = between(RO.think); this.pauseT = 0; this.pauseYaw = 0; this.pauseThen = null; this.time = 0; this.seenAt = new Map(); this.noises = []; this.lastStop = null; this.blastPhase = null; this.blastT = 0; this.blastCd = 0; this.suckT = 0; this.suckPhase = 0; this.suckY = 0; this.suckV = null; this.coughV = null; this._blastDir = new THREE.Vector3(); this._blastO = new THREE.Vector3(); this.cleanWait = 0; this._cmd = { mode: 'approach', goal: new THREE.Vector3(), speed: 0, turn: 0, hover: false }; this.reachPhase = null; this.reachT = 0; this.reachCd = 0; this.rattle = null; this._snap = new THREE.Vector3(); this._goal = new THREE.Vector3(); this.directX = 0; this.directZ = 0;
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
  reset() {
    const start = this.nav.nodes.get(LEVEL.vacStart), o = LEVEL.outlets[0];
    this.slurp?.stop(0.05); this.slurp = null;
    this._endReach();
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
    this.spotted = 0; this.dark = 0; this.arcV?.stop(0.05); this.arcV = null; this.surgeT = 0; this.volley = 0; for (const b of this.blasts) b.reset(); this.stunT = 0; this.stunCd = 0; this.foundT = 0; this.fogCd = 0; this.creepCd = 0; this.alertCd = 0; this.heardCd = 0; this.stingCd = 0; this.shriekCd = 0; this.freezeT = 0; this.dip = 0; this.thinkT = between(RO.think); this.pauseThen = null; this.seenAt.clear(); this.noises.length = 0; this.lastStop = null; this.model.shriekT = 0; this.model.flick = 0;
    this.model.face.visible = true;
    this.setAnger(1);
    this.anger = 1; this.model.setFace(1);
    if (!this.voice) this.startSound();
    else { this.voice.fadeTo(this.droneLevel(10), 0.1); this.voice.setRate(D.rate[0], 0.1); }
  }

  /** Anger level 1–3: his face, his speed, the pitch of his motor. */
  setAnger(level) {
    const was = this.anger;
    this.anger = Math.max(1, Math.min(5, level));
    this.model.setFace(this.anger);
    if (this.anger > was) { this.model.flicker(); if (this.anger === 4) this._shriek(true); if (this.anger === 5) this._startSurge(); }
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
    this._endReach(); this._endBlast(); this._endSuck(); this._endCreep(); this._endFog();
    this.surgeReturn = this.state === 'CHASE' || this._attacking() ? 'CHASE' : 'PATROL';
    this.state = 'SURGE'; this.surgeT = 0;
    this._shriek(true);
    audio.play('vac.surgeBuzz');
  }

  _tickSurge(dt) {
    const was = this.surgeT;
    this.surgeT += dt;
    this.dark = this.surgeT < SG.flickerUntil ? (Math.random() < 0.18 + 0.5 * (this.surgeT / SG.flickerUntil) ? 1 : 0) : 1; // stuttering, more dark than light, then gone
    if (was < SG.flickerUntil && this.surgeT >= SG.flickerUntil) { audio.play('power.out'); this.arcV = audio.play('vac.arc', { follow: this.model.hoseSocket, refDistance: 1.2, rolloff: 1.1 }); }
    if (this.surgeT >= SG.time) { this.state = this.surgeReturn; this.loseT = 0; if (this.state === 'CHASE') { this.lastX = this.player.pos.x; this.lastZ = this.player.pos.z; } }
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
  startSound() {
    if (this.off || this.voice) return;
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
    const dipTo = this.stunT > 0 ? 0.85 : this.state === 'ALERT' ? A.dip : this.state === 'CREEP' ? 1 - CR.motor : this.state === 'PAUSE' ? A.dip * 0.45 : 0;
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

  /** Everything stops: the motor winds down and the face goes dark. */
  powerDown() {
    this.arcV?.stop(0.2); this.arcV = null;
    this._endReach(); this._endBlast(); this._endSuck(); this._endCreep(); this._endFog(); this.cloud.thin();
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
    const here = this.nav.nearest(this.x, this.z);
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
      if (along[k] + len > C.length) continue;
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

  // ---- he heard something: he stops dead, the motor falls away, the nozzle lifts toward it
  _startAlert(x, z) {
    this.state = 'ALERT'; this.alertT = A.time[this.anger - 1]; this.alertCd = A.cooldown; this.alertX = x; this.alertZ = z;
    audio.play('vac.listen', { follow: this.model.hoseSocket, refDistance: 3, rolloff: 0.6 });
    if (this.heardCd <= 0) { this.heardCd = A.stingEvery; audio.play('sting.heard'); }
  }

  _tickAlert(dt) {
    const want = Math.atan2(this.alertX - this.x, this.alertZ - this.z), diff = wrap(want - this.heading), turn = V.turnRate * dt;
    this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, diff)));
    this.alertT -= dt;
    if (this.alertT > 0) return;
    this.state = 'INVESTIGATE';
    this.routeTo(this.nav.nearest(this.alertX, this.alertZ));
  }

  // ---- the long reach: a hose that comes for a cat hiding up high, slowly
  _canCreep() {
    const P = this.player, h = this._hole();
    return !P.noclip && this.anger >= CR.minAnger && this.creepCd <= 0 && P.feetY >= CR.minHeight && Math.hypot(P.pos.x - h.x, P.feetY + 0.12 - h.y, P.pos.z - h.z) <= CR.range;
  }

  _startCreep() {
    if (this.direct) this._rejoin();
    this.state = 'CREEP'; this.creepT = 0; this.campT = 0;
    this.creepV = audio.play('vac.creep', { follow: this.hose.nozzle, refDistance: 0.8, rolloff: 1.2 });
  }

  _endCreep() { this.creepV?.stop(0.2); this.creepV = null; }

  _creepOver() { this._endCreep(); this.creepCd = CR.cooldown[this.anger - 1]; }

  _tickCreep(dt) {
    const P = this.player, want = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), diff = wrap(want - this.heading), turn = V.turnRate * 0.4 * dt;
    this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, diff)));
    this.creepT += dt;
    if (this.hose.tip.distanceTo(this._catChest(this._goal)) <= H.hit + 0.02) { this._creepOver(); this._catch('hose'); return; }
    if (P.feetY < CR.floorY) { this._creepOver(); this.lastX = P.pos.x; this.lastZ = P.pos.z; this._startChase(); return; } // it came down: forget the hose
    if (this.creepT >= CR.maxTime || this.hose.maxed || this.hose.stuck) { this._creepOver(); this.ignoreT = V.ignoreTime * 0.5; this._giveUp(); }
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
      if (this.sprayT <= 0) { this.sprayT = F.sprayEvery; const a = this.hose.pts[this.hose.n - 1], dx = t.x - a.x, dy = t.y - a.y, dz = t.z - a.z, l = Math.hypot(dx, dy, dz) || 1; this.cloud.emit(t.x, t.y, t.z, dx / l, dy / l, dz / l, F.spraySpeed); }
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
    this._startChase();
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
    h.x = this.x + Math.sin(this.heading) * M.holeZ; h.y = this.model.holeY(); h.z = this.z + Math.cos(this.heading) * M.holeZ;
    return h;
  }

  _hear(ev) {
    if (this.off || this.plugState !== 'in') return;
    if (ev.kind === 'crash') { // every knock-over can raise his anger, whether he hears it or not
      const c = this.knock.count, A = V.angerAt, want = c >= A[3] ? 5 : c >= A[2] ? 4 : c >= A[1] ? 3 : c >= A[0] ? 2 : 1;
      if (want > this.anger) this.setAnger(want);
    }
    if (ev.kind === 'crash') { this.noises.push({ x: ev.x, z: ev.z, t: this.time }); while (this.noises.length && this.time - this.noises[0].t > RO.noiseLasts) this.noises.shift(); }
    const d = Math.hypot(ev.x - this.x, ev.z - this.z);
    const heard = ev.kind === 'crash' ? this.anger >= 3 || (this.anger === 2 && d <= V.hearNear)
      : ev.kind === 'thud' ? this.anger >= 2 && d <= (ev.radius ?? V.hearLand[0]) // a landing gives away where you are
        : this.anger >= 3 && d <= (ev.gait === 'walk' ? V.hearWalk : V.hearSteps);
    if (!heard) return;
    if (ev.kind === 'crash') { const m = this.debris.messes.find((x) => x.id === ev.objectId); if (m) m.known = true; } // on his to-do list now
    this._investigate(ev.x, ev.z);
  }

  _investigate(x, z) {
    if (this.state === 'CHASE') { if (!this.seesCat) { this.lastX = x; this.lastZ = z; } return; } // something to go on while he has lost sight of you
    if (this._attacking()) return; // busy: a crash doesn't pull him off an attack (his own can cause one)
    if (this.state === 'CLEAN') { this.pending = { x, z }; return; } // he finishes the job in hand first
    if (this.state === 'ALERT') { this.alertX = x; this.alertZ = z; return; } // (already listening: it's that way)
    if (this.alertCd <= 0) { this._startAlert(x, z); return; }
    this.state = 'INVESTIGATE';
    this.routeTo(this.nav.nearest(x, z));
  }

  _attacking() { const s = this.state; return s === 'SURGE' || s === 'HOSE_REACH' || s === 'BLAST' || s === 'SUCK' || s === 'FOG' || s === 'CREEP'; }

  routeTo(node) { // (if the new route carries on the way he's already going, he doesn't turn back to the last waypoint first)
    const cur = this.path[this.pathI];
    this.path = this.planTo(node);
    this.pathI = this.path.length > 1 && this.path[1] === cur ? 1 : 0;
  }

  /** Back to the patrol, at whichever stop of the loop is nearest. */
  _resumePatrol() {
    this.state = 'PATROL';
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

  _startClean(m) {
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
    if (!this.cleanFacing || (!this.hose.arrived && this.cleanWait < H.cleanTimeout)) { this.cleanWait += dt; return; }
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
  _canSee() {
    const P = this.player;
    if (P.noclip) return false;
    if (this._catHidden()) return this.foundT > 0; // tucked away: he can't see you unless he has found you
    const dx = P.pos.x - this.x, dz = P.pos.z - this.z, d = Math.hypot(dx, dz) || 1;
    const slinking = P.slink > 0.5;
    if (d > V.sightRange[this.anger - 1] * (slinking ? V.slinkSight : 1) * (P.feetY >= H.minPerch ? V.perchSight : 1) * (this.state === 'CLEAN' ? V.cleanSight : 1)) return false;
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
    if (this.seesCat && this.anger >= 3 && this.stingCd <= 0 && !this._attacking()) { // eye contact: you're looking at him, and he's looking at you
      const c = this.camera; c.getWorldDirection(_s);
      const dx = this.x - c.position.x, dy = 0.2 - c.position.y, dz = this.z - c.position.z, l = Math.hypot(dx, dy, dz) || 1;
      if ((dx * _s.x + dy * _s.y + dz * _s.z) / l > ST.eyeCos) { this._sting(); this.freezeT = ST.freeze; }
    }
    if (this.state === 'CHASE' || this._attacking()) return;
    if (this.ignoreT > 0) { this.ignoreT -= dt; this.seeT = 0; return; } // recently gave up on this cat
    this.seeT = this.seesCat ? this.seeT + dt : Math.max(0, this.seeT - dt);
    if (this.seeT >= V.noticeTime[this.anger - 1] * (this.player.slink > 0.5 ? V.slinkNotice : 1)) this._startChase();
  }

  _startChase() {
    if (this.state === 'CLEAN') { this.slurp?.stop(0.1); this.slurp = null; this.mess = null; }
    this.spotted++;
    this.pending = null; this.state = 'CHASE'; this.loseT = 0; this.replanT = 0; this.chaseNode = null; this.seeT = 0; this.sweep = false;
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

  _canSuck() { return !this._catHidden() && this.anger >= SU.minAnger && this.seesCat && this.player.feetY <= SU.maxY && this._catFromHole() <= SU.enter; }

  _startSuck() {
    if (this.direct) this._rejoin();
    const P = this.player;
    this.state = 'SUCK'; this.suckT = 0; this.loseT = 0; this.suckY = P.feetY + 0.12;
    this.suckPhase = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2; // it starts out to one side
    this.suckV = audio.play('vac.slurp', { follow: this.model.hoseSocket, rolloff: 0 });
  }

  _endSuck() { this.suckV?.stop(0.1); this.suckV = null; }

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

  // ---- the dust blast
  _canBlast() {
    if (this.anger < B.minAnger || this.blastCd > 0 || !this.seesCat || this.blasts.some((b) => b.active)) return false;
    const P = this.player, h = this._hole(), d = Math.hypot(P.pos.x - h.x, P.feetY + 0.12 - h.y, P.pos.z - h.z);
    return d >= B.minRange && d <= B.range && !(this.reachCd <= 0 && this._inReach(0)); // the strike comes first, if it's available
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

  _canReach() { return this.anger >= H.minAnger && this.reachCd <= 0 && this.seesCat && this._inReach(0); }

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
    c.hover = false; c.maxLen = undefined; c.replan = undefined; c.straight = false;
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
    if (this.state === 'FOG') { // straight up, and then swinging round as it pours out
      const h = this._hole(), s0 = this.fogPhase === 'spray' ? Math.sin(this.fogT * 3.2) * 0.8 : 0, a = this.heading + s0;
      c.goal.set(h.x + Math.sin(a) * 0.5, Math.min(1.25, LEVEL.ceiling - 0.2), h.z + Math.cos(a) * 0.5);
      c.mode = 'approach'; c.speed = H.riseSpeed; c.hover = true;
      return c;
    }
    if (this.state === 'CREEP') { // the long way, slowly
      this._catChest(c.goal); c.mode = 'approach'; c.speed = CR.speed; c.maxLen = CR.length; c.replan = CR.replan; c.straight = true;
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
    if (this.state === 'CLEAN' && this.mess && this.cleanFacing) { c.mode = 'approach'; c.goal.set(this.mess.x, 0.09, this.mess.z); c.speed = H.cleanSpeed; return c; } // the nozzle goes to the mess
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

  _tickChase(dt) {
    if (this._canSuck()) { this._startSuck(); return; }
    if (this._canReach()) { this._startReach(); return; }
    if (this._canFog()) { this._startFog(); return; }
    if (this._canBlast()) { this._startBlast(); return; }
    if (this.seesCat) this.loseT = 0; else this.loseT += dt;
    if (this.loseT >= (this.player.slink > 0.5 ? V.hideLose : V.loseTime)) { if (this._canCreep()) this._startCreep(); else this._startSearch(); return; } // gone to ground somewhere high: he knows where you went
    // staring up at a cat he can't get to: the long hose, and if that fails he gives up and goes back to work
    if (this.seesCat && this.player.feetY > H.reachTop) {
      this.campT += dt;
      if (this.campT >= CR.after && this._canCreep()) { this._startCreep(); return; }
      if (this.campT >= V.campTime) { this.campT = 0; this.ignoreT = V.ignoreTime; this._giveUp(); return; }
    } else this.campT = 0;
    this.replanT -= dt;
    if (this.replanT <= 0) {
      this.replanT = V.replan;
      // a cat up on something can't be driven at: he parks within hose range of it instead
      const perched = this.player.feetY >= H.minPerch, dx = this.x - this.lastX, dz = this.z - this.lastZ, d = Math.hypot(dx, dz) || 1;
      this.directX = perched ? this.lastX + (dx / d) * H.standoff : this.lastX;
      this.directZ = perched ? this.lastZ + (dz / d) * H.standoff : this.lastZ;
      this.directOK = this.seesCat && this._clear(this.directX, this.directZ);
      if (this.directOK) { this.direct = true; this._guardCord(); }
      else {
        if (this.direct) this._rejoin();
        const n = this.nav.nearest(this.lastX, this.lastZ);
        if (n !== this.chaseNode) { this.chaseNode = n; this.routeTo(n); }
      }
    }
    const speed = V.chaseSpeed[this.anger - 1];
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

  _startSearch() {
    if (this.direct) this._rejoin();
    this.state = 'SEARCH'; this.sweep = false; this.seeT = 0;
    this.routeTo(this.nav.nearest(this.lastX, this.lastZ));
  }

  _tickSweep(dt) { // at the spot: he turns on the spot, looking
    this.sweepPh += V.searchTurn * dt;
    this.heading = wrap(this.sweepBase + Math.sin(this.sweepPh) * V.searchArc); // side to side, the way something looks around
    this.sweepT -= dt;
    if (this.sweepT <= 0) { this.sweep = false; this._resumePatrol(); }
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
    if (this.state === 'CHASE') return; // waits there: the replanning decides what's next
    if (this.state === 'SEARCH') { this.sweep = true; this.sweepT = V.searchTime; this.sweepBase = this.heading; this.sweepPh = 0; this._checkHides(); return; }
    if (this.state === 'INVESTIGATE') {
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
    this.time += dt;
    this.px = this.x; this.pz = this.z; this.prevHeading = this.heading;
    for (const k of ['alertCd', 'heardCd', 'stingCd', 'shriekCd', 'creepCd', 'stunCd', 'foundT']) if (this[k] > 0) this[k] -= dt;
    if (this.fogCd > 0 && !this.cloud.active) this.fogCd -= dt;
    this.cloud.tick(dt);
    if (!this.frozen) this._bump();
    this._updateDrone(dt);
    this._updateHose(dt);
    if (this.reachCd > 0) this.reachCd -= dt;
    if (this.blastCd > 0) this.blastCd -= dt;
    if (!this.caught) for (const b of this.blasts) b.tick(dt, this.player);
    if (this.plugLock > 0) this.plugLock -= dt;
    if (this.plugState !== 'in' && !this.off) { this._tickPlug(dt); return; }
    if (this.frozen || this.off || this.caught) return;
    if (this.stunT > 0) { this.stunT -= dt; return; } // reeling
    this._perceive(dt);
    if (this._touching()) { this._catch('snap'); return; }
    if (this.freezeT > 0 && !this._attacking()) { // caught your eye: dead still for a moment, staring back
      this.freezeT -= dt;
      const P = this.player, want = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), diff = wrap(want - this.heading), turn = V.turnRate * dt;
      this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, diff)));
      return;
    }
    if (this.state === 'SURGE') { this._tickSurge(dt); return; }
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
    this._followPath(dt, V.speed[this.anger - 1] * (this.state === 'PATROL' ? 1 : V.investigateMul));
  }

  /** Per rendered frame. */
  frame(alpha, dt = 1 / 60) {
    const r = this.model.root;
    this.model.animate(dt, this.state === 'ALERT' || this.freezeT > 0);
    this.model.arcsOn(this.anger >= 5 && !this.off ? 1 : 0);
    this.cloud.frame(dt, this.camera.position);
    r.position.set(this.px + (this.x - this.px) * alpha, 0, this.pz + (this.z - this.pz) * alpha);
    r.rotation.y = this.prevHeading + wrap(this.heading - this.prevHeading) * alpha;
    this.hose.frame(alpha, this.camera.position);
    for (const b of this.blasts) b.frame(alpha);
    const paid = this._paid();
    this.spin += (paid - this.lastPaid) / 0.07; this.lastPaid = paid; // the reel turns as cord goes out or comes in
    this.model.setReel(Math.min(1, (paid / C.length) * (1 - this.cord.trim)), this.spin + this.cord.trim * 40);
    r.updateMatrixWorld(true);
    this.model.cordSocket.getWorldPosition(_s);
    const T = this.tether;
    this.cord.frame(T, this._retracing() ? T.length - 1 : T.length, r.position.x, r.position.z, _s.x, _s.y, _s.z);
  }
}
