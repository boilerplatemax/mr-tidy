// A walk along the piano keys at 3 a.m., then up on top of it: the clock goes.
export default {
  title: 'Piano', seconds: 14, gif: [1.5, 6],
  setup(c) { c.placeOn('pStool', Math.PI / 2 + 0.2, -0.3, 17.0, 1.75); c.vacAt('Q2', 2, 0); c.calmVac(); c.V.frozen = true; },
  async script(c) {
    c.titles([[0, '3 AM CONCERT', 2.5]]);
    await c.jump('pKeys', 0.2, { face: 0.3, edge: false, aimX: 17.42, aimZ: 1.15 });
    await c.turn(Math.PI, -0.45, 0.35);
    await c.walk([[17.42, 2.45]], { pitch: -0.45 });
    await c.turn(0, -0.45, 0.4);
    await c.walk([[17.42, 1.6]], { run: true, pitch: -0.45 });
    c.titles([[0, 'ENCORE', 1.6]]);
    await c.jump('piano', 0.45, { edge: false, aimX: 17.72, aimZ: 1.75 });
    await c.lookAtThing('pianoClock', 0.4, 0.05);
    for (let i = 0; i < 4 && !c.K.byId.get('pianoClock').knocked; i++) await c.swipe();
    await c.lookAt(17.0, 0, 1.3, 0.5);
    await c.wait(3);
  },
};
