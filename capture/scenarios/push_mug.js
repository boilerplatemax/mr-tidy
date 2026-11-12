// The hook: on the kitchen counter, the cat stares Mr. Tidy down and pushes a mug off the edge, two slow swipes.
export default {
  title: 'The mug has to go', seconds: 15, gif: [2, 6],
  setup(c) {
    c.place(7.72, 0.901, 0.13, Math.PI, -0.55); // behind the mug, against the wall, facing the room
    c.vacAt('K4', 1, -2.4); c.calmVac(); c.V.frozen = true; // (he stays put and watches till it falls)
    c.K.count = 0;
  },
  async script(c) {
    c.titles([[0.2, "GRANDMA'S VACUUM\nIS WATCHING ME", 3.4]]);
    await c.wait(1.2);
    await c.lookAt(c.V.x, 0.45, c.V.z, 1.1); // up at him
    await c.wait(1.2);
    c.titles([[0, 'HE KNOWS', 1.6]], 'low');
    await c.lookAtThing('mug5', 0.8, 0);
    await c.wait(0.4);
    await c.swipe(); // it rocks
    await c.wait(0.8);
    await c.lookAt(c.V.x, 0.45, c.V.z, 0.5);
    await c.wait(1.0);
    await c.lookAtThing('mug5', 0.4, 0);
    await c.swipe(); // and goes
    c.wait(0.5).then(() => { c.V.frozen = false; });
    await c.wait(0.4);
    await c.lookAt(7.9, 0.0, 1.0, 0.6); // watch it fall
    await c.wait(1.4);
    await c.lookAt(c.V.x, 0.4, c.V.z, 0.7);
    await c.wait(4);
  },
};
