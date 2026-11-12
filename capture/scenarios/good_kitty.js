// The win: one last crash right by her door, Grandma wakes, and pulls his plug. Good Kitty.
export default {
  title: 'Good Kitty', seconds: 17.5, gif: [2, 6],
  setup(c) {
    c.place(16.85, 0.001, -0.9, -Math.PI / 2, -0.15); // by the big vase at the end of the hall, by her door
    c.kit.grandma.free = 0; c.kit.grandma.add(99.2); // (the first knock-overs of a run are free: not this one)
    c.vacAt('H3', 4, Math.PI / 2); c.K.count = 26; c.calmVac(); c.V.frozen = true;
  },
  async script(c) {
    c.titles([[0, 'GRANDMA IS\nALMOST AWAKE', 2.6]]);
    await c.lookAtThing('floorVaseH', 0.6, 0.25);
    await c.walk([[17.0, -1.05]], { tol: 0.1 });
    await c.lookAtThing('floorVaseH', 0.3, 0.3);
    c.titles([[0, 'ONE MORE', 1.6]]);
    for (let i = 0; i < 4 && !c.K.byId.get('floorVaseH').knocked; i++) { await c.swipe(); await c.wait(0.25); }
    await c.wait(16);
  },
};
