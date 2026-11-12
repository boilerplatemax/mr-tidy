// The same perch, but the cat leaps clear at the last moment and the hose snaps at nothing.
export default {
  title: 'Last-second dodge', seconds: 16, gif: [4, 6],
  setup(c) {
    c.placeOn('bracketA', Math.PI, -0.75);
    c.vacAt('L5', 3, Math.PI); c.K.count = 15; c.calmVac({ fog: 999, creep: 0, blast: 999, lurk: 999 });
  },
  async script(c) {
    c.titles([[0, 'WAIT FOR IT...', 3]]);
    await c.lookAt(c.V.x, 0.3, c.V.z, 0.6);
    const P = c.P, near = () => { const t = c.V.hose.tip; return c.V.hose.active && Math.hypot(t.x - P.pos.x, t.y - P.feetY - 0.15, t.z - P.pos.z) < 1.0; };
    for (let i = 0; i < 140 && !near(); i++) { if (i === 25 && c.V.state !== 'CREEP') c.V._startCreep(); const t = c.V.hose.active ? c.V.hose.tip : { x: c.V.x, y: 0.3, z: c.V.z }; await c.lookAt(t.x, t.y, t.z, 0.1); }
    c.note('jump at ' + c.V.state);
    await c.jump('rodE', 0.32, { face: 0.12, edge: false });
    c.titles([[0, 'NOT TODAY', 3]]);
    await c.lookAt(c.V.x, 0.3, c.V.z, 0.5);
    await c.until(() => c.kit.catchSeq.active, 9);
    c.titles([[0, '...NEVER MIND', 4]]);
    await c.wait(5);
  },
};
