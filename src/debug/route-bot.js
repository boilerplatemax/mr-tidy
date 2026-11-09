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

function attempt(kit, from, to, charge, trace) {
  const P = kit.player, I = kit.input, dt = 1 / 60, J = TUNING.jump;
  const fc = nearest(from, (to.min[0] + to.max[0]) / 2, (to.min[2] + to.max[2]) / 2);
  const tc = nearest(to, fc.x, fc.z);
  const start = nearest(from, tc.x, tc.z);
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
      for (let c = 0; c <= 1.0001; c += 0.05) {
        const r = attempt(kit, from, to, Math.min(1, c));
        lastOn = r.on || r.why;
        if (r.landed) { best = Math.min(1, c); break; }
      }
      rows.push(`${best === null ? 'FAIL' : 'ok  '} ${from.id} -> ${to.id}${best === null ? ` (ended on ${lastOn})` : ` charge ${best.toFixed(2)}`}`);
    }
  }
  rows.push(...climbChecks(kit));
  rows.push(...knockChecks(kit));
  const failed = rows.filter((r) => r.startsWith('FAIL'));
  return { total: rows.length, failed: failed.length, failures: failed, rows };
}
