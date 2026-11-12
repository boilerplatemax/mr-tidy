// The easter egg: bat the TV's rabbit ears and an old cartoon comes in, "Puss and the Wool".
export default {
  title: 'Puss and the Wool', seconds: 9.8, gif: [2.5, 6],
  setup(c) {
    c.placeOn('tvUnit', 0, -0.35, 5.55, 2.75); // on top of the set, the rabbit ears just ahead
    c.vacAt('L3', 1, 0); c.calmVac();
  },
  async script(c) {
    c.titles([[0, "GRANDMA'S TV\nGETS ONE CHANNEL", 2.6]]);
    await c.lookAt(5.6, 1.15, 2.1, 0.7);
    await c.wait(0.5);
    await c.swipe();
    if (c.kit.tv.state !== 'egg') c.note('AERIAL MISSED');
    c.titles([[0.4, 'HIT IT AND...', 1.6]]);
    await c.wait(0.4);
    c.shot({ pos: [4.15, 0.62, 2.104], look: [5.25, 0.6, 2.104], fov: 42 }, 0.5);
    await c.wait(8.2);
  },
};
