// Meeting him while he's still friendly: he rolls up, says hello, and the cat bats him on the nose.
export default {
  title: 'Meet Mr. Tidy', seconds: 11.5, gif: [3, 6],
  setup(c) {
    c.place(2.4, 0.001, 1.5, -Math.PI / 2 - 0.2, -0.05); // in the living room, looking across it
    c.vacAt('L1', 1, -2.2); c.calmVac(); c.K.count = 0;
  },
  async script(c) {
    const V = c.V, P = c.P;
    V.routeTo(V.nav.nodes.get('L2'));
    await c.watchVac(2.2, { rate: 4 });
    // up to him
    const go = () => { const d = Math.hypot(V.x - P.pos.x, V.z - P.pos.z), k = (d - 0.62) / d; return [P.pos.x + (V.x - P.pos.x) * k, P.pos.z + (V.z - P.pos.z) * k]; };
    V.frozen = true;
    await c.walk([go()], { tol: 0.08 });
    await c.watchVac(1.2, { rate: 6, face: true });
    await c.swipe();
    await c.watchVac(1.6, { rate: 6, face: true });
    await c.swipe();
    await c.watchVac(1.6, { rate: 6, face: true });
  },
};
