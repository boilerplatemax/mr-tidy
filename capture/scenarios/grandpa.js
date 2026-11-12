// Knocking over Grandpa's urn: Mr. Tidy apologises to him.
export default {
  title: 'Sorry, Grandpa', seconds: 12, gif: [2.5, 6],
  setup(c) {
    c.placeOn('dSide', Math.PI, -0.12, 0.92, -6.52); // behind the urn, against the wall
    c.vacAt('D3', 2, -1.2); c.calmVac(); c.K.count = 6; c.V.frozen = true;
  },
  async script(c) {
    c.titles([[0.1, "THAT'S GRANDPA", 2.4]]);
    await c.wait(1.6);
    c.titles([[0, 'WAS', 1.6]]);
    await c.swipe(); await c.wait(0.4); await c.swipe();
    c.V.frozen = false;
    await c.lookAt(0.95, 0, -5.6, 0.6);
    await c.wait(1.4);
    await c.lookAt(1.6, 0.35, -4.4, 0.9);
    await c.wait(6);
  },
};
