// The route checker: jumps every link in LEVEL.links, both ways, with the REAL controller (no rendering). For each link
// it tries rising amounts of charge and reports the least that lands on the far surface. Run it after changing the
// level or the jump numbers:  node Tools/check-page.mjs "http://localhost:8080/?play" out.png "window.__kitReady" 60000 "__routeBot()"
// It proves a jump is possible, not that it feels good: that needs a person.
import { LEVEL } from '../data/level.js';
import { TUNING } from '../data/tuning.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const INSET = 0.04;

/** The point on rect A nearest rect B, inset a little so the cat starts on the surface. */
function nearest(a, bx, bz) {
  return { x: clamp(bx, a.min[0] + INSET, a.max[0] - INSET), z: clamp(bz, a.min[2] + INSET, a.max[2] - INSET) };
}

function attempt(kit, from, to, charge, trace, shift = 0) {
  const P = kit.player, I = kit.input, dt = 1 / 60, J = TUNING.jump;
  const fc = nearest(from, (to.min[0] + to.max[0]) / 2, (to.min[2] + to.max[2]) / 2);
  const tc = nearest(to, fc.x, fc.z);
  const start = nearest(from, tc.x, tc.z);
  start.z = clamp(start.z + shift, from.min[2] + INSET, from.max[2] - INSET); // (a low shelf overhead can spoil one start point; the link only has to work from somewhere)
  // aim into the target the way a person does: not at its very lip
  const inX = Math.min(0.15, (to.max[0] - to.min[0]) / 2 - 0.01), inZ = Math.min(0.15, (to.max[2] - to.min[2]) / 2 - 0.01);
  const aim = { x: clamp(start.x, to.min[0] + inX, to.max[0] - inX), z: clamp(start.z, to.min[2] + inZ, to.max[2] - inZ) };
  const yaw = Math.atan2(-(aim.x - start.x), -(aim.z - start.z));
  I.keys.clear(); I.edges.clear(); I.releases.clear();
  P.frozen = false; P.resetMotion();
  P.teleport(start.x, from.max[1] + 0.001, start.z, yaw);
  P.yaw = yaw;
  for (let i = 0; i < 6 && !P.grounded; i++) kit.tick(dt);
  if (!P.grounded || P.groundCollider?.id !== from.id) return { landed: false, why: 'start' };
  I.keys.add('Space'); I.edges.add('Space');
  kit.tick(dt);
  for (let i = 0; i < Math.round((charge * J.chargeTime) / dt) && P.charging; i++) kit.tick(dt);
  I.keys.delete('Space'); I.keys.add('KeyW');
  let t = 0;
  do {
    // over the target: let go and brake, as a person would
    if (P.pos.x >= to.min[0] && P.pos.x <= to.max[0] && P.pos.z >= to.min[2] && P.pos.z <= to.max[2]) {
      I.keys.delete('KeyW');
      if (Math.hypot(P.vel.x, P.vel.z) > 0.4) I.keys.add('KeyS'); else I.keys.delete('KeyS');
    }
    kit.tick(dt); t += dt;
  } while (!P.grounded && t < 2.5);
  I.keys.clear();
  const id = P.groundCollider?.id || 'floor';
  if (trace) trace.push(`${from.id}->${to.id} @${charge.toFixed(2)}: on ${id}`);
  return { landed: id === to.id, on: id };
}

/** A link that needs a ledge grab: leap short, catch the edge, pull up. Returns whether it ended on top. */
function grabAttempt(kit, from, to, start, charge) {
  const P = kit.player, I = kit.input, dt = 1 / 60, J = TUNING.jump;
  const startY = from ? from.max[1] : 0;
  const s = start || nearest(from, (to.min[0] + to.max[0]) / 2, (to.min[2] + to.max[2]) / 2);
  const inX = Math.min(0.15, (to.max[0] - to.min[0]) / 2 - 0.01), inZ = Math.min(0.15, (to.max[2] - to.min[2]) / 2 - 0.01);
  const aim = { x: clamp(s.x, to.min[0] + inX, to.max[0] - inX), z: clamp(s.z, to.min[2] + inZ, to.max[2] - inZ) };
  const yaw = Math.atan2(-(aim.x - s.x), -(aim.z - s.z));
  I.keys.clear(); I.edges.clear(); I.releases.clear();
  P.frozen = false; P.resetMotion();
  P.teleport(s.x, startY + 0.001, s.z, yaw);
  P.yaw = yaw;
  for (let i = 0; i < 6 && !P.grounded; i++) kit.tick(dt);
  I.keys.add('Space'); I.edges.add('Space');
  kit.tick(dt);
  for (let i = 0; i < Math.round((charge * J.chargeTime) / dt) && P.charging; i++) kit.tick(dt);
  I.keys.delete('Space'); I.keys.add('KeyW');
  let t = 0, caught = false;
  do {
    kit.tick(dt); t += dt;
    if (P.mode === 'hang' && P.hang.col.id === to.id) { caught = true; break; }
  } while (!P.grounded && t < 2.5);
  I.keys.clear();
  if (!caught) return { ok: false, on: P.groundCollider?.id || 'floor' };
  for (let i = 0; i < 12; i++) kit.tick(dt);
  I.edges.add('Space'); I.keys.add('Space'); kit.tick(dt); I.keys.clear();
  for (let i = 0; i < 40 && !P.grounded; i++) kit.tick(dt);
  const id = P.groundCollider?.id || 'floor';
  return { ok: id === to.id, on: id, caught };
}

/** Put him at a waypoint, calm and on patrol, with no messes about. */
function freshVac(kit, id, anger = 1) {
  const v = kit.vac, n = v.nav.nodes.get(id);
  for (const m of kit.debris.messes) m.cleaned = true;
  if (v.slurp) { v.slurp.stop(0); v.slurp = null; }
  v.mess = null; v.pending = null; v.frozen = false; v.state = 'PATROL'; v.setAnger(anger);
  v._endReach(); v.reachCd = 0; v.direct = false; v.caught = false; v.seeT = 0; v.sweep = false; v.campT = 0; v.ignoreT = 0;
  v.x = v.px = n.x; v.z = v.pz = n.z; v.heading = v.prevHeading = 0;
  v.tether = v.nav.path(v.root, n); v.path = [n]; v.pathI = 0;
  return v;
}

