// His dust shot: the wheeze, the nozzle lifting, three shots, and the cat sneezing in a cloud.
export default {
  title: 'Dust blast', seconds: 9, gif: [1, 6],
  setup(c) {
    c.place(1.3, 0.001, -2.45, -Math.PI / 2, 0); // the dining room, across from him
    c.vacAt('D5', 4, -Math.PI / 2); c.V.x = c.V.px = 3.05; c.V.z = c.V.pz = -2.5; c.K.count = 20; c.calmVac(); c.V.frozen = true;
    c.TUNING.blast.lobChance = 0; // (straight shots, this one)
  },
  async script(c) {
    const V = c.V;
    await c.watchVac(1.4, { rate: 4 });
    V.frozen = false; V.seesCat = true; V._startBlast();
    await c.track(() => c.vacPt(), 6, { rate: 5, stop: () => V.state !== 'BLAST' });
    V.frozen = true; // (he stops to watch you sneeze)
    await c.watchVac(4, { rate: 3 });
  },
};
