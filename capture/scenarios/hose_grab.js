// Up on the curtain bracket, in reach of nothing... except the hose, which creeps up the wall and gets the cat.
export default {
  title: 'The hose', seconds: 14, gif: [3, 6],
  setup(c) {
    c.placeOn('bracketA', Math.PI, -0.75); // looking down into the room
    c.vacAt('L5', 3, Math.PI); c.K.count = 15; c.calmVac({ fog: 999, creep: 0, blast: 999, lurk: 999 });
  },
  async script(c) {
    c.titles([[0, 'I THOUGHT I WAS\nHIGH ENOUGH', 3.2]]);
    await c.lookAt(c.V.x, 0.3, c.V.z, 0.6);
    for (let i = 0; i < 120 && !c.kit.catchSeq.active; i++) {
      if (i === 30 && c.V.state !== 'CREEP') c.V._startCreep();
      const t = c.V.hose.active ? c.V.hose.tip : { x: c.V.x, y: 0.3, z: c.V.z };
      await c.lookAt(t.x, t.y, t.z, 0.1);
    }
    await c.wait(7);
  },
};