/** Sight, the chase, the search, being caught by his body. */
function huntChecks(kit) {
  const v = kit.vac, P = kit.player, I = kit.input, W = kit.world, V = TUNING.vac, dt = 1 / 60, rows = [];
  const report = (name, ok, note) => rows.push(`${ok ? 'ok  ' : 'FAIL'} HUNT ${name}${note ? ' (' + note + ')' : ''}`);
  P.noclip = false;
  let caughtBy = null;
  const onCatch0 = v.onCatch; v.onCatch = (how) => { caughtBy = how; };
  const reset = (id, anger) => { freshVac(kit, id, anger); v.caught = false; caughtBy = null; v.seeT = 0; v.direct = false; v.chaseNode = null; v.sweep = false; v.loseT = 0; I.keys.clear(); P.frozen = false; P.resetMotion(); };
  const cat = (x, z, y = 0.001, yaw = 0) => { P.teleport(x, y, z, yaw); for (let i = 0; i < 4 && !P.grounded; i++) P.tick(dt); };
  const run = (s) => { for (let i = 0; i < Math.round(s * 60); i++) kit.tick(dt); };

  // L2 faces +z from heading 0: the open floor of the living room at z 1.0
  reset('L2', 3); v.heading = -0.3; cat(3.05, 3.9); v.path = [v.nav.nodes.get('L4')]; v.pathI = 0; // walking toward the cat
  run(0.05);
  report('he notices after a moment, not instantly', v.state !== 'CHASE');
  run(V.noticeTime[1] + 0.2);
  report('sees the cat in front of him and gives chase', v.state === 'CHASE' || v.state === 'HOSE_REACH', v.state);

  reset('L2', 4); v.heading = Math.PI; cat(3.05, 3.9); // facing away
  run(0.6);
  report('does not see behind him', v.state !== 'CHASE', v.state);

  reset('Hl', 4); v.heading = 1.57; cat(8.5, 1.4); // facing along the hall, the cat is round the corner in the kitchen
  run(0.6);
  report('does not see through walls', v.state !== 'CHASE', v.state);

  reset('L2', 3); v.heading = 0; cat(3.05, 4.7); I.keys.add('KeyC'); // about 3.7 m: inside his sight walking, outside it slinking
  for (let i = 0; i < 10; i++) P.tick(dt);
  run(0.8); I.keys.clear();
  report('slinking halves how far he can see you', v.state !== 'CHASE', v.state);

  // crouched behind a low table, close enough to see: hidden. Standing in the same place: seen.
  reset('L2', 4); v.heading = 0.18; cat(3.45, 3.2); I.keys.add('KeyC');
  for (let i = 0; i < 12; i++) P.tick(dt);
  const hid = !v._canSee(); I.keys.clear(); for (let i = 0; i < 12; i++) P.tick(dt);
  report('crouched behind a low table you are hidden, standing you are not', hid && v._canSee());

  // crouched behind him, out of his sight: he doesn't know you're there, even touching him. Not once he's furious.
  reset('H2', 3); v.heading = 1.57; cat(v.x - 0.3, v.z); I.keys.add('KeyC');
  for (let i = 0; i < 12; i++) P.tick(dt);
  v.frozen = false; v.path = [v.nav.nodes.get('Hk')]; v.pathI = 0;
  kit.tick(dt); kit.tick(dt);
  const sneaked = !caughtBy; caughtBy = null;
  v.setAnger(4); v.caught = false; kit.tick(dt); I.keys.clear();
  report('crouched behind him you are undetected at stage 3, not at stage 4', sneaked && caughtBy === 'snap', `${caughtBy}`);

  // something he can't reach: he gives up after a while, and leaves it alone for a bit
  reset('L5', 4); cat(3.0, 5.11, 2.051); v.x = v.px = 3.0; v.z = v.pz = 4.1; v.heading = 0; v.path = [v.nav.nodes.get('L4')]; v.pathI = 0;
  v._startChase(); run(0.5); const up = v.state === 'CHASE'; run(TUNING.vac.campTime + 0.5); const gave = v.state !== 'CHASE'; run(1);
  report('gives up on a cat out of reach', up && gave && v.state !== 'CHASE', v.state);

  // the chase, and the cat outrunning him at his angriest
  reset('Hk', 4); v.heading = -1.57; v.path = [v.nav.nodes.get('H2')]; v.pathI = 0; cat(6, -0.45, 0.001, 1.57);
  for (let i = 0; i < 30 && v.state === 'PATROL'; i++) kit.tick(dt);
  const chasing = v.state === 'CHASE' || v.state === 'HOSE_REACH'; I.keys.add('KeyW'); I.keys.add('ShiftLeft');
  const d0 = Math.abs(v.x - P.pos.x);
  for (let i = 0; i < 40; i++) kit.tick(dt);
  const d1 = Math.abs(v.x - P.pos.x); I.keys.clear();
  report('a running cat outpaces him at anger 3', chasing && d1 > d0 && !caughtBy, `gap ${d0.toFixed(2)} to ${d1.toFixed(2)} m`);

  // the chase ends: out of sight, he searches, then goes back to patrol
  reset('Hk', 4); v.heading = -1.57; v.path = [v.nav.nodes.get('H2')]; v.pathI = 0; cat(6, -0.45, 0.001, 1.57);
  for (let i = 0; i < 30 && v.state === 'PATROL'; i++) kit.tick(dt);
  v._endReach(); v.state = 'CHASE'; P.noclip = true; let t = 0, sawSearch = false, sawSweep = false;
  while (t < 40 && v.state !== 'PATROL') { kit.tick(dt); t += dt; if (v.state === 'SEARCH') sawSearch = true; if (v.sweep) sawSweep = true; }
  P.noclip = false;
  report('loses you, searches, returns to patrol', sawSearch && sawSweep && v.state === 'PATROL', `${t.toFixed(1)} s`);

  // busy cleaning, he only notices you closer; seeing you still beats the mess
  reset('H2', 3); v.heading = 1.57; cat(9.8, -0.45);
  const patrolSees = v._canSee(); v.state = 'CLEAN'; const cleanSees = v._canSee(); v.state = 'PATROL';
  report('a clean narrows his sight', patrolSees && !cleanSees);
  reset('H2', 3); v.heading = 1.57; cat(7.2, -0.45);
  { const m = { id: 't', x: 6.2, z: -0.45, room: 'x', decal: -1, cubes: [], cleaned: false }; kit.debris.messes.push(m); v._startClean(m); }
  run(0.8);
  const dropped = (v.state === 'CHASE' || v.state === 'HOSE_REACH') && !kit.debris.messes[kit.debris.messes.length - 1].cleaned; const m0 = kit.debris.messes.pop(); m0.cleaned = true;
  report('catching beats cleaning', dropped, v.state);

  // caught by his body, on the floor only
  reset('H2', 2); v.heading = 0; cat(v.x + 0.2, v.z);
  kit.tick(dt);
  report('touching him on the floor gets you caught', caughtBy === 'snap' && v.caught);
  reset('K2', 2); cat(v.x, v.z, 1.0); P.vy = 0; P.feetY = 1.0; P.eyeFeet = 1; P.prevEyeFeet = 1; P.frozen = true;
  { const f = P.tick; P.tick = () => {}; kit.tick(dt); P.tick = f; }
  report('but not one above him', !caughtBy);
  P.frozen = false;

  v.onCatch = onCatch0; v.caught = false; freshVac(kit, 'L1', 1); P.noclip = true;
  return rows;
}

