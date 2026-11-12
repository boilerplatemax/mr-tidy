// He spots the cat at the end of the hall and comes for it. Run, look back, up onto the couch just in time.
export default {
  title: 'The chase', seconds: 16, gif: [2, 6],
  setup(c) {
    c.place(3.05, 0.001, -0.6, -Math.PI / 2, 0); // the hall by the living-room arch, looking east
    c.vacAt('H3', 3, -Math.PI / 2); c.V.x = c.V.px = 9.5; c.K.count = 15; c.calmVac({ creep: 999, fog: 999, blast: 999, lurk: 999 }); c.V.lungeCd = 999; c.V.frozen = true;
  },
  async script(c) {
    const V = c.V;
    await c.watchVac(1.0, { rate: 4 });
    V.frozen = false; V._startChase();
    await c.watchVac(1.6, { rate: 6 });
    await c.turn(Math.PI, 0, 0.25); // and run: into the living room
    await c.walk([[3.0, 1.2], [2.0, 2.0]], { run: true, tol: 0.25 });
    await c.glanceBack(0.6);
    await c.walk([[1.35, 2.7]], { run: true, tol: 0.15 });
    await c.jump('couchSeat', 0.45, { edge: false, aimX: 0.8, aimZ: 2.9 });
    await c.jump('couchBack', 0.35, { edge: false, aimX: 0.33, aimZ: 2.9 });
    await c.watchVac(6, { rate: 5 });
  },
};
