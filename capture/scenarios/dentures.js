// Grandma's teeth, in their glass on the edge of the sink.
export default {
  title: 'The teeth', seconds: 11, gif: [1.5, 6],
  setup(c) { c.placeOn('bSink', Math.PI / 2, -0.35, 8.98, -4.5); c.vacAt('B1', 2, 2); c.calmVac(); c.V.frozen = true; },
  async script(c) {
    c.titles([[0, "GRANDMA'S TEETH", 2.4]]);
    await c.lookAtThing('dentures', 0.6, 0.02);
    await c.walk([[8.85, -4.5]], { tol: 0.06 });
    await c.wait(0.6);
    await c.swipe();
    await c.lookAt(8.3, 0, -4.2, 0.5);
    c.titles([[0.5, 'THEY STILL WORK', 3]], 'low');
    c.V.frozen = false;
    await c.wait(7);
  },
};