/** The hose: prep, homing charge, dodging it, pathfinding around things, and what it can and can't reach. */
function hoseChecks(kit) {
  const v = kit.vac, P = kit.player, I = kit.input, K = kit.knock, H = TUNING.hose, dt = 1 / 60, rows = [], V3 = kit.camera.position.constructor;
  const report = (name, ok, note) => rows.push(`${ok ? 'ok  ' : 'FAIL'} HOSE ${name}${note ? ' (' + note + ')' : ''}`);
  P.noclip = false; let caughtBy = null; const onCatch0 = v.onCatch; v.onCatch = (how) => { caughtBy = how; };
  const put = (id, anger, heading, x, y, z) => {
    freshVac(kit, id, anger); v.hose.reset(); caughtBy = null; v.heading = heading; v.prevHeading = heading; I.keys.clear(); P.frozen = false; P.resetMotion();
    P.teleport(x, y + 0.001, z, 0); for (let i = 0; i < 4 && !P.grounded; i++) P.tick(dt);
    v.seesCat = true; v.lastX = x; v.lastZ = z; v._startChase(); v.state = 'CHASE';
  };
  const hold = (s, fn) => { for (let i = 0; i < Math.round(s * 60); i++) { kit.tick(dt); if (fn && fn()) return true; } return false; };
  const toCharge = () => { hold(0.5, () => v.state === 'HOSE_REACH'); while (v.reachPhase === 'rise') kit.tick(dt); };

  // a cat that sits still on the island: a full prep, then the charge gets it
  put('K4', 3, 0, 8.5, 0.75, 2.9);
  hold(0.5, () => v.state === 'HOSE_REACH');
  const reaching = v.state === 'HOSE_REACH'; let prep = 0;
  while (prep < 3 && v.reachPhase === 'rise') { kit.tick(dt); prep += dt; }
  const raised = v.hose.tip.y, charging = v.reachPhase === 'charge';
  hold(1, () => caughtBy);
  report('preps for a full second, then charges', reaching && charging && Math.abs(prep - H.windup) < 0.1, `${prep.toFixed(2)} s, tip up at ${raised.toFixed(2)} m`);
  report('and catches a cat that sits still', caughtBy === 'hose');

  put('K4', 2, 0, 8.5, 0.75, 2.9); hold(0.5);
  report('never while merely annoyed', v.state !== 'HOSE_REACH', v.state);

  put('L5', 3, 0, 3.0, 2.05, 5.11); v.x = v.px = 3.0; v.z = v.pz = 4.1; hold(0.5);
  report('a perch above 1.8 m is safe', v.state !== 'HOSE_REACH' && P.feetY > H.reachTop, `${v.state}, cat at ${P.feetY.toFixed(2)} m`);
  put('L5', 3, -0.3, 4.05, 1.7, 5.1); hold(0.5);
  report('the bracket on the high route is in reach', v.state === 'HOSE_REACH', v.state);
  put('K2', 3, 1.2, 10.35, 1.72, 4.95); hold(0.5);
  report('so is the top of the fridge', v.state === 'HOSE_REACH', v.state);
  put('H2', 3, 1.57, 7.8, 0, -0.45); hold(0.5);
  report('it reaches further now, and for a cat on the floor', v.state === 'HOSE_REACH', v.state);

  // leaving during the prep: no charge
  put('K4', 3, 0, 8.5, 0.75, 2.9);
  hold(0.5, () => v.reachPhase === 'rise'); hold(0.6);
  { const f = P.tick; P.pos.x = 8.5; P.pos.z = -1.0; P.feetY = 0; P.tick = () => {}; hold(0.6, () => v.reachPhase !== 'rise'); P.tick = f; }
  report('leaving during the prep: it does not charge', !caughtBy && v.reachPhase !== 'charge', `${v.reachPhase}`);

  // the dodge: wait for the end of the prep, then jump and air-dash aside as it comes
  put('L4', 4, 1.57, 4.0, 0, 4.2); // open floor to the north
  hold(0.5, () => v.state === 'HOSE_REACH');
  const lateEnough = hold(2, () => v.reachPhase === 'rise' && v.reachT >= H.windup - 0.1);
  P.yaw = Math.PI / 2; I.keys.add('KeyD'); I.keys.add('Space'); I.edges.add('Space'); kit.tick(dt);
  I.keys.delete('Space'); kit.tick(dt);
  I.keys.add('ShiftLeft'); I.edges.add('ShiftLeft');
  hold(1.3, () => caughtBy || v.reachPhase === 'stall');
  I.keys.clear();
  report('jumping and air-dashing as it charges dodges it', lateEnough && !caughtBy && v.reachPhase === 'stall', `${v.reachPhase}, cat at z ${P.pos.z.toFixed(2)}`);

  // and it homes: walking away doesn't save you
  put('K1', 4, 1.57, 8.2, 0, 4.0);
  toCharge(); P.yaw = Math.PI / 2; I.keys.add('KeyA');
  hold(1.2, () => caughtBy); I.keys.clear();
  report('it follows you: a slow sidestep gets caught', caughtBy === 'hose');

  // a miss slaps what is there and stalls him
  put('K4', 3, 0, 8.5, 0.75, 2.9);
  const mug = K.byId.get('mug3');
  hold(0.5, () => v.state === 'HOSE_REACH'); while (v.reachPhase === 'rise') kit.tick(dt);
  { const f = P.tick; P.pos.x = 8.5; P.pos.z = 5.2; P.feetY = 0; P.tick = () => {};
    hold(1.5, () => { if (v.reachPhase === 'stall') return true; const t = v.hose.tip; mug.x = mug.px = t.x + 0.05; mug.y = mug.py = t.y - 0.1; mug.z = mug.pz = t.z; mug.state = 'rest'; mug.vx = mug.vz = 0; return false; });
    P.tick = f; }
  const slapped = Math.hypot(mug.vx, mug.vz) > 0.01, stalled = v.reachPhase === 'stall', sx = v.x;
  let stallT = 0; while (v.reachPhase === 'stall' && stallT < 3) { kit.tick(dt); stallT += dt; }
  report('a missed charge slaps what is there and stalls him', !caughtBy && stalled && slapped && Math.abs(stallT - H.stall) < 0.1 && v.x === sx, `stall ${stallT.toFixed(2)} s, slapped ${slapped}`);

  // pathfinding around something: from in front of the island to behind it
  v.frozen = true; v.hose.reset();
  const h = v.vox, base = new V3(8.5, 0.115, 1.62), goal = new V3(8.5, 0.3, 3.9);
  const route = h.path(base, goal);
  report('with the island in the way, it finds a way round', !h.lineFree(base, goal) && !!route && route.every((p, i) => i === 0 || h.lineFree(route[i - 1], p)), `${route?.length} points`);
  const inBox = (p) => kit.world.penetration(p.x, p.z, 0.015, p.y - 0.01, p.y + 0.01, null, p.y - 0.01) > 0;
  let inside = 0;
  for (let i = 0; i < 180; i++) { v.hose.tick(dt, base, 0, { mode: 'approach', goal, speed: 3 }); for (const p of v.hose.pts) if (inBox(p)) inside++; }
  report('the hose goes round it, never through', v.hose.arrived && inside === 0 && v.hose.tip.distanceTo(goal) < 0.1, `${inside} points inside anything, tip ${v.hose.tip.distanceTo(goal).toFixed(2)} from the goal`);
  v.frame(1);
  { const g = v.hose.mesh.geometry; g.computeBoundingBox(); const b = g.boundingBox, span = Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
    report('and the tube really is that long', span > 1.5, `${span.toFixed(2)} m`); }
  // reeling back along its own path
  const lenOut = v.hose.trail.length; let t = 0; while (t < 2 && v.hose.active) { v.hose.tick(dt, base, 0, null); t += dt; for (const p of v.hose.pts) if (inBox(p)) inside++; }
  report('it reels back along its own path', lenOut > 3 && !v.hose.active && inside === 0, `${t.toFixed(2)} s`);
  v.hose.reset();

  // at rest near a wall, it doesn't poke through
  inside = 0; const b2 = new V3(5.65, 0.115, 1.2);
  for (let i = 0; i < 90; i++) { v.hose.tick(dt, b2, 1.57, null); for (const p of v.hose.pts) if (inBox(p)) inside++; }
  report('at rest against a wall, it stays out of the wall', inside === 0, `${inside}`);
  v.hose.reset();

  // the hose is never short: nozzle close or at rest, the links still add up, the excess hanging aside
  const chainLen = () => { let L = 0; for (let i = 1; i < v.hose.pts.length; i++) L += v.hose.pts[i].distanceTo(v.hose.pts[i - 1]); return L; };
  const b3 = new V3(5.0, 0.115, -0.45), near = new V3(5.5, 0.2, -0.45);
  v.hose.reset(); for (let i = 0; i < 120; i++) v.hose.tick(dt, b3, 1.57, null);
  const restLen = chainLen(), bow = Math.max(...v.hose.pts.map((p) => Math.abs(p.z - b3.z)));
  v.hose.reset(); for (let i = 0; i < 120; i++) v.hose.tick(dt, b3, 1.57, { mode: 'approach', goal: near, speed: 3 });
  const closeLen = chainLen();
  report('never shorter than its minimum: the excess moves aside', restLen >= H.minLength * 0.9 && closeLen >= H.minLength * 0.9 && bow > 0.1, `at rest ${restLen.toFixed(2)} m, tip close ${closeLen.toFixed(2)} m, bowed ${bow.toFixed(2)} m aside`);
  v.hose.reset();

  // cleaning: he faces the mess and the nozzle goes to it before anything is sucked up
  freshVac(kit, 'K1', 3); v.hose.reset(); v.frozen = false; P.noclip = true;
  { const m = { id: 't2', x: 7.6, z: 4.3, room: 'x', decal: -1, cubes: [], cleaned: false };
    kit.debris.messes.push(m); v.heading = v.prevHeading = -1.2; v._startClean(m);
    let moved0 = v.cleanT; hold(0.15); const heldOff = v.cleanT === moved0;
    while (v.cleanT === moved0 && v.cleanWait < 3) kit.tick(dt);
    const d = Math.hypot(v.hose.tip.x - m.x, v.hose.tip.z - m.z), facing = Math.abs(Math.atan2(Math.sin(Math.atan2(m.x - v.x, m.z - v.z) - v.heading), Math.cos(Math.atan2(m.x - v.x, m.z - v.z) - v.heading)));
    report('he cleans with the tip of the hose, facing the mess', heldOff && d < 0.1 && facing < 0.3, `tip ${d.toFixed(2)} m from it`);
    while (!m.cleaned && v.cleanT < 2) kit.tick(dt);
    kit.debris.messes.pop(); }

  // being caught from the side or behind: the nozzle still comes round to get you
  P.noclip = false;
  freshVac(kit, 'H2', 2); v.hose.reset(); P.resetMotion(); P.teleport(v.x, 0.001, v.z + 0.3, 0); P.tick(dt); v.heading = v.prevHeading = Math.PI; caughtBy = null;
  v.frozen = false; kit.tick(dt);
  { const t = v.hose.tip, c = new V3(P.pos.x, P.feetY + 0.12, P.pos.z);
    report('caught from behind, by the nozzle, not the drum', caughtBy === 'snap' && t.distanceTo(c) < 0.05 && v.hose.pts.every((p) => Number.isFinite(p.x + p.y + p.z)), `tip ${t.distanceTo(c).toFixed(2)} m from the cat`); }

  v.onCatch = onCatch0; v.caught = false; freshVac(kit, 'L1', 1); v.hose.reset(); P.noclip = true;
  return rows;
}

