// Mr. Tidy. He patrols his loop round the house on the waypoint graph, on the end of his cord; he goes to noises he can
// hear, and cleans the messes he finds. Cleaning is cosmetic: the noise already reached Grandma.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { buildVacuum } from './vacuum-model.js';
import { Nav } from './nav.js';
import { Cord } from './cord.js';
import { Hose } from './hose.js';
import { audio } from '../audio/audio.js';

const V = TUNING.vac, D = TUNING.drone, C = TUNING.cord, H = TUNING.hose;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _s = new THREE.Vector3();

export class Vacuum {
  constructor({ scene, world, camera, noise, knock, debris, player }) {
    this.world = world; this.knock = knock; this.debris = debris; this.camera = camera; this.player = player;
    this.hose = new Hose(scene); this.reachPhase = null; this.reachT = 0; this.reachCd = 0; this.rattle = null; this._snap = new THREE.Vector3(); this._goal = new THREE.Vector3(); this.directX = 0; this.directZ = 0;
    this.onCatch = null; this.caught = false; // onCatch(how): 'body' or 'hose'
    this.seeT = 0; this.seesCat = false; this.lastX = 0; this.lastZ = 0; this.loseT = 0; this.replanT = 0; this.direct = false; this.directOK = false; this.chaseNode = null; this.sweep = false; this.sweepT = 0;
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
    if (this.off || this.plugState !== 'in' || this.caught) return false;
    const S = TUNING.swipe, p = this.cord.plugPos, eye = camera.position, o = this.cord.outlet;
    const dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z, d = Math.hypot(dx, dy, dz);
    if (d > S.reach || d < 1e-3 || (eye.x - p.x) * o.n[0] + (eye.z - p.z) * o.n[2] <= 0) return false; // too far, or the other side of the wall
    camera.getWorldDirection(_s);
    if ((dx * _s.x + dy * _s.y + dz * _s.z) / d < S.cone) return false;
    if (this.plugLock > 0) { audio.play('knock.clink', { pos: p }); return false; } // jammed in for now
    if (this.state === 'CLEAN') { this.slurp?.stop(0.1); this.slurp = null; this.mess = null; }
    this._endReach();
    this.direct = false;
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
    if (this.state === 'CHASE') { if (!this.seesCat) { this.lastX = x; this.lastZ = z; } return; } // something to go on while he has lost sight of you
    if (this.state === 'HOSE_REACH') return; // busy: a crash doesn't pull him off a reach (his own slap can cause one)
    if (this.state === 'CLEAN') { this.pending = { x, z }; return; } // he finishes the job in hand first
    this.state = 'INVESTIGATE';
    this.routeTo(this.nav.nearest(x, z));
  }

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

  _startClean(m) {
    this.state = 'CLEAN'; this.mess = m; this.cleanT = 0;
    this.slurp = audio.play('vac.slurp', { follow: this.model.hoseSocket, rolloff: 0, gain: 1 });
  }

  _tickClean(dt) {
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
    if (near) this._startClean(near); else this._resumePatrol();
  }

  // ---- sight, the chase, the search
  /** Can he see the cat right now? A cone in front of him, shorter if it's slinking, blocked by walls and tall furniture. */
  _canSee() {
    const P = this.player;
    if (P.noclip) return false;
    const dx = P.pos.x - this.x, dz = P.pos.z - this.z, d = Math.hypot(dx, dz) || 1;
    if (d > V.sightRange[this.anger - 1] * (P.slink > 0.5 ? V.slinkSight : 1)) return false;
    if ((dx * Math.sin(this.heading) + dz * Math.cos(this.heading)) / d < V.sightCos) return false;
    const a = this._a, b = this._b;
    a.x = this.x; a.y = 0.35; a.z = this.z; b.x = P.pos.x; b.y = P.feetY + 0.15; b.z = P.pos.z;
    // what the cat is standing on doesn't hide it: from the floor, a cat on a fridge is just on top of the fridge
    const under = P.groundCollider, was = under ? under.occludes : false;
    if (under) under.occludes = false;
    const clear = this.world.countOccluders(a, b, 1, true) === 0;
    if (under) under.occludes = was;
    return clear;
  }

  _perceive(dt) {
    this.seesCat = this._canSee();
    if (this.seesCat) { this.lastX = this.player.pos.x; this.lastZ = this.player.pos.z; }
    if (this.state === 'CHASE' || this.state === 'HOSE_REACH') return;
    this.seeT = this.seesCat ? this.seeT + dt : Math.max(0, this.seeT - dt);
    if (this.seeT >= V.noticeTime[this.anger - 1]) this._startChase();
  }

  _startChase() {
    if (this.state === 'CLEAN') { this.slurp?.stop(0.1); this.slurp = null; this.mess = null; }
    this.pending = null; this.state = 'CHASE'; this.loseT = 0; this.replanT = 0; this.chaseNode = null; this.seeT = 0; this.sweep = false;
    audio.play('vac.surge', { follow: this.model.hoseSocket, rolloff: 0 });
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
    this._arrived(best);
    this.path = [best]; this.pathI = 0;
  }

  // ---- the hose
  _catChest(out) { out.set(this.player.pos.x, this.player.feetY + 0.12, this.player.pos.z); return out; }

