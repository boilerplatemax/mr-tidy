// Cornered at the end of the hall by Grandma's door: he comes, the nozzle drops, and that's it. R.I.P.
export default {
  title: 'Caught', seconds: 11.5, gif: [0.8, 6],
  setup(c) {
    c.place(17.1, 0.001, -0.75, -Math.PI / 2, 0.02); // the dead end, facing back up the hall
    c.vacAt('Hs', 4, Math.PI / 2); c.K.count = 22; c.calmVac(); c.V.frozen = true;
  },
  async script(c) {
    c.titles([[0, 'NOWHERE\nTO RUN', 2.6]]);
    await c.lookAt(c.V.x, 0.34, c.V.z, 0.4);
    await c.wait(1.0);
    c.V.frozen = false; c.V._startChase();
    for (let i = 0; i < 60 && !c.kit.catchSeq.active; i++) await c.lookAt(c.V.x, 0.34, c.V.z, 0.1);
    await c.wait(9);
  },
};
