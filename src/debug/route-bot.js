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
  const failed = rows.filter((r) => r.startsWith('FAIL'));
  return { total: rows.length, failed: failed.length, failures: failed, rows };
}
