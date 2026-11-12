// He only moves when you're not looking. Each time the cat looks back, he's nearer.
export default {
  title: 'Dont look away', seconds: 21, gif: [6, 6],
  setup(c) {
    c.place(17.0, 0.001, -0.6, -Math.PI / 2, 0.05); // the east end of the hall, looking west down it
    c.vacAt('H3', 4, Math.PI / 2); c.K.count = 20; c.calmVac(); c.V.frozen = true;
    c.TUNING.vac.sightRange = [0, 0, 0, 0, 0];
  },
  async script(c) {
    const V = c.V, P = c.P, look = (s = 0.45) => c.lookAt(V.x, 0.34, V.z, s);
    c.titles([[0, 'HE ONLY MOVES\nWHEN I LOOK AWAY', 3.2]]);
    await look(); await c.wait(2.6);
    for (const [node, x, hold] of [['Hz', 13.0, 1.4], ['Hs', 14.4, 1.2], ['Ht', 15.5, 1.1]]) {
      await c.turn(P.yaw + Math.PI, 0, 0.45); // away...
      await c.wait(hold);
      c.vacAt(node, 4, Math.PI / 2); V.frozen = true; c.calmVac(); V.x = V.px = x; // (while nobody's looking)
      await look(0.4); // ...and back
      await c.wait(1.6);
    }
    c.titles([[0, "DON'T TURN AROUND", 2.4]], 'low');
    await c.turn(P.yaw + Math.PI, 0, 0.45);
    await c.wait(1.6);
    c.vacAt('H4', 4, Math.PI / 2); V.frozen = true; c.calmVac();
    V.x = V.px = 16.55; // (right there)
    await look(0.22);
    V._shriek?.(true);
    await c.wait(2.6);
  },
};
