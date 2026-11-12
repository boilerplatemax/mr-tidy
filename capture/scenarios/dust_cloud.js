// "I'm gonna DUST it up!": he coughs it up, empties his bag, and the whole room fills with dust.
export default {
  title: 'Dust it up', seconds: 13, gif: [1, 6],
  setup(c) {
    c.placeOn('couchBack', Math.PI / 2 + 0.6, -0.35, 0.33, 2.6);
    c.vacAt('L2', 3, 0.6); c.V.x = c.V.px = 2.4; c.V.z = c.V.pz = 1.7; c.K.count = 15; c.calmVac(); c.V.frozen = true;
  },
  async script(c) {
    const V = c.V;
    await c.watchVac(1.5, { rate: 4 });
    V.frozen = false; V._startFog();
    await c.watchVac(5, { rate: 5 });
    await c.watchVac(6, { rate: 2 });
  },
};
