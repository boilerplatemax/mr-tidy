// One mess too many: "...that's enough." His face changes, and then he comes for you.
export default {
  title: 'He snaps', seconds: 17, gif: [3, 6],
  setup(c) {
    c.place(7.72, 0.901, 0.13, Math.PI, -0.5); // on the kitchen counter, behind the mug
    c.vacAt('K4', 2, -2.4); c.calmVac(); c.K.count = 4; c.V.frozen = true;
  },
  async script(c) {
    const V = c.V;
    await c.watchVac(1.6, { rate: 4 });
    await c.lookAtThing('mug5', 0.5, 0);
    await c.swipe(); await c.wait(0.3); await c.swipe();
    await c.watchVac(0.7, { rate: 7 });
    V.frozen = false; V.setAnger(3, true); // (the fifth: he turns, on camera)
    await c.until(() => V.state !== 'TURN' && !c.kit.closeup.active, 7);
    await c.watchVac(1.2, { rate: 6 });
    V._startChase();
    await c.watchVac(5, { rate: 5 });
  },
};