/** The catch sequence, run by hand with the real hose path. */
function catchChecks(kit) {
  const v = kit.vac, P = kit.player, Q = kit.catchSeq, cam = kit.camera, K = TUNING.catch, dt = 1 / 60, rows = [];
  const report = (name, ok, note) => rows.push(`${ok ? 'ok  ' : 'FAIL'} CATCH ${name}${note ? ' (' + note + ')' : ''}`);
  const end0 = kit.endScreen.el.hidden;
  freshVac(kit, 'K4', 3); v.heading = v.prevHeading = 0; P.noclip = false; P.resetMotion(); P.teleport(8.5, 0.751, 2.9, 0); P.tick(dt);
  v._updateHose(dt); P.render(1); cam.updateMatrixWorld(true);
  v.frame(1);
  // the hose reaches out to the cat first, so the path is the real thing
  { const g = new (cam.position.constructor)(8.5, 0.87, 2.9); for (let i = 0; i < 60; i++) v.hose.tick(dt, v._hole(), v.heading, { mode: 'approach', goal: g, speed: 8 }); }
  P.render(1);
  const startPos = cam.position.clone(), hosePts = v.hose.pts.map((p) => p.clone());
  v._catch('hose');
  report('control locks and the camera starts moving', Q.active && Q.phase === 'drag' && P.frozen && v.caught);
  const froze = v.hose.pts.every((p, i) => p.distanceTo(hosePts[i]) < 1e-6);
  kit.tick(dt);
  report('the hose holds still for the ride', froze && v.hose.pts.every((p, i) => p.distanceTo(hosePts[i]) < 1e-6));
  let dragT = 0, away = 0, last = cam.position.distanceTo(Q.end), nearHose = 1e9, rolled = false;
  while (Q.phase === 'drag' && dragT < 3) {
    Q.update(dt); dragT += dt;
    const d = cam.position.distanceTo(Q.end); if (d > last + 0.2) away++; last = d;
    for (const p of hosePts) nearHose = Math.min(nearHose, cam.position.distanceTo(p));
    if (Math.abs(cam.rotation.z) > 0.3) rolled = true;
  }
  report('dragged along the real hose path in about 0.7 s', Math.abs(dragT - K.drag) < 0.05 && nearHose < 0.1 && away <= 1, `${dragT.toFixed(2)} s, passes ${nearHose.toFixed(3)} m from the hose`);
  report('no spinning on the way', !rolled);
  let holdT = 0; while (Q.phase === 'hold' && holdT < 4) { Q.update(dt); holdT += dt; }
  report('holds on his face for 1.2 s', Math.abs(holdT - K.hold) < 0.05, `${holdT.toFixed(2)} s`);
  const dir = new (cam.position.constructor)(); cam.getWorldDirection(dir);
  v.model.root.updateMatrixWorld(true);
  const toVac = new (cam.position.constructor)().setFromMatrixPosition(v.model.root.matrixWorld).setY((TUNING.vac.model.faceY + TUNING.vac.model.holeY) / 2).sub(cam.position).normalize();
  report('and it is looking straight at him', dir.dot(toVac) > 0.98, dir.dot(toVac).toFixed(3));
  report('face furious, in front of the hole', v.model.face.material.map === v.model.faces[4] && cam.position.distanceTo(Q.end) < 0.001);
  report('hard cut to black', !Q.cut.hidden && Q.phase === 'black');
  let beat = 0; while (Q.phase === 'black' && beat < 3) { Q.update(dt); beat += dt; }
  report('a beat, then Try again', Math.abs(beat - K.beat) < 0.05 && !kit.endScreen.el.hidden && Q.phase === 'done');
  void startPos; void end0;
  // tidy up for the win check that follows
  Q.reset(); kit.endScreen.el.hidden = true; kit.audio.resume(); P.frozen = false; v.caught = false; freshVac(kit, 'L1', 1); P.noclip = true;
  return rows;
}

/** Hearing, investigating and cleaning. */
function hearingChecks(kit) {
  const v = kit.vac, K = kit.knock, N = kit.noise, dt = 1 / 60, rows = [];
  const report = (name, ok, note) => rows.push(`${ok ? 'ok  ' : 'FAIL'} HEAR ${name}${note ? ' (' + note + ')' : ''}`);
  const crash = (x, z) => N.emit({ kind: 'crash', x, y: 0, z, loud: 0, room: 'test' });
  const count = K.count; K.count = 0;
  freshVac(kit, 'L1', 2); crash(v.x + 3, v.z);
  report('anger 1: goes to a crash nearby', v.state === 'INVESTIGATE');
  freshVac(kit, 'L1', 2); crash(16, -0.5);
  report('anger 1: ignores one far away', v.state === 'PATROL');
  freshVac(kit, 'L1', 3); crash(16, -0.5);
  report('anger 2: hears crashes anywhere', v.state === 'INVESTIGATE');
  freshVac(kit, 'H2', 3); N.emit({ kind: 'step', gait: 'walk', x: v.x + 3, y: 0, z: v.z });
  report('angry: ignores walking a few metres off', v.state === 'PATROL');
  freshVac(kit, 'H2', 3); N.emit({ kind: 'step', gait: 'walk', x: v.x + 1, y: 0, z: v.z });
  report('but hears it right next to him', v.state === 'INVESTIGATE');
  freshVac(kit, 'H2', 4); N.emit({ kind: 'step', x: v.x + 2, y: 0, z: v.z });
  report('anger 3: hears running close by', v.state === 'INVESTIGATE');
  freshVac(kit, 'H2', 4); N.emit({ kind: 'step', x: v.x + 6, y: 0, z: v.z });
  report('anger 3: but not far off', v.state === 'PATROL');
  freshVac(kit, 'H2', 2); N.emit({ kind: 'thud', x: v.x + 6, y: 0, z: v.z, radius: TUNING.vac.hearLand[1] });
  report('a heavy landing gives you away from far off', v.state === 'INVESTIGATE');
  freshVac(kit, 'H2', 2); N.emit({ kind: 'thud', x: v.x + 6, y: 0, z: v.z, radius: TUNING.vac.hearLand[1] * TUNING.vac.quietLand });
  report('landing with C held does not', v.state === 'PATROL');
  freshVac(kit, 'L1', 1); K.count = TUNING.vac.angerAt[0]; crash(16, -0.5);
  const a1 = v.anger; K.count = TUNING.vac.angerAt[1]; crash(16, -0.5);
  const a2 = v.anger; K.count = TUNING.vac.angerAt[2]; crash(16, -0.5);
  report('neutral until the first break, then rising', a1 === 2 && a2 === 3 && v.anger === 4, `${a1}, ${a2}, ${v.anger}`);
  freshVac(kit, 'L1', 1); K.count = 0; N.emit({ kind: 'step', x: v.x + 1, y: 0, z: v.z }); crash(v.x + 2, v.z);
  report('neutral: ignores everything', v.state === 'PATROL');
  K.count = count;

  // a real break, found and cleaned: progress stays
  freshVac(kit, 'K1', 2);
  const o = K.byId.get('k2Vase'), before = K.count;
  K._knockOver(o);
  const mess = kit.debris.messes.find((m) => m.id === 'k2Vase'), wake = kit.grandma.wake;
  let sawClean = false, t = 0;
  while (t < 45 && !mess.cleaned) { kit.tick(dt); t += dt; if (v.state === 'CLEAN') sawClean = true; }
  const moved = v.state;
  report('he goes to the mess and cleans it', sawClean && mess.cleaned, `${t.toFixed(1)} s`);
  report('cleaning never takes progress back', kit.grandma.wake === wake && K.count === before + 1);
  const m = new (kit.debris.cubes.instanceMatrix.array.constructor)(16); kit.debris.cubes.instanceMatrix.array.subarray(mess.cubes[0] * 16, mess.cubes[0] * 16 + 16).forEach((x, i) => { m[i] = x; });
  report('the debris is gone', Math.abs(m[0]) + Math.abs(m[1]) + Math.abs(m[2]) < 1e-3);
  report('he goes back on patrol', moved === 'PATROL' || moved === 'INVESTIGATE');
  freshVac(kit, 'L1', 1);
  return rows;
}

/** How many places the cord, as it lies now, passes through something solid. */
function cordCrossings(v, W) {
  const O = v.cord.outlet, T = v.tether, pts = [{ x: O.pos[0] + O.n[0] * 0.06, z: O.pos[2] + O.n[2] * 0.06 }, ...T, { x: v.x, z: v.z }];
  let n = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.05);
    for (let k = 0; k <= steps; k++) { const t = k / Math.max(1, steps); if (W.penetration(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.015, 0.005, 0.03) > 0) n++; }
  }
  return n;
}

