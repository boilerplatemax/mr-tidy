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

/** Mr. Tidy: the graph, the patrol, the cord. */
function vacChecks(kit) {
  const v = kit.vac, W = kit.world, V = TUNING.vac, dt = 1 / 60, rows = [];
  const report = (name, ok, note) => rows.push(`${ok ? 'ok  ' : 'FAIL'} VAC ${name}${note ? ' (' + note + ')' : ''}`);
  const bad = v.nav.blockedEdges(W, V.radius, V.height);
  report('every graph edge fits his body', bad.length === 0, bad.join(' '));
  const orphan = [...v.nav.nodes.values()].filter((n) => !v.nav.path(v.nav.nodes.get(LEVEL.vacStart), n).length);
  report('every waypoint can be reached', orphan.length === 0, orphan.map((n) => n.id).join(' '));

  // a whole lap of the patrol: he keeps moving and stays clear of everything
  const seen = new Set(); let hit = 0, stalled = 0, tx = v.x, tz = v.z, i = 0;
  const start = v.routeI;
  for (i = 0; i < 60 * 240; i++) {
    kit.tick(dt);
    seen.add(v.path[v.pathI].id);
    if (W.penetration(v.x, v.z, V.radius - 0.03, 0.03, V.height) > 0) hit++;
    if (i % 60 === 0) { if (Math.hypot(v.x - tx, v.z - tz) < 0.05) stalled++; tx = v.x; tz = v.z; }
    if (i > 600 && v.routeI === start) break;
  }
  report('a full patrol lap, moving, never inside anything', hit === 0 && stalled <= 1 && seen.size >= 15, `${(i / 60).toFixed(0)} s, ${seen.size} waypoints, ${stalled} stalls, ${hit} overlaps`);

  // the plug: never moves while the outlet can be seen, moves to the nearest outlet when it can't
  const cam = kit.camera, C = v.cord, near = (x, z) => LEVEL.outlets.reduce((b, o) => ((o.pos[0] - x) ** 2 + (o.pos[2] - z) ** 2 < (b.pos[0] - x) ** 2 + (b.pos[2] - z) ** 2 ? o : b));
  const look = (x, y, z, tx2, ty, tz2) => { cam.position.set(x, y, z); cam.lookAt(tx2, ty, tz2); cam.updateMatrixWorld(true); };
  const living = LEVEL.outlets.find((o) => o.id === 'living1'), kitchen = LEVEL.outlets.find((o) => o.id === 'kitchen1');
  // parked in the kitchen, plugged in far away in the living room, with the player looking straight at that outlet
  v.frozen = false; v.x = v.px = 9.55; v.z = v.pz = 2.3; C.plugInto(living, v.x, v.z); v.frozen = true;
  look(4.6, 0.3, 1.2, living.pos[0], living.pos[1], living.pos[2]);
  for (let t = 0; t < 40; t++) { C.timer = 0; C.tick(dt, v.x, v.z); }
  report('the plug stays put while its outlet is in view', C.outlet === living);
  // now looking away, into a wall: nothing of it is visible
  look(14, 0.3, 2.6, 15.2, 0.3, 2.6);
  for (let t = 0; t < 40; t++) { C.timer = 0; C.tick(dt, v.x, v.z); }
  report('and moves to the nearest outlet once nobody can see it', C.outlet === near(v.x, v.z) && C.outlet === kitchen, `now ${C.outlet.id}`);
  // F8
  const fx = v.x; v.frozen = true; for (let t = 0; t < 30; t++) kit.tick(dt);
  report('F8 holds him still', v.x === fx);
  v.frozen = false;
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
  report('ground dash covers distance', P.pos.z - z0 > 0.6, `${(P.pos.z - z0).toFixed(2)} m`);
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
  rows.push(...grandmaChecks(kit));
  const failed = rows.filter((r) => r.startsWith('FAIL'));
  return { total: rows.length, failed: failed.length, failures: failed, rows };
}
