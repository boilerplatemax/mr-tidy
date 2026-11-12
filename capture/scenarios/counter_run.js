// Along the kitchen counters while he hunts underneath: across the doorway gap, along, the long jump, the fridge.
export default {
  title: 'Counter run', seconds: 16, gif: [3, 6],
  setup(c) {
    c.placeOn('c1', -Math.PI / 2, -0.15, 7.0, 0.5);
    c.vacAt('K5', 3, 0); c.K.count = 15; c.calmVac({ creep: 999, fog: 999, blast: 999, lurk: 999 });
  },
  async script(c) {
    await c.watchVac(1.4, { rate: 4 });
    await c.turn(-Math.PI / 2, -0.1, 0.3);
    for (const [to, ch] of [['c2a', 0.65], ['c2b', 0.4], ['c3', 0.75], ['fridge', 0.95]]) {
      const on = await c.jump(to, ch, { face: 0.22 });
      if (on !== to) c.note('MISSED ' + to + ' on ' + on);
      await c.wait(0.1);
    }
    await c.watchVac(5, { rate: 4 });
  },
};
