// Floor is lava: up the bookcase, along the curtain rod, over the door frame, across the kitchen shelves to the fridge,
// and the cookie jar goes over the edge. Quick, the way someone who knows the route plays it.
export default {
  title: 'The floor is lava', seconds: 24, gif: [5, 6],
  setup(c) {
    c.placeOn('book1', -Math.PI / 2, 0.1, 0.5, 5.2);
    c.vacAt('L2', 2, 0); c.calmVac();
  },
  async script(c) {
    for (const [to, ch] of [['book2', 0.47], ['book3', 0.47], ['book4', 0.52], ['rodW', 0.17], ['bracketA', 0.12], ['rodE', 0.27], ['header', 0.32], ['k1', 0.12], ['k2', 0.22], ['fridge', 0.27]]) {
      const on = await c.jump(to, ch, { face: 0.2 });
      if (on !== to) c.note('MISSED ' + to + ' on ' + on);
      await c.wait(0.08);
    }
    await c.walk([[10.4, 5.1]], { tol: 0.08 });
    await c.lookAtThing('jar', 0.4, 0.05);
    for (let i = 0; i < 4 && !c.K.byId.get('jar').knocked; i++) { await c.swipe(); await c.wait(0.2); }
    await c.lookAt(10.4, 0, 4.2, 0.4);
    await c.wait(0.8);
    await c.watchVac(3, { rate: 3 });
  },
};
