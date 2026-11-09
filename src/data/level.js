// The grey-box house as DATA (build prompt 0.3, 5). Metres, real human scale. x = east, z = south, y = up.
// Nothing here runs: src/world/house.js turns it into meshes and colliders, so the layout can be edited here and later
// replaced by a room-builder export.
//
// Tiers: 0 floor (0 m, the vac) · 1 furniture (0.4–1.0 m) · 2 high routes (1.5–2.2 m).
// Hose reach tops out near 1.8 m (TUNING.hose.reachV, build decision): tier-2 perches above that are out of reach.

// DESIGN NOTE: a 3 m ceiling (a tall old bungalow) so a jump from a 2 m perch has headroom; at 2.6 m the cat bonked its head on every high-route jump.
const T = 0.15, H = 3.0; // wall thickness, ceiling height
const IN = T / 2; // wall face offset from the wall's centre line

/** A solid box. o: land (top is a walkable perch: tan), stripes (faces you can claw: 'n' 's' 'e' 'w'), collide, room. */
const box = (id, room, x0, x1, z0, z1, y0, y1, o = {}) => ({ id, room, min: [x0, y0, z0], max: [x1, y1, z1], land: true, collide: true, ...o });

export const LEVEL = {
  ceiling: H,
  wallT: T,

  rooms: [
    { id: 'living', name: 'living room', min: [0, 0], max: [6, 5.4], floor: 0x77736c, wall: 0x8c8a86, surface: 'carpet' },
    { id: 'kitchen', name: 'kitchen', min: [6, 0], max: [10.8, 5.4], floor: 0x8d8d86, wall: 0x9c9c96, surface: 'lino' },
    { id: 'storage', name: 'storage room', min: [12, 0], max: [15.4, 3.8], floor: 0x696b70, wall: 0x7a7d84, surface: 'wood' },
    { id: 'hall', name: 'hallway', min: [0, -1.4], max: [18, 0], floor: 0x5e5f63, wall: 0x6f7075, surface: 'wood' },
  ],

  // Walls run along x or z through a centre line. Openings: { from, to, top } along the wall. noLintel: nothing above the
  // opening up to the ceiling (see the transom below). Walls along z stop at the faces of the walls along x.
  walls: [
    { axis: 'x', at: -1.4, from: -IN, to: 18 + IN }, // hallway, north
    { axis: 'x', at: 0, from: -IN, to: 18 + IN, openings: [ // hallway, south
      { from: 2.6, to: 3.5, top: 2.05 }, // to the living room
      { from: 8.05, to: 8.95, top: 2.05 }, // to the kitchen
      { from: 13.3, to: 14.2, top: 2.05 }, // to the storage room
    ] },
    { axis: 'x', at: 5.4, from: -IN, to: 10.8 + IN }, // living room + kitchen, south
    { axis: 'x', at: 3.8, from: 12 - IN, to: 15.4 + IN }, // storage, south
    { axis: 'z', at: 0, from: -1.4 + IN, to: 5.4 - IN }, // west end
    // DESIGN NOTE: a wall to the ceiling would cut the high route, so this doorway has no lintel: the wall above it is
    // open like a transom left ajar. The door header (solid 'header') bridges it at 2.12 m and the cat walks through.
    { axis: 'z', at: 6, from: IN, to: 5.4 - IN, openings: [{ from: 3.9, to: 4.8, top: 2.05, noLintel: true }] }, // living | kitchen
    { axis: 'z', at: 10.8, from: IN, to: 5.4 - IN }, // kitchen, east
    { axis: 'z', at: 12, from: IN, to: 3.8 - IN }, // storage, west
    { axis: 'z', at: 15.4, from: IN, to: 3.8 - IN }, // storage, east
    { axis: 'z', at: 18, from: -1.4 + IN, to: -IN }, // the end of the hallway (Grandma's door is on this wall)
  ],

  solids: [
    // ------------------------------------------------------------ living room: learn to jump, grab and climb
    // Cat tree: four offset platforms, each a short hop from the last.
    box('tree1', 'living', 0.95, 1.45, 0.95, 1.45, 0.37, 0.45),
    box('tree2', 'living', 0.35, 0.85, 0.95, 1.45, 0.82, 0.90),
    box('tree3', 'living', 0.35, 0.85, 0.30, 0.80, 1.22, 1.30),
    box('tree4', 'living', 0.95, 1.45, 0.30, 0.80, 1.62, 1.70), // dead end
    box('tree1post', 'living', 1.15, 1.25, 1.15, 1.25, 0, 0.37, { land: false }),
    box('tree2post', 'living', 0.55, 0.65, 1.15, 1.25, 0, 0.82, { land: false }),
    box('tree3post', 'living', 0.55, 0.65, 0.50, 0.60, 0, 1.22, { land: false }),
    box('tree4post', 'living', 1.15, 1.25, 0.50, 0.60, 0, 1.62, { land: false }),
    // Couch against the west wall. Its south end is striped: the claw-climbing lesson.
    box('couchSeat', 'living', 0.45, 1.1, 2.25, 3.75, 0, 0.45),
    box('couchBack', 'living', 0.2, 0.45, 2.0, 4.0, 0, 0.85, { stripes: ['s'] }),
    box('couchArmN', 'living', 0.45, 1.1, 2.0, 2.25, 0, 0.62),
    box('couchArmS', 'living', 0.45, 1.1, 3.75, 4.0, 0, 0.62, { stripes: ['s'] }),
    box('coffeeTable', 'living', 3.0, 3.9, 2.2, 3.0, 0, 0.42),
    // Bookcase "staircase" of staggered units along the south wall: the way up to the high route.
    box('book1', 'living', 0.3, 0.75, 5.0, 5.4 - IN, 0, 0.5),
    box('book2', 'living', 0.75, 1.2, 5.0, 5.4 - IN, 0, 0.95),
    box('book3', 'living', 1.2, 1.65, 5.0, 5.4 - IN, 0, 1.4),
    box('book4', 'living', 1.65, 2.1, 5.0, 5.4 - IN, 0, 1.9),
    // Curtain rod (a narrow beam, split by a wall bracket that dips into hose reach).
    box('rodW', 'living', 2.6, 3.5, 5.03, 5.19, 1.99, 2.05),
    box('bracketA', 'living', 3.85, 4.25, 4.95, 5.4 - IN, 1.62, 1.70), // !A! within hose reach
    box('rodE', 'living', 4.6, 5.2, 5.03, 5.19, 1.99, 2.05),
    // Curtains under the rod: climb the fabric, pull up onto the rod. Everything climbable is the same teal stripes.
    box('curtainW', 'living', 2.6, 3.5, 5.03, 5.19, 0, 1.99, { land: false, stripes: ['n'], climbTo: 'rodW' }),
    box('curtainE', 'living', 4.6, 5.2, 5.03, 5.19, 0, 1.99, { land: false, stripes: ['n'], climbTo: 'rodE' }),
    box('rodWmount', 'living', 3.45, 3.5, 5.19, 5.4 - IN, 2.0, 2.04, { land: false, collide: false }),
    box('rodEmount', 'living', 4.6, 4.65, 5.19, 5.4 - IN, 2.0, 2.04, { land: false, collide: false }),
    // A scratching panel beside the rod: a second, climbed way onto the route (and a kick-off wall).
    box('scratchPanel', 'living', 5.3, 5.8, 5.0, 5.4 - IN, 0, 1.95, { stripes: ['n'] }),
    box('header', 'living', 5.85, 6.15, 3.9, 4.8, 2.05, 2.12), // the top of the door frame, through the wall

    // ------------------------------------------------------------ kitchen: charged jumps along the counters
    box('c1', 'kitchen', 6.6, 7.9, IN, 0.675, 0, 0.9),
    box('c2a', 'kitchen', 9.1, 10.8 - IN, IN, 0.675, 0, 0.9), // the 1.2 m gap from c1 is the hallway door
    box('c2b', 'kitchen', 10.125, 10.8 - IN, 0.675, 1.6, 0, 0.9),
    box('c3', 'kitchen', 10.125, 10.8 - IN, 3.0, 4.5, 0, 0.9), // 1.4 m gap from c2b
    box('fridge', 'kitchen', 10.0, 10.8 - IN, 4.6, 5.4 - IN, 0, 1.72), // !B! within hose reach; the end of the route
    box('island', 'kitchen', 8.0, 9.0, 2.4, 3.4, 0, 0.75),
    box('chair', 'kitchen', 7.3, 7.75, 2.7, 3.15, 0, 0.45),
    box('k1', 'kitchen', 6.6, 7.6, 5.0, 5.4 - IN, 1.87, 1.95),
    box('k2', 'kitchen', 8.2, 9.2, 5.0, 5.4 - IN, 1.87, 1.95),
    box('kitchenPanel', 'kitchen', 9.3, 9.75, 5.0, 5.4 - IN, 0, 1.95, { stripes: ['n'] }), // a climbed way off the kitchen floor, between k2 and the fridge
    box('shelfD2', 'kitchen', 6.6, 7.9, IN, 0.35, 1.52, 1.60), // dead end above c1

    // ------------------------------------------------------------ hallway: the dangerous crossing
    box('sideTable', 'hall', 10.0, 10.7, -1.4 + IN, -0.875, 0, 0.7),
    box('plantStand', 'hall', 14.8, 15.2, -1.3, -0.9, 0, 1.1),

    // ------------------------------------------------------------ storage: ledges 1.1 m apart (a jump alone can't do it)
    box('w1', 'storage', 12 + IN, 12.55, 1.0, 2.2, 0, 1.1),
    box('w2', 'storage', 12 + IN, 12.55, 2.4, 3.0, 0, 2.2),
    box('e1', 'storage', 14.85, 15.4 - IN, 0.6, 1.8, 0, 1.1),
    box('e2', 'storage', 14.85, 15.4 - IN, 2.0, 3.0, 0, 2.2),
    box('s1', 'storage', 12.75, 13.6, 3.25, 3.8 - IN, 0, 1.1),
    box('s2', 'storage', 13.8, 14.6, 3.25, 3.8 - IN, 0, 2.2),
  ],

  // Grandma's door, on the wall at the east end of the hallway. It can't be opened.
  grandmaDoor: { x: 18 - IN, zMin: -1.15, zMax: -0.25, top: 2.05, strip: 0.03 },

  // 1–2 outlets per room (the cord logic arrives with the vac). pos is on the wall face; n is the way the plate faces.
  outlets: [
    { id: 'living1', room: 'living', pos: [6 - IN, 0.3, 1.2], n: [-1, 0, 0] },
    { id: 'living2', room: 'living', pos: [IN, 0.3, 4.6], n: [1, 0, 0] },
    { id: 'kitchen1', room: 'kitchen', pos: [10.8 - IN, 0.3, 2.2], n: [-1, 0, 0] },
    { id: 'kitchen2', room: 'kitchen', pos: [8.0, 0.3, 5.4 - IN], n: [0, 0, -1] }, // (clear of the panel)
    { id: 'storage1', room: 'storage', pos: [12.8, 0.3, IN], n: [0, 0, 1] },
    { id: 'hall1', room: 'hall', pos: [5.5, 0.3, -IN], n: [0, 0, -1] },
    { id: 'hall2', room: 'hall', pos: [12.0, 0.3, -1.4 + IN], n: [0, 0, 1] },
  ],

  // The links a player must be able to jump, checked against TUNING (src/world/route-check.js). Every one is two-way
  // unless oneWay. grab: true means a clean jump isn't enough, the link is meant to need a ledge grab.
  // Knockables: { id, type (TUNING.knockTypes), on (a solid's id), x, z }. Height comes from the surface, so nothing floats.
  // A test set for step 7; the full 20, weighted toward the far end of the hallway, arrive with breaking in step 8.
  knockables: [
    { id: 'mug1', type: 'mug', on: 'coffeeTable', x: 3.15, z: 2.35 },
    { id: 'mug2', type: 'mug', on: 'c1', x: 7.2, z: 0.5 },
    { id: 'book1', type: 'book', on: 'c1', x: 7.7, z: 0.35 },
    { id: 'vase1', type: 'vase', on: 'sideTable', x: 10.35, z: -1.1 },
    { id: 'plate1', type: 'plate', on: 'book4', x: 1.76, z: 5.18 },
    { id: 'mug3', type: 'mug', on: 'k1', x: 7.1, z: 5.18 },
  ],

  // Links that need a ledge grab (a clean jump can't reach). from: a solid id, or 'floor' with a start point.
  grabLinks: [
    ['floor', 'plantStand', { x: 15.0, z: -0.62 }],
    ['floor', 'w1', { x: 12.8, z: 1.6 }],
    ['w1', 'w2'],
    ['floor', 'e1', { x: 14.6, z: 1.2 }],
    ['e1', 'e2'],
    ['floor', 's1', { x: 13.2, z: 3.0 }],
    ['s1', 's2'],
  ],
  links: [
    // the high route, living room ↔ kitchen, without touching the floor
    ['book4', 'rodW'], ['rodW', 'bracketA'], ['bracketA', 'rodE'], ['rodE', 'header'], ['header', 'k1'], ['k1', 'k2'], ['k2', 'kitchenPanel'], ['kitchenPanel', 'fridge'],
    // the climb onto it
    ['book1', 'book2'], ['book2', 'book3'], ['book3', 'book4'],
    // the counter run
    ['c1', 'c2a'], ['c2b', 'c3'], ['c3', 'fridge'],
    // the cat tree
    ['tree1', 'tree2'], ['tree2', 'tree3'], ['tree3', 'tree4'],
  ],
};
