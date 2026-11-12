// Close up on the floor he sweeps the nozzle across it, sucking: up onto the coffee table, just in time.
export default {
  title: 'The sweep', seconds: 12, gif: [0.5, 6],
  setup(c) {
    c.place(3.45, 0.001, 1.9, 0.15, -0.1); // just in front of the coffee table, facing him
    c.vacAt('L2', 4, 0.2); c.V.z = c.V.pz = 0.85; c.K.count = 20; c.calmVac(); c.V.frozen = true;
  },
  async script(c) {
    const V = c.V;
    await c.watchVac(0.8, { rate: 5 });
    V.frozen = false;
    c.wait(0.25).then(() => V._startSuck()); // (he starts sweeping as the cat crouches to leap)
    await c.jump('coffeeTable', 0.35, { edge: false, aimX: 3.45, aimZ: 2.6, face: 0.12, look: false });
    await c.watchVac(7, { rate: 5 });
  },
};
