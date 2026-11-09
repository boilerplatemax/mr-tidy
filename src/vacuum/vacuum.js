// Mr. Tidy. He patrols his loop round the house on the waypoint graph, on the end of his cord; he goes to noises he can
// hear, and cleans the messes he finds. Cleaning is cosmetic: the noise already reached Grandma.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { buildVacuum } from './vacuum-model.js';
import { Nav } from './nav.js';
import { Cord } from './cord.js';
import { audio } from '../audio/audio.js';

const V = TUNING.vac, D = TUNING.drone, C = TUNING.cord;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _s = new THREE.Vector3();

export class Vacuum {
  constructor({ scene, world, camera, noise, knock, debris }) {
    this.world = world; this.knock = knock; this.debris = debris; this.camera = camera;
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
    this.route = LEVEL.patrol.map((id) => this.nav.nodes.get(id));
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

  /** Anger level 1–3: his face, his speed, the pitch of his motor. */
  setAnger(level) {
    this.anger = Math.max(1, Math.min(3, level));
    this.model.setFace(this.anger);
  }

  /** Volume for a distance: steep near him, and never quite silent. */
  droneLevel(d) { return D.floor + (1 - D.floor) / (1 + (d / D.closeness) ** 2); }

  /** Once audio exists (the first click). */
  startSound() {
    if (this.off || this.voice) return;
    // no distance rolloff in the panner (rolloff: 0): droneLevel is the whole volume curve, the panner gives the direction
    this.voice = audio.play('vac.drone', { follow: this.model.hoseSocket, rolloff: 0, fadeIn: 0.5, gain: D.gain, wet: 0.5 });
  }

  _updateDrone(dt) {
    if (!this.voice || this.off || this.plugState !== 'in') return;
    this.droneT -= dt;
    if (this.droneT > 0) return;
    this.droneT = D.update;
    const L = audio.listenerPos, d = Math.hypot(this.x - L.x, 0.2 - L.y, this.z - L.z), near = 1 / (1 + (d / D.closeness) ** 2);
    this.voice.fadeTo(this.droneLevel(d), D.update);
    this.voice.setRate(D.rate[this.anger - 1] + D.nearRate * near, D.update * 2);
  }

  /** Everything stops: the motor winds down and the face goes dark. */
  powerDown() {
    this.off = true; this.state = 'OFF'; this.model.face.visible = false;
    if (this.voice) { this.voice.setRate(0.2, D.windDown); this.voice.stop(D.windDown); this.voice = null; }
  }

  /**
   * The paw hit an outlet? Only the one he's plugged into does anything, from the side the plate faces. The cord whips
   * back, he dies for a moment, then plugs into the nearest outlet. Returns true if it unplugged him.
   */
  swipeOutlet(camera) {
    if (this.off || this.plugState !== 'in') return false;
    const S = TUNING.swipe, p = this.cord.plugPos, eye = camera.position, o = this.cord.outlet;
    const dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z, d = Math.hypot(dx, dy, dz);
    if (d > S.reach || d < 1e-3 || (eye.x - p.x) * o.n[0] + (eye.z - p.z) * o.n[2] <= 0) return false; // too far, or the other side of the wall
    camera.getWorldDirection(_s);
    if ((dx * _s.x + dy * _s.y + dz * _s.z) / d < S.cone) return false;
    if (this.plugLock > 0) { audio.play('knock.clink', { pos: p }); return false; } // jammed in for now
    this.plugState = 'retract'; this.plugT = 0; this.state = 'UNPLUGGED';
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

  _nextLeg() { // on to the next stop of the patrol loop
    this.routeI = (this.routeI + 1) % this.route.length;
    this.path = this.planTo(this.route[this.routeI]);
    this.pathI = 0;
  }

  // ---- hearing, investigating, cleaning
  /** Where the middle of the hole is, in the world. */
  _hole() {
    const h = this._h, M = V.model;
    h.x = this.x + Math.sin(this.heading) * M.holeZ; h.y = M.holeY; h.z = this.z + Math.cos(this.heading) * M.holeZ;
    return h;
  }

  _hear(ev) {
    if (this.off || this.plugState !== 'in') return;
    if (ev.kind === 'crash') { // every knock-over can raise his anger, whether he hears it or not
      const c = this.knock.count, want = c >= V.angerAt[1] ? 3 : c >= V.angerAt[0] ? 2 : 1;
      if (want > this.anger) this.setAnger(want);
    }
    const d = Math.hypot(ev.x - this.x, ev.z - this.z);
    const heard = ev.kind === 'crash' ? this.anger >= 2 || d <= V.hearNear : this.anger >= 3 && d <= V.hearSteps;
    if (heard) this._investigate(ev.x, ev.z);
  }

  _investigate(x, z) {
    if (this.state === 'CLEAN') { this.pending = { x, z }; return; } // he finishes the job in hand first
    this.state = 'INVESTIGATE';
    this.routeTo(this.nav.nearest(x, z));
  }

  routeTo(node) { this.path = this.planTo(node); this.pathI = 0; }

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

  _startClean(m) {
    this.state = 'CLEAN'; this.mess = m; this.cleanT = 0;
    this.slurp = audio.play('vac.slurp', { follow: this.model.hoseSocket, rolloff: 0, gain: 1 });
  }

  _tickClean(dt) {
    this.cleanT += dt / V.cleanTime;
    const u = Math.min(1, this.cleanT), h = this._hole();
    this.debris.cleanStep(this.mess, u, h.x, h.y, h.z);
    if (u < 1) return;
    this.mess.cleaned = true; this.mess = null;
    this.state = 'PATROL'; // (done cleaning, whatever comes next)
    this.slurp?.stop(0.15); this.slurp = null;
    const p = this.pending; this.pending = null;
    if (p) { this._investigate(p.x, p.z); return; }
    const near = this._nearestMess(V.cleanSee, true);
    if (near) this._startClean(near); else this._resumePatrol();
  }

  /** The end of the route he was on. */
  _routeEnd() {
    if (this.state === 'INVESTIGATE') {
      const m = this._nearestMess(V.cleanReach, false);
      if (m) this._startClean(m); else this._resumePatrol();
      return;
    }
    this._nextLeg();
  }

  /** Reached a waypoint: the cord now lies to here, or, if he came back over it, has reeled in to here. */
  _arrived(n) {
    const T = this.tether;
    if (T[T.length - 1] === n) return;
    if (T.length >= 2 && T[T.length - 2] === n) T.pop(); else T.push(n);
  }

  /** Per fixed tick. */
  tick(dt) {
    this.px = this.x; this.pz = this.z; this.prevHeading = this.heading;
    this._updateDrone(dt);
    if (this.plugLock > 0) this.plugLock -= dt;
    if (this.plugState !== 'in' && !this.off) { this._tickPlug(dt); return; }
    if (this.frozen || this.off) return;
    if (this.state === 'CLEAN') { this._tickClean(dt); return; }
    this.spotT -= dt;
    if (this.spotT <= 0) { // a mess right in front of him stops him on his way
      this.spotT = V.spotEvery;
      const m = this._nearestMess(V.cleanSee, true);
      if (m) { this._startClean(m); return; }
    }
    let target = this.path[this.pathI];
    if (Math.hypot(target.x - this.x, target.z - this.z) < V.arrive) {
      this._arrived(target);
      if (this.pathI >= this.path.length - 1) { this._routeEnd(); if (this.state === 'CLEAN') return; }
      else this.pathI++;
      target = this.path[this.pathI];
    }
    const dx = target.x - this.x, dz = target.z - this.z;
    const want = Math.atan2(dx, dz), diff = wrap(want - this.heading), maxTurn = V.turnRate * dt;
    this.heading = wrap(this.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
    // he glides: full speed when pointed the right way, and swings round almost on the spot when he isn't
    const speed = V.speed[this.anger - 1] * (this.state === 'INVESTIGATE' ? V.investigateMul : 1) * Math.max(0, Math.cos(diff));
    this.x += Math.sin(this.heading) * speed * dt;
    this.z += Math.cos(this.heading) * speed * dt;
  }

  /** Per rendered frame. */
  frame(alpha) {
    const r = this.model.root;
    r.position.set(this.px + (this.x - this.px) * alpha, 0, this.pz + (this.z - this.pz) * alpha);
    r.rotation.y = this.prevHeading + wrap(this.heading - this.prevHeading) * alpha;
    const paid = this._paid();
    this.spin += (paid - this.lastPaid) / 0.07; this.lastPaid = paid; // the reel turns as cord goes out or comes in
    this.model.setReel(Math.min(1, (paid / C.length) * (1 - this.cord.trim)), this.spin + this.cord.trim * 40);
    r.updateMatrixWorld(true);
    this.model.cordSocket.getWorldPosition(_s);
    const T = this.tether;
    this.cord.frame(T, this._retracing() ? T.length - 1 : T.length, r.position.x, r.position.z, _s.x, _s.y, _s.z);
  }
}