/** Mr. Tidy: the graph, the patrol, the cord. */
function vacChecks(kit) {
  kit.vac.frozen = false; kit.player.noclip = true; // the cat is out of the picture for these
  const v = kit.vac, W = kit.world, V = TUNING.vac, dt = 1 / 60, rows = [];
  const report = (name, ok, note) => rows.push(`${ok ? 'ok  ' : 'FAIL'} VAC ${name}${note ? ' (' + note + ')' : ''}`);
  const bad = v.nav.blockedEdges(W, V.radius, V.height);
  report('every graph edge fits his body', bad.length === 0, bad.join(' '));
  const orphan = [...v.nav.nodes.values()].filter((n) => !v.nav.path(v.nav.nodes.get(LEVEL.vacStart), n).length);
  report('every waypoint can be reached', orphan.length === 0, orphan.map((n) => n.id).join(' '));

  // a whole lap of the patrol: he keeps moving and stays clear of everything
  for (const m of kit.debris.messes) m.cleaned = true;
  v.pending = null; v.setAnger(1); v._resumePatrol();
  const seen = new Set(); let hoseIn = 0, cordIn = 0, hit = 0, stalled = 0, tx = v.x, tz = v.z, i = 0, maxPaid = 0, retraces = 0, wasRetracing = false, count = v.tether.length;
  const start = v.routeI;
  for (i = 0; i < 60 * 300; i++) {
    kit.tick(dt);
    seen.add(v.path[v.pathI].id); maxPaid = Math.max(maxPaid, v._paid());
    if (v.tether.length < count) retraces++; count = v.tether.length; wasRetracing = v._retracing(); void wasRetracing;
    if (W.penetration(v.x, v.z, V.radius - 0.03, 0.03, V.height) > 0) hit++;
    if (i % 60 === 0) { if (Math.hypot(v.x - tx, v.z - tz) < 0.05) stalled++; tx = v.x; tz = v.z; }
    if (i % 10 === 0) { for (const p of v.hose.pts) if (W.penetration(p.x, p.z, 0.015, p.y - 0.01, p.y + 0.01, null, p.y - 0.01) > 0) hoseIn++; cordIn += cordCrossings(v, W); }
    if (i > 600 && v.routeI === start) break;
  }
  report('over a whole lap, the cord and hose stay out of walls and furniture', hoseIn === 0 && cordIn === 0, `${hoseIn} hose, ${cordIn} cord`);
  report('a full patrol lap, moving, never inside anything', hit === 0 && stalled <= 3 && seen.size >= 15, `${(i / 60).toFixed(0)} s, ${seen.size} waypoints, ${stalled} stalls, ${hit} overlaps`);

  // the cord: every waypoint is in reach, and he never runs past its end
  const Lc = TUNING.cord.length, nodes = [...v.nav.nodes.values()];
  const farFrom = (o) => Math.max(...nodes.map((n) => v.nav.lengthOf(v.nav.path(v.nav.nodes.get(o.node), n))));
  const worst = Math.max(...LEVEL.outlets.map(farFrom));
  report('from any outlet the cord reaches every room', worst < Lc && farFrom(LEVEL.outlets[0]) > Lc * 0.6, `farthest ${worst.toFixed(1)} m of ${Lc}`);
  report('he starts plugged in beside her door', v.cord.outlet.id === 'grandma' && Math.hypot(LEVEL.outlets[0].pos[0] - 18, LEVEL.outlets[0].pos[2] + 0.7) < 1.5);
  report('the patrol lap never ran past the end of the cord', maxPaid <= Lc + 0.05, `most paid out ${maxPaid.toFixed(1)} m`);
  report('he has to go back the way he came', retraces > 3, `${retraces} waypoints retraced in a lap`);
  const full = v.model.reelSpin.scale.x; v.model.setReel(1, 0); const empty = v.model.reelSpin.scale.x; v.model.setReel(0, 0); const packed = v.model.reelSpin.scale.x;
  report('the reel shrinks as cord pays out', empty < packed, `${packed.toFixed(3)} full, ${empty.toFixed(3)} paid out`);
  void full;

  // unplugging him: the right outlet, from the right side, knocks him out, and he comes back on the nearest one
  {
    const cam = kit.camera, look = (x, y, z, tx2, ty, tz2) => { cam.position.set(x, y, z); cam.lookAt(tx2, ty, tz2); cam.updateMatrixWorld(true); };
    const K3 = v.nav.nodes.get('K3'); v.x = v.px = K3.x; v.z = v.pz = K3.z;
    v.tether = v.nav.path(v.nav.nodes.get('H4'), K3); v.path = [K3]; v.pathI = 0; v.frozen = false;
    const home = v.cord.outlet.pos, p = v.cord.plugPos;
    look(p.x - 3, 0.25, p.z - 1, p.x, p.y, p.z);
    report('an outlet out of reach does nothing', v.swipeOutlet(cam) === false && v.plugState === 'in');
    look(p.x, 0.25, p.z + 0.35, p.x, p.y, p.z);
    report('nor from the far side of the wall', v.swipeOutlet(cam) === false && v.plugState === 'in');
    const other = LEVEL.outlets.find((o) => o.id === 'hall1');
    look(other.pos[0], 0.25, other.pos[2] - 0.35, other.pos[0], other.pos[1], other.pos[2]);
    report('nor an outlet he is not plugged into', v.swipeOutlet(cam) === false && v.plugState === 'in');
    look(p.x, 0.25, p.z - 0.35, p.x, p.y, p.z);
    v.setAnger(4); const hit = v.swipeOutlet(cam);
    report('swiping his outlet unplugs him', hit && v.state === 'UNPLUGGED' && !v.model.face.visible);
    report('and leaves him at stage 3', v.anger === TUNING.cord.unplugAnger, `${v.anger}`);
    const ux = v.x, C = TUNING.cord;
    for (let t = 0; t < Math.ceil(C.retract * 60) + 2; t++) kit.tick(dt);
    report('the cord goes back to him', v.cord.trim === 1 && v.plugState === 'dead');
    for (let t = 0; t < Math.ceil(C.off * 60) - 4; t++) kit.tick(dt);
    report('he stays dead for a while', v.x === ux && v.plugState === 'dead');
    for (let t = 0; t < 8; t++) kit.tick(dt);
    report('then reaches out to the nearest outlet', v.plugState === 'extend' && v.cord.outlet.id === 'kitchen1', `${v.cord.outlet.id}`);
    for (let t = 0; t < Math.ceil(C.extend * 60) + 2; t++) kit.tick(dt);
    report('and moves again, face back on', v.plugState === 'in' && v.state === 'PATROL' && v.model.face.visible && v.cord.trim === 0 && v.tether[0].id === 'K3', `tether from ${v.tether[0].id}`);
    const q = v.cord.plugPos;
    look(q.x - 0.35, 0.25, q.z, q.x, q.y, q.z);
    report('the new plug cannot be hit straight away', v.swipeOutlet(cam) === false && v.plugState === 'in');
    void home;
  }

  // the drone's shape: louder as he nears, steepest close up, never silent
  const lv = [0.5, 1, 2, 4, 8, 16].map((d) => v.droneLevel(d));
  report('the drone rises steeply as he nears, and is never silent', lv.every((x, i) => i === 0 || x < lv[i - 1]) && lv[1] > lv[3] * 3 && lv[5] >= TUNING.drone.floor, lv.map((x) => x.toFixed(2)).join(' '));
  const rates = TUNING.drone.rate;
  report('its pitch rises with anger', rates[0] < rates[1] && rates[1] < rates[2]);
  v.setAnger(4); const furious = v.model.face.material.map === v.model.faces[4]; v.setAnger(1);
  report('his face follows his anger', furious && v.model.face.material.map === v.model.faces[1]);
  // F8
  const fx = v.x; v.frozen = true; for (let t = 0; t < 30; t++) kit.tick(dt);
  report('F8 holds him still', v.x === fx);
  v.frozen = false;
  return rows;
}

/** A new run from a finished one, without a reload: nothing left over. */
function restartChecks(kit) {
  const v = kit.vac, K = kit.knock, D = kit.debris, G = kit.grandma, P = kit.player, Q = kit.catchSeq, dt = 1 / 60, rows = [], S = TUNING.house.spawn;
  const report = (name, ok, note) => rows.push(`${ok ? 'ok  ' : 'FAIL'} RUN ${name}${note ? ' (' + note + ')' : ''}`);
  const fresh = () => K.count === 0 && D.messes.length === 0 && D.live.length === 0 && G.wake === 0 && G.stage === 0 && !G.awake
    && K.list.every((o) => o.state === 'rest' && !o.knocked && o.mesh.visible && o.x === o.start.x && o.y === o.start.y)
    && v.state === 'PATROL' && !v.off && !v.caught && !v.frozen && v.anger === 1 && v.model.face.visible && v.model.face.material.map === v.model.faces[1]
    && v.cord.outlet.id === 'grandma' && v.cord.trim === 0 && v.tether[0].id === 'H4' && v.plugState === 'in'
    && !P.frozen && P.mode === 'move' && P.pos.x === S.x && P.pos.z === S.z && !kit.ended && kit.endScreen.el.hidden && Q.cut.hidden && !Q.active && kit.runTime === 0;

  // a finished, won run
  report('the win left the run over', kit.ended && G.awake && v.off);
  kit.resetRun();
  report('Play again: everything back as it started', fresh());
  // some mischief, then caught
  K._knockOver(K.byId.get('standJar')); K._knockOver(K.byId.get('mug2'));
  report('a new run plays: objects break again and count', K.count === 2 && D.messes.length === 2 && G.wake > 0);
  for (let i = 0; i < 60; i++) kit.tick(dt);
  P.render(1); kit.camera.updateMatrixWorld(true);
  v._catch('hose');
  for (let i = 0; i < 400 && Q.phase !== 'done'; i++) Q.update(dt);
  report('a catch ends it in Try again', Q.phase === 'done' && !kit.endScreen.el.hidden && kit.ended);
  kit.resetRun();
  report('Restart: everything back as it started', fresh());
  for (let i = 0; i < 120; i++) kit.tick(dt);
  report('and he is patrolling, the cat is free', v.state === 'PATROL' && (v.x !== v.nav.nodes.get('L1').x || v.z !== v.nav.nodes.get('L1').z) && !kit.ended);
  return rows;
}

