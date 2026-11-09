// Mr. Tidy. For now he patrols: he glides his fixed loop round the house on the waypoint graph, trailing his cord. The
// other states (INVESTIGATE, CLEAN, CHASE, SEARCH, HOSE_REACH, CATCH) join in later steps.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { buildVacuum } from './vacuum-model.js';
import { Nav } from './nav.js';
import { Cord } from './cord.js';

const V = TUNING.vac;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _s = new THREE.Vector3();

export class Vacuum {
  constructor({ scene, world, camera }) {
    this.world = world;
    this.model = buildVacuum();
    scene.add(this.model.root);
    this.nav = new Nav();
    const start = this.nav.nodes.get(LEVEL.vacStart);
    this.x = this.px = start.x; this.z = this.pz = start.z;
    this.heading = this.prevHeading = 0; // the way the hole faces: rotation about y, 0 = +z
    this.state = 'PATROL';
    this.anger = 1;
    this.frozen = false; // F8
    this.off = false; // Grandma pulled the plug (for now: she woke)
    this.route = LEVEL.patrol.map((id) => this.nav.nodes.get(id));
    this.routeI = 0;
    this.path = [start]; // the node list he's following right now (the debug overlay draws it)
    this.pathI = 0;
    this.cord = new Cord(scene, world, camera, null);
    this.cord.plugInto(LEVEL.outlets.find((o) => o.id === LEVEL.vacOutlet), start.x, start.z);
    this.model.root.position.set(this.x, 0, this.z);
    this.model.root.updateMatrixWorld(true);
  }

  get ready() { return this.model.ready; }

  /** Everything stops: the motor winds down and the face goes dark. */
  powerDown() { this.off = true; this.state = 'OFF'; this.model.face.visible = false; }

  _nextLeg() { // on to the next stop of the patrol loop
    this.routeI = (this.routeI + 1) % this.route.length;
    const from = this.path[this.pathI];
    const p = this.nav.path(from, this.route[this.routeI]);
    this.path = p.length ? p : [from];
    this.pathI = 0;
  }

  /** Per fixed tick. */
  tick(dt) {
    this.px = this.x; this.pz = this.z; this.prevHeading = this.heading;
    if (this.frozen || this.off) return;
    let target = this.path[this.pathI];
    if (Math.hypot(target.x - this.x, target.z - this.z) < V.arrive) {
      if (this.pathI >= this.path.length - 1) this._nextLeg();
      else this.pathI++;
      target = this.path[this.pathI];
    }
    const dx = target.x - this.x, dz = target.z - this.z;
    const want = Math.atan2(dx, dz), diff = wrap(want - this.heading), maxTurn = V.turnRate * dt;
    this.heading = wrap(this.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
    // he glides: full speed when pointed the right way, and swings round almost on the spot when he isn't
    const speed = V.speed[this.anger - 1] * Math.max(0, Math.cos(diff));
    this.x += Math.sin(this.heading) * speed * dt;
    this.z += Math.cos(this.heading) * speed * dt;
    this.cord.tick(dt, this.x, this.z);
  }

  /** Per rendered frame. */
  frame(alpha) {
    const r = this.model.root;
    r.position.set(this.px + (this.x - this.px) * alpha, 0, this.pz + (this.z - this.pz) * alpha);
    r.rotation.y = this.prevHeading + wrap(this.heading - this.prevHeading) * alpha;
    r.updateMatrixWorld(true);
    this.model.cordSocket.getWorldPosition(_s);
    this.cord.frame(_s.x, _s.y, _s.z);
  }
}