  _inReach(margin) {
    const P = this.player, h = this._hole();
    return P.feetY >= H.minPerch && P.feetY <= H.reachTop + margin && Math.hypot(P.pos.x - h.x, P.pos.z - h.z) <= H.reachH + margin;
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
    if (this.reachPhase === 'rise') {
      const want = Math.atan2(this.player.pos.x - this.x, this.player.pos.z - this.z), diff = wrap(want - this.heading), maxTurn = V.turnRate * dt;
      this.heading = wrap(this.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
      if (this.reachT >= H.windup) {
        if (!this._inReach(H.giveUp)) { this.reachPhase = 'stall'; this.reachT = H.stall * 0.6; this.rattle?.stop(0.1); this.rattle = null; return; } // gone: it doesn't bother
        this._catChest(this._snap);
        this.reachPhase = 'lunge'; this.reachT = 0;
      }
    } else if (this.reachPhase === 'lunge') {
      if (this.hose.tip.distanceTo(this._catChest(this._goal)) <= H.hit) { this._endReach(); this._catch('hose'); return; }
      if (this.hose.tip.distanceTo(this._snap) < 0.03) this._slap();
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
    const h = this._hole(), g = this._goal;
    let goal = null, speed = 0;
    if (this.reachPhase === 'rise') { // up out of the hole, hovering short of the cat and sniffing at it
      this._catChest(g);
      const dx = g.x - h.x, dy = g.y - h.y, dz = g.z - h.z, l = Math.hypot(dx, dy, dz) || 1, t = this.hose.t;
      g.x -= (dx / l) * H.hover; g.y -= (dy / l) * H.hover; g.z -= (dz / l) * H.hover;
      g.x += Math.sin(t * H.swayRate) * H.sway * (dz / l); g.z -= Math.sin(t * H.swayRate) * H.sway * (dx / l); g.y += Math.sin(t * H.swayRate * 1.4) * H.sway * 0.6;
      goal = g; speed = H.riseSpeed;
    } else if (this.reachPhase === 'lunge') { goal = this._snap; speed = H.lungeSpeed; }
    else if (this.state === 'CLEAN' && this.mess) { g.set(this.mess.x, 0.06, this.mess.z); goal = g; speed = H.cleanSpeed; } // the nozzle comes down on the mess
    this.hose.tick(dt, h, this.heading, goal, speed);
  }

  _tickChase(dt) {
    if (this._canReach()) { this._startReach(); return; }
    if (this.seesCat) this.loseT = 0; else this.loseT += dt;
    if (this.loseT >= V.loseTime) { this._startSearch(); return; }
    this.replanT -= dt;
    if (this.replanT <= 0) {
      this.replanT = V.replan;
      // a cat up on something can't be driven at: he parks within hose range of it instead
      const perched = this.player.feetY >= H.minPerch, dx = this.x - this.lastX, dz = this.z - this.lastZ, d = Math.hypot(dx, dz) || 1;
      this.directX = perched ? this.lastX + (dx / d) * H.standoff : this.lastX;
      this.directZ = perched ? this.lastZ + (dz / d) * H.standoff : this.lastZ;
      this.directOK = this.seesCat && this._clear(this.directX, this.directZ);
      if (this.directOK) this.direct = true;
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

  _startSearch() {
    if (this.direct) this._rejoin();
    this.state = 'SEARCH'; this.sweep = false; this.seeT = 0;
    this.routeTo(this.nav.nearest(this.lastX, this.lastZ));
  }

  _tickSweep(dt) { // at the spot: he turns on the spot, looking
    this.heading = wrap(this.heading + V.searchTurn * dt);
    this.sweepT -= dt;
    if (this.sweepT <= 0) { this.sweep = false; this._resumePatrol(); }
  }

  /** His body touching a cat on the floor. */
  _touching() {
    const P = this.player;
    return !P.noclip && P.feetY < V.catchHeight && Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < V.radius + V.catchReach;
  }

  _catch(how) {
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
    if (this.state === 'SEARCH') { this.sweep = true; this.sweepT = V.searchTime; return; }
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
    this._updateHose(dt);
    if (this.reachCd > 0) this.reachCd -= dt;
    if (this.plugLock > 0) this.plugLock -= dt;
    if (this.plugState !== 'in' && !this.off) { this._tickPlug(dt); return; }
    if (this.frozen || this.off || this.caught) return;
    this._perceive(dt);
    if (this._touching()) { this._catch('body'); return; }
    if (this.state === 'HOSE_REACH') { this._tickReach(dt); return; }
    if (this.state === 'CHASE') { this._tickChase(dt); return; }
    if (this.state === 'CLEAN') { this._tickClean(dt); return; }
    if (this.state === 'SEARCH' && this.sweep) { this._tickSweep(dt); return; }
    this.spotT -= dt;
    if (this.spotT <= 0 && this.state !== 'SEARCH') { // a mess right in front of him stops him on his way
      this.spotT = V.spotEvery;
      const m = this._nearestMess(V.cleanSee, true);
      if (m) { this._startClean(m); return; }
    }
    this._followPath(dt, V.speed[this.anger - 1] * (this.state === 'PATROL' ? 1 : V.investigateMul));
  }

  /** Per rendered frame. */
  frame(alpha) {
    const r = this.model.root;
    r.position.set(this.px + (this.x - this.px) * alpha, 0, this.pz + (this.z - this.pz) * alpha);
    r.rotation.y = this.prevHeading + wrap(this.heading - this.prevHeading) * alpha;
    this.hose.frame(alpha);
    const paid = this._paid();
    this.spin += (paid - this.lastPaid) / 0.07; this.lastPaid = paid; // the reel turns as cord goes out or comes in
    this.model.setReel(Math.min(1, (paid / C.length) * (1 - this.cord.trim)), this.spin + this.cord.trim * 40);
    r.updateMatrixWorld(true);
    this.model.cordSocket.getWorldPosition(_s);
    const T = this.tether;
    this.cord.frame(T, this._retracing() ? T.length - 1 : T.length, r.position.x, r.position.z, _s.x, _s.y, _s.z);
  }
}