/** Wake meter and the win. This runs last: winning ends the run. */
function grandmaChecks(kit) {
  const G = kit.grandma, K = kit.knock, dt = 1 / 60, rows = [];
  const report = (name, ok, note) => rows.push(`${ok ? 'ok  ' : 'FAIL'} WAKE ${name}${note ? ' (' + note + ')' : ''}`);
  // how many knock-overs a run takes, from the real numbers
  const values = K.list.map((o) => G.valueOf(o.start.x, o.start.z, o.t.noise)).sort((a, b) => b - a);
  const total = values.reduce((a, b) => a + b, 0), avg = total / values.length;
  let best = 0, sum = 0; while (sum < 100 && best < values.length) sum += values[best++];
  let worst = 0; sum = 0; for (let i = values.length - 1; i >= 0 && sum < 100; i--) { sum += values[i]; worst++; }
  report('a run takes about 10–14 knock-overs', 100 / avg >= 10 && 100 / avg <= 14 && total >= 100, `average ${(100 / avg).toFixed(1)}, loudest-first ${best}, quietest-first ${worst}, all 20 give ${total.toFixed(0)}`);
  const near = G.valueOf(17, -0.7, 10), far = G.valueOf(1, 5, 10);
  report('a crash near her door counts for more', near > far * 1.8, `${near.toFixed(1)} vs ${far.toFixed(1)}`);
  const w0 = G.wake; G.add(-30); G.add(0);
  report('the meter never goes down', G.wake === w0);
  const before = G.wake; kit.noise.emit({ kind: 'step', x: 17, y: 0, z: -0.7 }); kit.noise.emit({ kind: 'thud', x: 17, y: 0, z: -0.7 });
  report('footsteps and thuds do not wake her', G.wake === before);
  const seen = []; for (const w of [0, 24.9, 25, 49.9, 50, 74.9, 75, 99.9, 100]) seen.push(G.stageOf(w));
  report('stages line up with the thresholds', seen.join('') === '001122334', seen.join(''));
  // the win
  kit.player.resetMotion();
  G.add(200);
  const atWake = G.awake && G.wake === 100 && kit.player.frozen;
  for (let i = 0; i < Math.ceil(TUNING.grandma.winBeat / dt) + 3; i++) kit.tick(dt);
  report('100 wakes her and ends in the Good Kitty screen', atWake && G.stage === 4 && !kit.endScreen.el.hidden);
  report('the win powers the vac down, face dark', kit.vac.off && !kit.vac.model.face.visible);
  return rows;
}

/** Searches the whole house for slots the cat can fall into but not fit in: pushed from both sides, nowhere to go. */
function pocketScan(kit) {
  const W = kit.world, P = TUNING.player, r = P.radius, found = new Map(), p = { x: 0, z: 0 }, g = { y: 0, surface: '', collider: null };
  for (const y of [0.05, 0.3, 0.6, 1.0, 1.3, 1.6, 1.9, 2.1]) {
    const low = y + P.stepHeight, high = y + P.height;
    for (let x = -0.1; x < 18.1; x += 0.03) for (let z = -1.45; z < 5.45; z += 0.03) {
      W.ground(x, z, r * P.edgeSupport, y + P.stepHeight, g);
      if (g.y >= y - 0.05) continue; // something underfoot: the cat stands, it doesn't drop in
      W.ground(x, z, r * P.edgeSupport, 3, g);
      if (g.y > y) continue; // covered from above by something it would land on: it can't get in from the top
      if (W.penetration(x, z, 0.001, low, high, null, y) > 0) continue; // inside something solid
      if (W.penetration(x, z, r, low, high, null, y) <= 0.02) continue;
      p.x = x; p.z = z;
      W.resolve(p, r, low, high, null, 8, y);
      if (W.penetration(p.x, p.z, r, low, high, null, y) <= 0.02) continue; // a single wall just pushes the cat away
      // only a real pocket if the cat's whole body fits right above it: otherwise it can never have come in from the top
      let open = false;
      for (let u = y + 0.1; u < 2.9 && !open; u += 0.1) if (W.penetration(x, z, r, u + P.stepHeight, u + P.height, null, u) === 0) open = true;
      if (!open) continue;
      const key = `${x.toFixed(1)},${z.toFixed(1)}`;
      if (!found.has(key)) found.set(key, y);
    }
  }
  const rows = [];
  rows.push(`${found.size ? 'FAIL' : 'ok  '} POCKET no slots the cat can drop into but not fit${found.size ? ' at ' + [...found.keys()].slice(0, 30).join(' ; ') : ''}`);
  // the failsafe: put the cat where it doesn't fit, and it must free itself
  const K = kit.player, I = kit.input, dt = 1 / 60;
  I.keys.clear(); K.resetMotion(); K.teleport(7.0, 0.001, 0.65, Math.PI); K.grounded = true; K.feetY = 0; K.eyeFeet = 0;
  I.keys.add('KeyW'); I.keys.delete('KeyW');
  let t = 0;
  while (t < 1.5 && W.penetration(K.pos.x, K.pos.z, r, K.feetY + P.stepHeight, K.feetY + P.height, null, K.feetY) > 0.02) { I.keys.add('KeyA'); kit.tick(dt); t += dt; }
  I.keys.clear();
  rows.push(`${t < 1.5 ? 'ok  ' : 'FAIL'} POCKET a wedged cat frees itself (${t.toFixed(2)} s)`);
  return rows;
}

/** The swipe and knockable physics with the real objects. */
function knockChecks(kit) {
  const P = kit.player, I = kit.input, K = kit.knock, dt = 1 / 60, rows = [];
  const report = (name, ok, note) => rows.push(`${ok ? 'ok  ' : 'FAIL'} KNOCK ${name}${note ? ' (' + note + ')' : ''}`);
  const settle = (o) => { for (let i = 0; i < 300 && o.state !== 'rest' && o.state !== 'gone'; i++) kit.tick(dt); };
  const stand = (x, y, z, yaw, pitch = 0) => { I.keys.clear(); I.edges.clear(); P.frozen = false; P.resetMotion(); P.teleport(x, y + 0.001, z, yaw); P.yaw = yaw; P.pitch = pitch; for (let i = 0; i < 6 && !P.grounded; i++) kit.tick(dt); P.render(1); kit.camera.updateMatrixWorld(); };

  // a real click: the paw knocks a mug off the coffee table
  const mug = K.byId.get('mug1');
  stand(3.42, 0.42, 2.35, Math.PI / 2, -0.25);
  I.edges.add('Mouse0'); kit.tick(dt);
  for (let i = 0; i < 12; i++) kit.tick(dt);
  const hit = mug.state !== 'rest';
  settle(mug);
  const mess = kit.debris.messes.find((m) => m.id === 'mug1'), noise = kit.noise.last;
  report('a broken mug: gone, cubes, one mess, one crash', mug.state === 'gone' && !!mess && mess.cubes.length >= 3 && mess.cubes.length <= 6 && noise?.kind === 'crash' && noise.objectId === 'mug1' && kit.knock.count === 1, `${mess?.cubes.length} cubes, room ${mess?.room}, count ${kit.knock.count}`);
  report('click swipes a mug off the table', hit && mug.y === 0, `ended at ${mug.x.toFixed(2)}, ${mug.y.toFixed(2)}, ${mug.z.toFixed(2)}`);

  // a heavy book only inches: it takes several swipes to reach the edge
  const book = K.byId.get('book1');
  let swipes = 0;
  while (swipes < 20 && book.y > 0.5) {
    stand(book.x - 0.3, 0.9, book.z, -Math.PI / 2, -0.3);
    K.swipe(P, kit.camera); swipes++;
    settle(book);
  }
  report('a heavy book takes several swipes', swipes >= 2 && swipes <= 8 && book.y === 0, `${swipes} swipes`);

  // falling onto a lower surface: it lands there, it doesn't clip through
  const plate = K.byId.get('plate1');
  K.shove(plate, -1, 0, 1.2);
  settle(plate);
  report('plate lands on the lower shelf', Math.abs(plate.y - 1.4) < 0.01, `ended at height ${plate.y.toFixed(2)}`);

  // nothing is left in a broken state
  // a heavy book doesn't break: it's on the floor, counted once, with a mess
  report('an unbreakable book stays whole and counts once', book.state === 'rest' && book.knocked && kit.debris.messes.filter((m) => m.id === 'book1').length === 1 && kit.knock.count === 2, `count ${kit.knock.count}`);
  K.shove(book, 1, 0, 1); settle(book);
  report('knocking it around the floor again does not recount', kit.knock.count === 2);

  // something standing on the floor topples where it is
  const fv = K.byId.get('floorVaseL');
  stand(fv.x - 0.3, 0, fv.z, -Math.PI / 2, -0.15);
  const before = kit.knock.count, hits = K.swipe(P, kit.camera);
  report('a swipe topples a floor vase', hits >= 1 && fv.state === 'gone' && kit.knock.count === before + 1, `hits ${hits}`);

  // cubes settle on the floor and stop
  for (let i = 0; i < 240; i++) kit.tick(dt);
  report('debris settles', kit.debris.live.length === 0, `${kit.debris.nextCube} cubes placed`);
  report('all 20 objects placed, each over a surface', K.list.length === 20 && K.list.filter((o) => o.state === 'rest' || o.knocked).every((o) => { const g = kit.world.ground(o.start.x, o.start.z, 0.01, o.start.y + 0.04, { y: 0, surface: '', collider: null }); return Math.abs(g.y - o.start.y) < 0.001; }));

  report('every object has finite numbers', K.list.every((o) => Number.isFinite(o.x + o.y + o.z + o.q.w)));
  return rows;
}

