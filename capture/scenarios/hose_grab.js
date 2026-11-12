// Up on the curtain bracket, in reach of nothing... except the hose, which creeps up the wall and gets the cat.
export default {
  title: 'The hose', seconds: 14, gif: [3, 6],
  setup(c) {
    c.placeOn('bracketA', Math.PI, -0.75); // looking down into the room
    c.vacAt('L5', 3, Math.PI); c.K.count = 15; c.calmVac({ fog: 999, creep: 0, blast: 999, lurk: 999 });
  },
  async script(c) {
    c.titles([[0, 'I THOUGHT I WAS\nHIGH ENOUGH', 3.2]]);
    const V = c.V;
    await c.watchVac(3.0, { rate: 4 });
    if (V.state !== 'CREEP') V._startCreep();
    await c.track(() => (V.hose.active ? [(V.hose.tip.x + V.x) / 2, (V.hose.tip.y + 0.3) / 2, (V.hose.tip.z + V.z) / 2] : c.vacPt()), 9, { rate: 4, stop: () => c.kit.catchSeq.active }); // (him and the hose both in frame)
    await c.wait(7);
  },
};
