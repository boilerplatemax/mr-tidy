// He winds up (a dead giveaway) and lunges down the hall: up onto the hall table as he shoots past.
export default {
  title: 'The lunge', seconds: 8, gif: [0.5, 6],
  setup(c) {
    c.place(5.13, 0.001, -0.95, Math.PI / 2, -0.05); // in the hall, facing west, the little table just to the right
    c.vacAt('Hl', 4, Math.PI / 2); c.V.x = c.V.px = 2.9; c.V.z = c.V.pz = -0.8; c.K.count = 20; c.calmVac(); c.V.frozen = true;
  },
  async script(c) {
    const V = c.V;
    await c.watchVac(1.0, { rate: 5 });
    V.frozen = false; V.seesCat = true; V._startLunge();
    await c.watchVac(6, { rate: 7, face: true });
  },
};