/** Claw climbing with the real controller: to the top, out of stamina, and a kick-off. */
function climbChecks(kit) {
  const P = kit.player, I = kit.input, dt = 1 / 60, rows = [];
  const put = (x, y, z, yaw) => { I.keys.clear(); I.edges.clear(); P.frozen = false; P.resetMotion(); P.teleport(x, y, z, yaw); P.yaw = yaw; for (let i = 0; i < 6 && !P.grounded; i++) kit.tick(dt); };
  const report = (name, ok, note) => rows.push(`${ok && Number.isFinite(P.pos.x + P.pos.z + P.feetY) ? 'ok  ' : 'FAIL'} CLIMB ${name}${note ? ' (' + note + ')' : ''}`);

  // the scratch panel from the floor: all the way up, over the top
  put(5.55, 0.001, 4.75, Math.PI); I.keys.add('KeyW');
  let climbed = false, t = 0;
  while (t < 4 && !(P.grounded && P.feetY > 1)) { kit.tick(dt); t += dt; if (P.mode === 'climb') climbed = true; }
  I.keys.clear();
  report('floor -> scratchPanel top', climbed && P.groundCollider?.id === 'scratchPanel', `${t.toFixed(2)} s, stamina ${P.stamina.toFixed(2)}`);

  // out of stamina part-way: slides down cleanly to the floor
  put(5.55, 0.001, 4.75, Math.PI); P.stamina = 0.15; I.keys.add('KeyW');
  let slid = false, top = 0; t = 0;
  while (t < 5 && !(slid && P.grounded)) { kit.tick(dt); t += dt; top = Math.max(top, P.feetY); if (P.mode === 'slide') slid = true; }
  I.keys.clear();
  report('stamina runs out: slides to the floor', slid && P.grounded && P.feetY === 0, `reached ${top.toFixed(2)} m`);

  // the couch's striped south end: a short climb onto the arm
  put(0.8, 0.001, 4.3, 0); I.keys.add('KeyW'); t = 0;
  while (t < 3 && !(P.grounded && P.feetY > 0.3)) { kit.tick(dt); t += dt; }
  I.keys.clear();
  report('floor -> couch arm', P.groundCollider?.id === 'couchArmS');

  // curtains: climb the fabric, end up on the rod
  put(3.0, 0.001, 4.75, Math.PI); I.keys.add('KeyW'); t = 0;
  while (t < 4 && !(P.grounded && P.feetY > 1)) { kit.tick(dt); t += dt; }
  I.keys.clear();
  report('floor -> curtain -> rodW', P.groundCollider?.id === 'rodW', `${t.toFixed(2)} s`);

  // the kitchen's climbed way up
  put(9.5, 0.001, 4.75, Math.PI); I.keys.add('KeyW'); t = 0;
  while (t < 4 && !(P.grounded && P.feetY > 1)) { kit.tick(dt); t += dt; }
  I.keys.clear();
  report('floor -> kitchenPanel top', P.groundCollider?.id === 'kitchenPanel', `${t.toFixed(2)} s`);

  // cling: let go of W mid-climb and stay put, draining slowly; then S climbs back down to the floor
  put(5.55, 0.001, 4.75, Math.PI); I.keys.add('KeyW');
  for (let i = 0; i < 50; i++) kit.tick(dt);
  I.keys.clear();
  const y0 = P.feetY, s0 = P.stamina;
  for (let i = 0; i < 60; i++) kit.tick(dt);
  const clung = P.mode === 'climb' && Math.abs(P.feetY - y0) < 1e-6;
  report('clings still when no key is held', clung, `drained ${(s0 - P.stamina).toFixed(3)} in 1 s`);
  I.keys.add('KeyS'); t = 0;
  while (t < 4 && !P.grounded) { kit.tick(dt); t += dt; }
  I.keys.clear();
  report('S climbs down to the floor', P.grounded && P.feetY === 0);

  // jump at a climbable face with no keys held: the claws catch it
  put(5.55, 0.001, 4.35, Math.PI); I.keys.add('Space'); I.edges.add('Space');
  for (let i = 0; i < 22; i++) kit.tick(dt);
  I.keys.clear(); t = 0;
  while (t < 1.5 && P.mode !== 'climb' && !(P.grounded && t > 0.1)) { kit.tick(dt); t += dt; }
  report('jumping at a climbable face clings to it', P.mode === 'climb', `mode ${P.mode}, height ${P.feetY.toFixed(2)}`);
  I.keys.add('KeyC'); kit.tick(dt); I.keys.clear(); for (let i = 0; i < 90; i++) kit.tick(dt);

  // the dash
  put(2.4, 0.001, 1.0, Math.PI); let z0 = P.pos.z;
  I.keys.add('ShiftLeft'); I.edges.add('ShiftLeft'); kit.tick(dt); I.keys.clear();
  for (let i = 0; i < 10; i++) kit.tick(dt);
  report('no dash on the ground', P.dashT <= 0 && Math.abs(P.pos.z - z0) < 0.05, `moved ${(P.pos.z - z0).toFixed(2)} m`);
  put(2.4, 0.001, 1.0, Math.PI);
  I.keys.add('Space'); I.edges.add('Space'); kit.tick(dt); I.keys.clear(); for (let i = 0; i < 4; i++) kit.tick(dt);
  z0 = P.pos.z; const yAir = P.feetY;
  I.edges.add('ShiftLeft'); kit.tick(dt);
  for (let i = 0; i < 8; i++) kit.tick(dt);
  const first = P.pos.z - z0, level = Math.abs(P.feetY - yAir) < 0.001;
  for (let i = 0; i < 40 && !P.airDashUsed; i++) kit.tick(dt);
  P.dashCd = 0;
  I.edges.add('ShiftLeft'); kit.tick(dt);
  report('air dash travels level, and only once', first > 0.5 && level && P.airDashUsed && P.dashT <= 0, `${first.toFixed(2)} m`);
  for (let i = 0; i < 90 && !P.grounded; i++) kit.tick(dt);
  report('landing refreshes the air dash', P.grounded && !P.airDashUsed);

  // the target never creeps back as the charge builds, walking or standing
  for (const [name, keys] of [['standing', []], ['walking', ['KeyW']], ['running', ['KeyW', 'ShiftLeft']]]) {
    put(2.4, 0.001, 1.0, Math.PI);
    for (const key of keys) I.keys.add(key);
    for (let i = 0; i < 20; i++) kit.tick(dt);
    I.keys.add('Space'); I.edges.add('Space');
    let prev = -1, backs = 0, frames = 0;
    for (let i = 0; i < 30; i++) { kit.tick(dt); if (P.aim.ok && P.aim.kind === 'land') { if (P.aim.z < prev - 1e-4) backs++; prev = P.aim.z; frames++; } }
    I.keys.clear();
    report(`target never retracts while charging, ${name}`, frames > 15 && backs === 0, `${backs} backsteps in ${frames} ticks`);
    I.keys.add('KeyC'); kit.tick(dt); I.keys.clear(); for (let i = 0; i < 30 && !P.grounded; i++) kit.tick(dt);
  }

  // hold Space while clinging: a charged spring, and it goes further than a tap
  put(5.55, 0.001, 4.75, Math.PI); I.keys.add('KeyW');
  for (let i = 0; i < 40; i++) kit.tick(dt);
  I.keys.clear(); P.yaw = 0; const h0 = P.feetY;
  I.keys.add('Space'); I.edges.add('Space'); kit.tick(dt);
  for (let i = 0; i < 44; i++) kit.tick(dt);
  const stuck = P.mode === 'climb' && Math.abs(P.feetY - h0) < 1e-6, aimed = P.aim.ok, c1 = P.charge;
  I.keys.clear(); kit.tick(dt);
  report('hold Space on a wall charges a spring jump', stuck && aimed && c1 > 0.9 && P.mode === 'move' && P.vy > 4.5, `charge ${c1.toFixed(2)}, vy ${P.vy.toFixed(2)}`);
  for (let i = 0; i < 120 && !P.grounded; i++) kit.tick(dt);

  // walking while holding a charge: it isn't cancelled, and the target keeps up with no blinks or stale spots
  put(2.4, 0.001, 1.0, Math.PI);
  I.keys.add('Space'); I.edges.add('Space');
  let blinks = 0, stale = 0, gaps = 0; const M = kit.marker;
  const script = [['KeyW', 50], ['KeyA', 40], ['KeyD', 40], ['KeyS', 30], ['KeyW', 40]];
  for (const [key, n] of script) {
    I.keys.add(key);
    for (let i = 0; i < n; i++) { kit.tick(dt); if (!P.aim.ok) blinks++; M.update(P.aim, dt, P); if (Math.hypot(M.goal.x - P.aim.x, M.goal.z - P.aim.z) > 1e-6) stale++; }
    I.keys.delete(key);
    kit.tick(dt); if (!P.aim.ok) gaps++;
  }
  const alive = P.charging && P.grounded;
  I.keys.clear(); kit.tick(dt); M.update(P.aim, dt, P);
  report('walking while charging keeps the charge, target follows', alive && blinks === 0 && gaps === 0 && stale === 0, `${blinks} blinks, ${stale} stale`);
  for (let i = 0; i < 90 && !P.grounded; i++) kit.tick(dt);

  // standing still at full charge still gives up eventually
  put(2.4, 0.001, 1.0, Math.PI);
  I.keys.add('Space'); I.edges.add('Space');
  for (let i = 0; i < 110; i++) kit.tick(dt);
  report('standing still at full charge calls it off', !P.charging && P.grounded);
  I.keys.clear(); kit.tick(dt);

  // walking at an edge while charging: it stops at the lip instead of dropping off
  put(7.75, 0.901, 0.4, -Math.PI / 2);
  I.keys.add('Space'); I.edges.add('Space'); kit.tick(dt); I.keys.add('KeyW');
  for (let i = 0; i < 120; i++) kit.tick(dt);
  const safe = P.charging && P.grounded && P.groundCollider?.id === 'c1';
  I.keys.clear(); kit.tick(dt);
  report('charging at an edge stays on it, then jumps', safe && !P.grounded && P.vy > 0, `x ${P.pos.x.toFixed(2)}`);
  for (let i = 0; i < 120 && !P.grounded; i++) kit.tick(dt);

  // moving along a ledge, and round its corner
  put(12.8, 0.001, 1.6, Math.PI / 2);
  I.keys.add('Space'); I.edges.add('Space'); kit.tick(dt);
  for (let i = 0; i < 36; i++) kit.tick(dt);
  I.keys.delete('Space'); I.keys.add('KeyW');
  for (let i = 0; i < 80 && P.mode !== 'hang'; i++) kit.tick(dt);
  I.keys.clear(); for (let i = 0; i < 12; i++) kit.tick(dt);
  const zh = P.pos.z, nx0 = P.hang.nx; I.keys.add('KeyD');
  for (let i = 0; i < 30; i++) kit.tick(dt);
  const movedAlong = Math.abs(P.pos.z - zh);
  report('A / D moves along a ledge', P.mode === 'hang' && movedAlong > 0.15, `${movedAlong.toFixed(2)} m`);
  for (let i = 0; i < 110 && P.hang.nx === nx0 && P.mode === 'hang'; i++) kit.tick(dt);
  I.keys.clear(); for (let i = 0; i < 8; i++) kit.tick(dt);
  report('and goes round the corner', P.mode === 'hang' && P.hang.nx !== nx0, `normal ${P.hang.nx.toFixed(0)}, ${P.hang.nz.toFixed(0)}`);
  I.edges.add('Space'); I.keys.add('Space'); kit.tick(dt); I.keys.clear();
  for (let i = 0; i < 40 && !P.grounded; i++) kit.tick(dt);
  report('and can still pull up from there', P.groundCollider?.id === 'w1');
  for (let i = 0; i < 4; i++) kit.tick(dt);

  // sideways on a climbable face: moves, animates, and stops at the end instead of falling off
  put(5.7, 0.001, 4.75, Math.PI); I.keys.add('KeyW');
  for (let i = 0; i < 40; i++) kit.tick(dt);
  I.keys.clear(); I.keys.add('KeyD');
  const xc = P.pos.x, dc = P.climbDist;
  for (let i = 0; i < 40; i++) kit.tick(dt);
  const sidestep = Math.abs(P.pos.x - xc), animated = P.climbDist > dc + 0.05;
  for (let i = 0; i < 90; i++) kit.tick(dt);
  report('sideways on a wall moves, animates, stops at the end', P.mode === 'climb' && sidestep > 0.15 && animated && P.pos.x >= 5.3 - 1e-3 && P.pos.x <= 5.8 + 1e-3, `moved ${sidestep.toFixed(2)} m, ends x ${P.pos.x.toFixed(2)}`);
  I.keys.clear(); I.keys.add('KeyC'); kit.tick(dt); I.keys.clear(); for (let i = 0; i < 90; i++) kit.tick(dt);

  // the target sticks to a small perch as the charge builds past it, and the jump lands where the target is
  put(7.52, 0.001, 3.85, 0);
  I.keys.add('Space'); I.edges.add('Space');
  let onChair = 0, extra = 0, sawStuck = false;
  for (let i = 0; i < 44; i++) {
    kit.tick(dt);
    if (P.aim.ok && P.aim.col?.id === 'chair') { onChair++; if (P.aim.stuck) { sawStuck = true; extra++; if (extra >= 4) break; } }
  }
  I.keys.clear();
  for (let i = 0; i < 90 && !(P.grounded && i > 3); i++) kit.tick(dt);
  report('the target holds on a perch, and the jump lands on it', sawStuck && P.groundCollider?.id === 'chair', `${onChair} ticks on the chair, ${extra} held, ended on ${P.groundCollider?.id || 'floor'}`);

  // a kick-off, up the panel: looking back into the room, leaves the wall and flies
  put(5.55, 0.001, 4.75, Math.PI); I.keys.add('KeyW');
  for (let i = 0; i < 60; i++) kit.tick(dt);
  const before = P.pos.z;
  P.yaw = 0; I.edges.add('Space'); kit.tick(dt); I.keys.clear();
  const kicked = P.mode === 'move' && !P.grounded && P.vy > 0;
  for (let i = 0; i < 20; i++) kit.tick(dt);
  report('kick-off leaves the wall', kicked && P.pos.z < before - 0.3, `moved ${(before - P.pos.z).toFixed(2)} m`);

  // slink is silent: no footstep events
  let steps = 0; const prevOnStep = P.onStep; P.onStep = () => { steps++; };
  put(2.0, 0.001, 1.8, -Math.PI / 2); I.keys.add('KeyW'); I.keys.add('KeyC');
  for (let i = 0; i < 90; i++) kit.tick(dt);
  I.keys.clear(); P.onStep = prevOnStep;
  report('slink makes no footsteps', steps === 0, `${steps} steps`);
  return rows;
}

export function runRouteBot(kit) {
  kit.vac.frozen = true; // keep him out of the jump tests
  const byId = kit.house.byId, rows = [];
  for (const [a, b, start] of LEVEL.grabLinks) {
    const from = a === 'floor' ? null : byId.get(a), to = byId.get(b);
    let best = null, lastOn = '';
    for (let c = 0.3; c <= 1.0001; c += 0.05) {
      const r = grabAttempt(kit, from, to, start, Math.min(1, c));
      lastOn = r.on;
      if (r.ok) { best = Math.min(1, c); break; }
    }
    rows.push(`${best === null ? 'FAIL' : 'ok  '} GRAB ${a} -> ${b}${best === null ? ` (ended on ${lastOn})` : ` charge ${best.toFixed(2)}`}`);
  }
  for (const [a, b] of LEVEL.links) {
    for (const [from, to] of [[byId.get(a), byId.get(b)], [byId.get(b), byId.get(a)]]) {
      let best = null, lastOn = '';
      for (let c = 0; c <= 1.0001 && best === null; c += 0.05) for (const shift of [0, 0.15, -0.15]) {
        const r = attempt(kit, from, to, Math.min(1, c), null, shift);
        lastOn = r.on || r.why;
        if (r.landed) { best = Math.min(1, c); break; }
      }
      rows.push(`${best === null ? 'FAIL' : 'ok  '} ${from.id} -> ${to.id}${best === null ? ` (ended on ${lastOn})` : ` charge ${best.toFixed(2)}`}`);
    }
  }
  rows.push(...climbChecks(kit));
  rows.push(...knockChecks(kit));
  rows.push(...pocketScan(kit));
  rows.push(...vacChecks(kit));
  rows.push(...hearingChecks(kit));
  rows.push(...huntChecks(kit));
  rows.push(...hoseChecks(kit));
  rows.push(...catchChecks(kit));
  rows.push(...grandmaChecks(kit));
  rows.push(...restartChecks(kit));
  const failed = rows.filter((r) => r.startsWith('FAIL'));
  return { total: rows.length, failed: failed.length, failures: failed, rows };
}
