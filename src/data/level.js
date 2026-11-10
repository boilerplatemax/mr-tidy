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

/**
 * A window's curtains: two panels flat against the wall with a slight gap between them, on a slim rail. Nothing can get behind.
 * along: the axis the wall runs on ('x' | 'z'), from a0 to a1; w: where the wall's face is; n: which way it faces (+1 / -1).
 */
function wallCurtain(id, room, along, a0, a1, w, n, top = 2.15) {
  const mk = (sid, lo, hi, d0, d1, y0, y1, o) => {
    const p = w + n * d0, q = w + n * d1, c0 = Math.min(p, q), c1 = Math.max(p, q);
    return along === 'x' ? box(sid, room, lo, hi, c0, c1, y0, y1, o) : box(sid, room, c0, c1, lo, hi, y0, y1, o);
  };
  const side = along === 'x' ? (n > 0 ? 's' : 'n') : (n > 0 ? 'e' : 'w'), ends = along === 'x' ? ['w', 'e'] : ['n', 's'], mid = (a0 + a1) / 2, gap = 0.035, d = 0.18; // (heavy drapes, gathered thick)
  return [
    mk(id + 'P', a0, a1, 0, d, top, top + 0.05, { tex: 'wood_walnut' }), // (a boxed rail, flush with the wall: climb the curtains and you can stand on it)
    mk(id, a0, a1, 0, d, 0, top, { land: false, stripes: [side, ...ends], climbTo: id + 'P', noVisual: true, occludes: true }),
    mk(id + 'L', a0, mid - gap, 0, d, 0, top, { land: false, collide: false, tex: 'fabric_velvet_curtain' }),
    mk(id + 'R', mid + gap, a1, 0, d, 0, top, { land: false, collide: false, tex: 'fabric_velvet_curtain' }),
  ];
}

export const LEVEL = {
  ceiling: H,
  wallT: T,

  rooms: [
    { id: 'living', name: 'living room', min: [0, 0], max: [6, 5.4], floorTex: 'carpet_rose', wallTex: 'wallpaper_rose', surface: 'carpet' },
    { id: 'kitchen', name: 'kitchen', min: [6, 0], max: [10.8, 5.4], floorTex: 'floor_lino_checker', wallTex: 'wallpaper_mustard', surface: 'lino' },
    { id: 'storage', name: 'laundry room', min: [10.8, 0], max: [15.4, 4.6], floorTex: 'floor_planks', wallTex: 'wallpaper_duckegg', surface: 'wood' }, // Grandma's laundry and linen room: off the kitchen and the hall
    { id: 'parlour', name: 'parlour', min: [15.4, 0], max: [18, 4.6], floorTex: 'floor_planks', wallTex: 'wallpaper_plum_stripe', surface: 'wood' }, // the front parlour, kept for best: the piano, her good chair, the plants
    { id: 'hall', name: 'hallway', min: [0, -1.4], max: [18, 0], floorTex: 'floor_planks', wallTex: 'wallpaper_damask_green', surface: 'wood' },
    { id: 'dining', name: 'dining room', min: [0, -6.6], max: [6, -1.4], floorTex: 'floor_planks', wallTex: 'wallpaper_rose', surface: 'wood' },
    { id: 'bath', name: 'bathroom', min: [6, -5], max: [9.6, -1.4], floorTex: 'tile_bath_floor', wallTex: 'tile_mint_wall', surface: 'lino' },
    { id: 'sewing', name: 'sewing room', min: [9.6, -6], max: [14.4, -1.4], floorTex: 'carpet_rose', wallTex: 'wallpaper_mustard', surface: 'carpet' },
    { id: 'study', name: 'study', min: [14.4, -4], max: [18, -1.4], floorTex: 'floor_planks', wallTex: 'wallpaper_damask_green', surface: 'wood' }, // the one small dead end, right next to Grandma,
  ],

  // Walls run along x or z through a centre line. Openings: { from, to, top } along the wall. noLintel: nothing above the
  // opening up to the ceiling (see the transom below). Walls along z stop at the faces of the walls along x.
  walls: [
    { axis: 'x', at: -1.4, from: -IN, to: 18 + IN, openings: [ // hallway, north
      { from: 1.8, to: 4.3, top: 2.05 }, // a wide arch to the dining room
      { from: 7.5, to: 8.4, top: 2.05 }, // to the bathroom
      { from: 11.6, to: 12.5, top: 2.05 }, // to the sewing room
      { from: 15.9, to: 16.8, top: 2.05 }, // to the study
    ] },
    { axis: 'x', at: -6.6, from: -IN, to: 6 + IN, openings: [{ from: 5.0, to: 5.6, bottom: 0.9, top: 1.95 }] }, // dining room, north (a window)
    { axis: 'z', at: 0, from: -6.6 + IN, to: -1.4 - IN }, // dining room, west
    { axis: 'z', at: 6, from: -6.6 + IN, to: -1.4 - IN, openings: [{ from: -3.1, to: -2.2, top: 2.05 }] }, // dining room | bathroom
    { axis: 'x', at: -5, from: 6 + IN, to: 9.6 + IN }, // bathroom, north
    { axis: 'z', at: 9.6, from: -6 + IN, to: -1.4 - IN, openings: [{ from: -3.6, to: -2.7, top: 2.05 }] }, // bathroom | sewing room
    { axis: 'x', at: -4, from: 14.4 - IN, to: 18 + IN }, // study, north
    { axis: 'z', at: 18, from: -4 + IN, to: -1.4 - IN }, // study, east
    { axis: 'x', at: -6, from: 9.6 - IN, to: 14.4 + IN, openings: [{ from: 13.4, to: 14.0, bottom: 0.9, top: 1.95 }] }, // sewing room, north (a window)
    { axis: 'z', at: 14.4, from: -6 + IN, to: -1.4 - IN }, // sewing room, east
    { axis: 'x', at: 0, from: -IN, to: 18 + IN, openings: [ // hallway, south
      { from: 1.8, to: 4.3, top: 2.05 }, // a wide arch to the living room
      { from: 8.05, to: 8.95, top: 2.05 }, // to the kitchen
      { from: 13.3, to: 14.2, top: 2.05 }, // to the laundry room
      { from: 15.6, to: 16.4, top: 2.05 }, // to the parlour
    ] },
    { axis: 'x', at: 5.4, from: -IN, to: 10.8 + IN }, // living room + kitchen, south
    { axis: 'x', at: 4.6, from: 10.8, to: 18 + IN }, // laundry room + parlour, south
    { axis: 'z', at: 0, from: -1.4 + IN, to: 5.4 - IN, openings: [{ from: 2.7, to: 3.3, bottom: 1.05, top: 2.05 }] }, // west end (a window over the couch)
    // DESIGN NOTE: a wall to the ceiling would cut the high route, so this doorway has no lintel: the wall above it is
    // open like a transom left ajar. The door header (solid 'header') bridges it at 2.12 m and the cat walks through.
    { axis: 'z', at: 6, from: IN, to: 5.4 - IN, openings: [{ from: 3.9, to: 4.8, top: 2.05, noLintel: true }] }, // living | kitchen
    { axis: 'z', at: 10.8, from: IN, to: 5.4 - IN, openings: [{ from: 1.85, to: 2.75, top: 2.05 }] }, // kitchen | laundry room (a proper door now, no pantry nook)
    { axis: 'z', at: 15.4, from: IN, to: 4.6 - IN, openings: [{ from: 3.3, to: 4.1, top: 2.05 }] }, // laundry room | parlour
    { axis: 'z', at: 18, from: IN, to: 4.6 - IN }, // parlour, east
    { axis: 'z', at: 18, from: -1.4 + IN, to: -IN, openings: [{ from: -1.1, to: -0.3, top: 2.05 }] }, // the end of the hallway (Grandma's door is in this wall)
  ],

  solids: [
    // ------------------------------------------------------------ living room: learn to jump, grab and climb
    // Cat tree: four offset platforms, each a short hop from the last.
    box('tree1', 'living', 0.95, 1.45, 0.95, 1.45, 0.37, 0.45),
    box('tree2', 'living', 0.35, 0.85, 0.95, 1.45, 0.82, 0.90),
    box('tree3', 'living', 0.35, 0.85, 0.30, 0.80, 1.22, 1.30),
    box('tree4', 'living', 0.95, 1.45, 0.30, 0.80, 1.62, 1.70), // dead end
    box('tree4rim', 'living', 0.95, 1.45, 0.3, 0.335, 1.64, 1.71, { land: false, collide: false, tex: 'fabric_carpet' }), // (the tray's fourth side)
    box('tree1post', 'living', 1.15, 1.25, 1.15, 1.25, 0, 0.37, { land: false }),
    box('tree2post', 'living', 0.55, 0.65, 1.15, 1.25, 0, 0.82, { land: false }),
    box('tree3post', 'living', 0.55, 0.65, 0.50, 0.60, 0, 1.22, { land: false }),
    box('tree4post', 'living', 1.15, 1.25, 0.50, 0.60, 0, 1.62, { land: false }),
    // Couch against the west wall. Its south end is striped: the claw-climbing lesson.
    box('couchSeat', 'living', 0.45, 1.1, 2.25, 3.75, 0, 0.45),
    box('couchBack', 'living', 0.2, 0.45, 2.0, 4.0, 0, 0.85, { stripes: ['s'] }),
    box('couchArmN', 'living', 0.45, 1.1, 2.0, 2.25, 0, 0.62),
    box('couchArmS', 'living', 0.45, 1.1, 3.75, 4.0, 0, 0.62, { stripes: ['s'] }),
    box('coffeeTable', 'living', 3.0, 3.9, 2.2, 3.0, 0, 0.42, { tex: 'wood_oak' }),
    // Bookcase "staircase" of staggered units along the south wall: the way up to the high route.
    box('book1', 'living', 0.3, 0.75, 5.0, 5.4 - IN, 0, 0.5),
    box('book2', 'living', 0.75, 1.2, 5.0, 5.4 - IN, 0, 0.95),
    box('book3', 'living', 1.2, 1.65, 5.0, 5.4 - IN, 0, 1.4),
    box('book4', 'living', 1.65, 2.1, 5.0, 5.4 - IN, 0, 1.9),
    // Curtain rod (a narrow beam, split by a wall bracket that dips into hose reach).
    box('rodW', 'living', 2.6, 3.5, 5.03, 5.4 - IN, 1.99, 2.05), // (the pelmet: runs right back to the wall)
    box('bracketA', 'living', 3.85, 4.25, 4.95, 5.4 - IN, 1.62, 1.70, { tex: 'wood_walnut' }), // !A! within hose reach
    box('rodE', 'living', 4.6, 5.2, 5.03, 5.4 - IN, 1.99, 2.05),
    // Curtains under the rod: climb the fabric, pull up onto the rod. Everything climbable is the same teal stripes.
    ...wallCurtain('lwin', 'living', 'z', 2.35, 3.65, IN, 1, 2.3),
    box('lampPost', 'living', IN, 0.45, 4.45, 4.65, 0, 1.5, { noVisual: true, land: false, occludes: false }),
    box('gDoor', 'hall', 18 - IN, 18 + IN, -1.1, -0.3, 0, 2.05, { noVisual: true, land: false, occludes: true }), // (her door: always shut as far as anything but the ending is concerned)
    box('tvUnit', 'living', 5.25, 6 - IN, 1.6, 3.0, 0, 1.05, { noVisual: true }), // a big old set: you can read it from across the room
    // A scratching panel beside the rod: a second, climbed way onto the route (and a kick-off wall).
    box('scratchPanel', 'living', 5.3, 5.8, 5.0, 5.4 - IN, 0, 1.95, { noVisual: true }), // a tall narrow bookcase in the corner (its top is a perch by the curtain rod)
    box('header', 'living', 5.85, 6.15, 3.9, 4.8, 2.05, 2.12, { tex: 'wood_walnut' }), // the top of the door frame, through the wall

    // ------------------------------------------------------------ kitchen: charged jumps along the counters
    box('c1', 'kitchen', 6.6, 7.9, IN, 0.675, 0, 0.9),
    box('c2a', 'kitchen', 9.1, 10.8 - IN, IN, 0.675, 0, 0.9), // the 1.2 m gap from c1 is the hallway door
    box('c2b', 'kitchen', 10.125, 10.8 - IN, 0.675, 1.6, 0, 0.9),
    box('c3', 'kitchen', 10.125, 10.8 - IN, 3.0, 4.5, 0, 0.9), // 1.4 m gap from c2b
    box('fridge', 'kitchen', 10.0, 10.8 - IN, 4.6, 5.4 - IN, 0, 1.72), // !B! within hose reach; the end of the route
    box('island', 'kitchen', 8.0, 9.0, 2.4, 3.4, 0, 0.75, { tex: 'wood_oak', topTex: 'formica_retro' }),
    box('chair', 'kitchen', 7.3, 7.75, 2.7, 3.15, 0, 0.45),
    box('k1', 'kitchen', 6.6, 7.6, 5.0, 5.4 - IN, 1.87, 1.95),
    box('k2', 'kitchen', 8.2, 9.2, 5.0, 5.4 - IN, 1.87, 1.95),
    box('shelfD2', 'kitchen', 6.6, 7.9, IN, 0.35, 1.52, 1.60), // dead end above c1

    // ------------------------------------------------------------ hallway: the dangerous crossing
    box('sideTable', 'hall', 10.0, 10.7, -1.4 + IN, -0.875, 0, 0.7),
    box('hallTable', 'hall', 4.78, 5.48, -0.42, -IN, 0, 0.78, { noVisual: true }), // (under Duchess and Pepper: the end of the hall is left clear for the front door) // the little table under Biscuit
    box('plantStand', 'hall', 14.8, 15.2, -1.3, -0.9, 0, 1.1, { tex: 'wood_walnut' }),

    // ------------------------------------------------------------ the laundry room: linen cupboards and boxes of old linen, 1.1 m apart (a jump alone can't do it)
    // DESIGN NOTE: neighbouring units touch. A slot narrower than the cat (0.24 m) is a trap it can drop into and not leave.
    box('w1', 'storage', 10.8 + IN, 11.35, 3.0, 3.8, 0, 1.1, { tex: 'cardboard' }),
    box('e1', 'storage', 14.85, 15.4 - IN, 0.6, 1.9, 0, 1.1, { tex: 'cardboard' }),
    box('e2', 'storage', 14.85, 15.4 - IN, 1.9, 3.0, 0, 2.2),
    box('s1', 'storage', 13.25, 13.7, 4.05, 4.6 - IN, 0, 1.1, { tex: 'cardboard' }),
    box('s2', 'storage', 13.7, 14.6, 4.05, 4.6 - IN, 0, 2.2),
    box('washer', 'storage', 11.45, 12.05, 3.95, 4.6 - IN, 0, 0.85, { noVisual: true }), // the washing machine (drawn in src/world/house.js)
    box('dryer', 'storage', 12.1, 12.7, 3.95, 4.6 - IN, 0, 0.85, { noVisual: true }), // the tumble dryer beside it, its twin (drawn in src/world/house.js)
    box('lShelf', 'storage', 11.45, 12.9, 4.2, 4.6 - IN, 1.5, 1.54, { noVisual: true }), // folded linen up on a shelf
    box('iron', 'storage', 12.7, 13.8, 1.55, 1.9, 0.84, 0.88, { noVisual: true }), // the ironing board, left up (a cat fits under it; drawn in src/world/house.js)

    // ------------------------------------------------------------ the parlour: the piano, her good chair, the plants
    box('piano', 'parlour', 17.55, 18 - IN, 1.0, 2.6, 0, 1.25, { noVisual: true }), // an upright piano (drawn in src/world/house.js)
    box('pKeys', 'parlour', 17.3, 17.55, 1.05, 2.55, 0, 0.78, { noVisual: true }), // its keyboard, sticking out: a step up
    box('pStool', 'parlour', 16.85, 17.2, 1.6, 2.0, 0, 0.5, { noVisual: true, occludes: false }), // (drawn in src/world/house.js: a padded bench)
    box('pShelf', 'parlour', 17.6, 18 - IN, 2.9, 3.9, 1.71, 1.75, { noVisual: true }),
    box('pStand', 'parlour', 17.45, 17.8, 0.2, 0.55, 0, 0.95, { tex: 'wood_walnut' }), // a plant stand
    box('pTable', 'parlour', 16.3, 16.7, 4.1, 4.5, 0, 0.7, { noVisual: true }), // (well clear of the armchair: no slot a cat could drop into)
    box('pArmBack', 'parlour', 17.765, 18 - IN, 3.68, 4.52, 0, 1.1, { noVisual: true }),
    box('pArmN', 'parlour', 17.125, 17.765, 3.68, 3.8, 0, 0.64, { noVisual: true }),
    box('pArmS', 'parlour', 17.125, 17.765, 4.4, 4.52, 0, 0.64, { noVisual: true }),
    box('pSeat', 'parlour', 17.125, 17.765, 3.8, 4.4, 0, 0.48, { noVisual: true }),

    // ------------------------------------------------------------ dining room: table, sideboard, then the shelves along the north wall
    box('dTable', 'dining', 2.3, 3.7, -4.42, -3.58, 0.71, 0.75, { noVisual: true }),
    box('dChairN', 'dining', 2.79, 3.21, -4.96, -4.54, 0.42, 0.46, { noVisual: true }),
    box('dChairS', 'dining', 2.79, 3.21, -3.46, -3.04, 0.42, 0.46, { noVisual: true }),
    box('dChairW', 'dining', 1.69, 2.11, -4.21, -3.79, 0.42, 0.46, { noVisual: true }),
    box('dChairE', 'dining', 3.89, 4.31, -4.21, -3.79, 0.42, 0.46, { noVisual: true }),
    ...wallCurtain('dc', 'dining', 'x', 4.7, 5.9, -6.6 + IN, 1),
    box('clockPeg', 'dining', 6 - IN - 0.05, 6 - IN, -4.66, -4.34, 1.43, 1.45, { noVisual: true }), // (what the wall clock hangs on)
    box('clockStand', 'dining', 5.45, 6 - IN, -4.75, -4.25, 0, 0.78, { noVisual: true }), // a little table under the clock
    box('dSide', 'dining', 0.72, 1.68, -6.6 + IN, -6.065, 0, 0.8, { tex: 'wood_walnut' }), // the sideboard
    box('dShelf1', 'dining', 2.2, 3.0, -6.6 + IN, -6.325, 1.21, 1.25, { noVisual: true }),
    box('dShelf2', 'dining', 3.4, 4.6, -6.6 + IN, -6.305, 1.66, 1.7, { noVisual: true }),
    box('dBooks', 'dining', IN, 0.405, -5.67, -4.73, 0, 1.95, { noVisual: true }),

    // ------------------------------------------------------------ bathroom: small, hard surfaces, loud
    // the tub: rims you can walk along and a hollow to crouch in. Low walls, but they hide you
    box('tubN', 'bath', 6.2, 8.0, -5 + IN, -4.825, 0, 0.55, { noVisual: true, occludes: true }),
    box('tubS', 'bath', 6.2, 8.0, -4.2, -4.1, 0, 0.55, { noVisual: true, occludes: true }),
    box('tubW', 'bath', 6.2, 6.3, -4.825, -4.2, 0, 0.55, { noVisual: true, occludes: true }),
    box('tubE', 'bath', 7.9, 8.0, -4.825, -4.2, 0, 0.55, { noVisual: true, occludes: true }),
    box('bSink', 'bath', 8.513, 9.6 - IN, -5 + IN, -4.279, 0, 0.9, { noVisual: true }),
    box('bCabinet', 'bath', 8.8, 9.24, -5 + IN, -4.781, 1.15, 1.7, { noVisual: true }),
    box('bShelf', 'bath', 6.8, 7.4, -5 + IN, -4.725, 1.3, 1.34, { noVisual: true }),
    box('bRadiator', 'bath', 6.33, 7.17, -1.4 - IN - 0.15, -1.4 - IN, 0, 0.68, { noVisual: true }),

    // ------------------------------------------------------------ sewing room: the spare bed, the wardrobe, up the shelves
    box('sBed', 'sewing', 9.9, 10.99, -6 + IN, -3.77, 0.34, 0.8, { noVisual: true }), // (up on tall legs: a cat fits underneath)
    box('sWardrobe', 'sewing', 11.5, 12.58, -6 + IN, -5.28, 0, 2.07, { noVisual: true }),
    box('sDesk', 'sewing', 13.525, 14.4 - IN, -4.4, -3.2, 0, 0.75, { noVisual: true }),
    box('sChair', 'sewing', 12.79, 13.21, -4.01, -3.59, 0, 0.46, { noVisual: true }),
    ...wallCurtain('sc', 'sewing', 'x', 13.1, 14.3, -6 + IN, 1),
    box('sShelf1', 'sewing', 14.125, 14.4 - IN, -5.0, -4.5, 1.21, 1.25, { noVisual: true }),
    box('sShelf2', 'sewing', 14.125, 14.4 - IN, -5.5, -5.0, 1.71, 1.75, { noVisual: true }),

    // ------------------------------------------------------------ hall end and the study
    // the study: bookcases on the back wall, a desk under the wall lamp, an armchair in the corner by the door
    box('tBookA', 'study', 14.6, 15.54, -4 + IN, -3.6, 0, 1.95, { noVisual: true }),
    box('tBookB', 'study', 15.6, 16.54, -4 + IN, -3.6, 0, 1.95, { noVisual: true }),
    box('tDesk', 'study', 17.125, 18 - IN, -3.4, -2.2, 0, 0.75, { noVisual: true }),
    box('tStool', 'study', 16.65, 17.07, -3.0, -2.58, 0, 0.46, { noVisual: true }),
    box('tArmBack', 'study', 14.6, 14.76, -2.42, -1.58, 0, 1.1, { noVisual: true }),
    box('tArmN', 'study', 14.76, 15.4, -2.42, -2.3, 0, 0.64, { noVisual: true }),
    box('tArmS', 'study', 14.76, 15.4, -1.7, -1.58, 0, 0.64, { noVisual: true }),
    box('tSeat', 'study', 14.76, 15.4, -2.3, -1.7, 0, 0.48, { noVisual: true }),
    // storage clutter you can't walk through
    box('sBox', 'storage', 14.05, 14.55, 0.5, 0.9, 0, 0.38, { noVisual: true }),
  ],

  // The real models. fit: stretched to fill those solids (see src/world/dress.js); the solids are drawn by these instead of as boxes.
  dress: [
    // living room
    { model: 'couch', fit: ['couchSeat', 'couchBack', 'couchArmN', 'couchArmS'], rot: 90, hide: ['doily_L', 'doily_R'] }, // (no doilies: flat white cards on the arms, hiding the print)
    { model: 'cattree_platform_60', fit: ['tree1'] }, { model: 'cattree_platform_60', fit: ['tree2'] }, { model: 'cattree_platform_60', fit: ['tree3'] }, { model: 'cattree_perch_tray', fit: ['tree4'], rot: 180 },
    { model: 'cattree_post_80', fit: ['tree1post'] }, { model: 'cattree_post_80', fit: ['tree2post'] }, { model: 'cattree_post_80', fit: ['tree3post'] }, { model: 'cattree_post_80', fit: ['tree4post'] },
    { model: 'psx_nightstand_oak', fit: ['book1'], rot: 180 }, { model: 'bookcase', fit: ['book2'], rot: 180 }, { model: 'bookcase', fit: ['book3'], rot: 180 }, { model: 'bookcase', fit: ['book4'], rot: 180 }, { model: 'bookcase', fit: ['scratchPanel'], rot: 180 },
    { model: 'tv_console', fit: ['tvUnit'], rot: -90, h: 0.8, tv: true }, // (scaled so its top is the collider's top)
    { model: 'psx_rug_braided', at: [3.0, 0.002, 1.6] }, { model: 'psx_floor_lamp', at: [0.35, 0, 4.55], rot: 180, noFlex: [0.25, 0.06] }, { model: 'ceiling_light', at: [3, 0.6, 2.7] },
    // kitchen
    { model: 'counter_module', fit: ['c1'], h: 0.9 }, { model: 'counter_module', fit: ['c2a'], h: 0.9 }, { model: 'counter_module', fit: ['c2b'], rot: -90, h: 0.9 }, { model: 'counter_module', fit: ['c3'], rot: -90, h: 0.9 },
    { model: 'fridge', fit: ['fridge'], rot: -90 }, { model: 'dining_chair', fit: ['chair'], h: 0.46 },
    { model: 'shelf_floating_120', fit: ['k1'], rot: 180, top: true }, { model: 'shelf_floating_120', fit: ['k2'], rot: 180, top: true }, { model: 'shelf_floating_120', fit: ['shelfD2'], top: true },
    { model: 'ceiling_light', at: [8.4, 0.6, 2.7] },
    // hallway
    { model: 'side_table', fit: ['sideTable'], h: 0.78 }, { model: 'side_table', fit: ['hallTable'], rot: 180, h: 0.78 }, { model: 'grandma_door', at: [18, 0, -0.7], rot: -90, door: true }, { model: 'door_wood', at: [IN + 0.03, 0, -0.7], rot: -90 }, // (the front door: it doesn't open)
    { model: 'ceiling_light', at: [5, 0.6, -0.7] }, { model: 'ceiling_light', at: [13, 0.6, -0.7] },
    // storage
    { model: 'psx_wardrobe_oak', fit: ['e2'], rot: -90, h: 2.07 }, { model: 'psx_wardrobe_oak', fit: ['s2'], rot: 180, h: 2.07 },
    { model: 'psx_box', fit: ['sBox'] }, { model: 'shelf_floating_120', fit: ['lShelf'], rot: 180, top: true }, { model: 'ceiling_light', at: [13.1, 0.6, 2.3] },
    // parlour
    { model: 'armchair', at: [17.525, 0, 4.1], rot: -90 }, { model: 'side_table', fit: ['pTable'], h: 0.78 }, { model: 'shelf_floating_120', fit: ['pShelf'], rot: -90, top: true }, { model: 'psx_rug_braided', at: [16.6, 0.002, 2.3], rot: 90 }, { model: 'ceiling_light', at: [16.7, 0.6, 2.3] },
    // dining room
    { model: 'dining_table', at: [3, 0, -4] },
    { model: 'dining_chair', at: [3, 0, -4.75] }, { model: 'dining_chair', at: [3, 0, -3.25], rot: 180 }, { model: 'dining_chair', at: [1.9, 0, -4], rot: 90 }, { model: 'dining_chair', at: [4.1, 0, -4], rot: -90 },
    { model: 'bookcase', at: [IN, 0, -5.2], rot: 90 },
    { model: 'shelf_floating_80', at: [2.6, 1.25, -6.6 + IN] }, { model: 'shelf_floating_120', at: [4.0, 1.7, -6.6 + IN] },
    { model: 'side_table', fit: ['clockStand'], rot: -90, h: 0.78 }, { model: 'psx_rug_braided', at: [3.0, 0.002, -4], rot: 90 }, { model: 'psx_picture_landscape', at: [1.2, 0.2, -6.6 + IN] }, { model: 'ceiling_light', at: [3, 0.6, -4] },
    // bathroom
    { model: 'psx_sink_unit_white', at: [9.019, 0, -5 + IN + 0.31], squash: [0.96, 0.35] }, { model: 'medicine_cabinet', at: [9.02, 1.7, -5 + IN] },
    { model: 'shelf_floating_60_white', at: [7.1, 1.34, -5 + IN] }, { model: 'radiator', at: [6.75, 0, -1.4 - IN], rot: 180 }, { model: 'ceiling_light', at: [7.8, 0.6, -3.2] },
    // sewing room
    { model: 'psx_bed_single_oak', at: [10.445, 0, -4.85], legs: [0.22, 0.12] }, { model: 'psx_wardrobe_oak', at: [12.04, 0, -5.62] },
    { model: 'psx_table_pine', at: [13.95, 0, -3.8], rot: 90 }, { model: 'psx_chair_ladder_pine', at: [13.0, 0, -3.8], rot: 90 },
    { model: 'shelf_floating_60', at: [14.4 - IN, 1.25, -4.75], rot: -90 }, { model: 'shelf_floating_60', at: [14.4 - IN, 1.75, -5.25], rot: -90 },
    { model: 'ceiling_light', at: [12, 0.6, -3.7] },
    // study
    { model: 'bookcase', fit: ['tBookA'] }, { model: 'bookcase', fit: ['tBookB'] }, { model: 'armchair', at: [15.0, 0, -2.0], rot: 90 },
    { model: 'psx_table_pine', fit: ['tDesk'], rot: 90 }, { model: 'psx_chair_ladder_pine', fit: ['tStool'], rot: 90, h: 0.46 }, { model: 'psx_rug_braided', at: [16.2, 0.002, -2.75] }, { model: 'ceiling_light', at: [16.2, 0.6, -2.7] },
  ],

  tub: { x0: 6.2, x1: 8.0, z0: -5 + IN, z1: -4.1, top: 0.55 }, // the enamel tub drawn over its rims (src/world/house.js)

  // The windows: real holes in outside walls, each behind closed curtains. { axis, at, from, to, bottom, top, n: [x, z] facing into the room }
  windows: [
    { axis: 'z', at: 0, from: 2.7, to: 3.3, bottom: 1.05, top: 2.05, n: [1, 0] },
    { axis: 'x', at: -6.6, from: 5.0, to: 5.6, bottom: 0.9, top: 1.95, n: [0, 1] },
    { axis: 'x', at: -6, from: 13.4, to: 14.0, bottom: 0.9, top: 1.95, n: [0, 1] },
  ],

  // Places to hide: he can't see a cat low down in here, unless he goes looking and gets lucky. min/max: [x, z].
  hides: [{ id: 'tub', min: [6.3, -4.825], max: [7.9, -4.2] }],

  // When the power goes (stage 5): what still gives any light. needs: goes out if that object has been knocked over.
  darkLights: [
    { x: 5.0, y: 0.65, z: 2.3, color: 0x8fb0ff, power: 3.6, dist: 6, flicker: 0.5 }, // the television (unplugged: it comes on by itself)
    { x: 13.7, y: 0.4, z: 1.9, color: 0xc8a070, power: 0.55, dist: 2.4, flicker: 0, follow: 'vac' }, // a faint glow from his motor: wherever he is
    { x: 17.4, y: 0.25, z: -0.7, color: 0xffc27a, power: 2.6, dist: 5, flicker: 0.06 }, // the light under Grandma's door
    { x: 9.45, y: 0.32, z: -2.0, color: 0x90e0a0, power: 1.0, dist: 3, flicker: 0 }, // a night-light in the bathroom
    { x: 9.7, y: 0.5, z: 4.5, color: 0xcfe4ff, power: 1.6, dist: 3.5, flicker: 0.15 }, // the fridge, ajar
    { x: 13.9, y: 1.2, z: -5.5, color: 0x6a86c8, power: 1.1, dist: 3.5, flicker: 0 }, // moonlight, sewing room
  ],

  // The cats who came before, down the hallway in order. x along the hall's south wall.
  portraits: [[0.7, '01_biscuit', 1], [1.35, '02_mr_whiskers', 2], [4.75, '03_duchess', 3], [5.5, '04_pepper', 4], [6.9, '05_tuna', 5], [10.0, '06_marigold', 6], [11.4, '07_sapphire', 7], [12.6, '08_mittens', 8]],

  // Grandma's door, on the wall at the east end of the hallway. It can't be opened.
  grandmaDoor: { x: 18 - IN, zMin: -1.15, zMax: -0.25, top: 2.05, strip: 0.03 },

  // Wall outlets. He starts plugged into the first one, just outside Grandma's door; if the cat swipes the one he's using he
  // ends up in whichever is nearest. pos is on the wall face, n the way the plate faces, node the waypoint the cord runs from.
  tvScreen: [5.25, 0.59, 2.104], // the middle of the screen (measured off the model), for the camera to face square on
  remote: [3.05, 2.05, 5.2], // up on the high shelf by the window: the tutorial's climb
  lampLight: [0.42, 1.36, 4.5], // where the floor lamp's light comes from (its shade)
  lampOutlet: { pos: [IN, 0.3, 4.81], n: [1, 0, 0], from: [0.3, 0.004, 4.64] }, // the floor lamp's own outlet: taken, so he never uses it. Its plug is the tutorial's last lesson (from: where the flex leaves the lamp)
  outlets: [
    { id: 'grandma', room: 'hall', pos: [16.8, 0.3, -IN], n: [0, 0, -1], node: 'H4' },
    { id: 'living1', room: 'living', pos: [4.9, 0.3, IN], n: [0, 0, 1], node: 'L1' }, // (on the hall wall, well away from the set: the TV is plugged in behind itself)
    { id: 'kitchen1', room: 'kitchen', pos: [10.8 - IN, 0.3, 1.72], n: [-1, 0, 0], node: 'K3' },
    { id: 'kitchen2', room: 'kitchen', pos: [8.0, 0.3, 5.4 - IN], n: [0, 0, -1], node: 'K2' },
    { id: 'storage1', room: 'storage', pos: [12.8, 0.3, IN], n: [0, 0, 1], node: 'Sd' },
    { id: 'parlour1', room: 'parlour', pos: [18 - IN, 0.3, 3.0], n: [-1, 0, 0], node: 'Q2' },
    { id: 'hall1', room: 'hall', pos: [5.85, 0.3, -IN], n: [0, 0, -1], node: 'H2' },
    { id: 'hall2', room: 'hall', pos: [13.0, 0.3, -1.4 + IN], n: [0, 0, 1], node: 'H3' },
    { id: 'dining1', room: 'dining', pos: [6 - IN, 0.3, -3.2], n: [-1, 0, 0], node: 'D5' },
    { id: 'bath1', room: 'bath', pos: [9.6 - IN, 0.3, -2.0], n: [-1, 0, 0], node: 'B2' },
    { id: 'sewing1', room: 'sewing', pos: [14.4 - IN, 0.3, -5.2], n: [-1, 0, 0], node: 'W2' },
  ],

  // The links a player must be able to jump, checked against TUNING (src/world/route-check.js). Every one is two-way
  // unless oneWay. grab: true means a clean jump isn't enough, the link is meant to need a ledge grab.
  // Mr. Tidy's waypoint graph, on the floor. Nodes: [x, z]. Edges are two-way and are checked against his body in the route check.
  waypoints: {
    L1: [4.85, 1.1], L2: [3.05, 1.0], L3: [1.8, 2.0], L4: [2.0, 4.2], L5: [4.4, 3.7], Ld: [5.5, 4.35], // living room
    Kd: [6.6, 4.35], K1: [6.8, 4.0], K2: [9.5, 4.2], K3: [9.55, 2.3], K4: [8.5, 1.4], K5: [6.7, 1.7], // kitchen
    Hw: [1.2, -0.45], Hl: [3.05, -0.45], H2: [5.6, -0.86], Hb: [7.95, -0.45], Hk: [8.5, -0.45], H3: [11.2, -0.45], Hz: [12.05, -0.45], Hs: [13.75, -0.45], Ht: [16.35, -0.45], H4: [16.8, -0.45], // hallway
    Sd: [13.75, 0.5], S1: [13.75, 2.4], S2: [12.3, 2.4], Sk: [11.3, 2.3], S3: [14.2, 3.5], Sq: [15.0, 3.7], // laundry room
    Qd: [15.4, 3.7], Q2: [16.5, 3.6], Q1: [16.3, 2.0], Qh: [16.0, 0.4], Hq: [16.0, -0.45], // parlour, and the hall outside it
    Dd: [3.05, -1.85], D1: [1.2, -2.4], D2: [1.2, -5.2], D3: [3.0, -5.6], D4: [5.0, -5.4], D5: [5.0, -2.6], // dining room
    Bd: [7.95, -1.85], B1: [7.0, -3.4], B2: [8.3, -3.6], // bathroom
    Wd: [12.05, -1.85], W1: [11.4, -3.0], W2: [12.3, -4.4], W3: [12.2, -2.6], // sewing room
    Db: [6.0, -2.65], Bs: [9.6, -3.15], // the doors that join the north rooms up
    Kp: [10.8, 2.3], // the kitchen door to the laundry room
    Ty: [16.35, -1.85], T1: [16.2, -3.0], // study
  },
  waypointEdges: [
    ['L1', 'L2'], ['L2', 'L3'], ['L3', 'L4'], ['L4', 'L5'], ['L5', 'L1'], ['L5', 'Ld'], ['Ld', 'Kd'], ['L2', 'Hl'],
    ['Kd', 'K1'], ['K1', 'K2'], ['K2', 'K3'], ['K3', 'K4'], ['K4', 'K5'], ['K5', 'K1'], ['K4', 'Hk'],
    ['Hw', 'Hl'], ['Hl', 'H2'], ['H2', 'Hb'], ['Hb', 'Hk'], ['Hk', 'H3'], ['H3', 'Hz'], ['Hz', 'Hs'], ['Hs', 'Hq'], ['Hq', 'Ht'], ['Ht', 'H4'], ['Hs', 'Sd'], ['Ht', 'Ty'], ['Ty', 'T1'],
    ['D5', 'Db'], ['Db', 'B1'], ['B2', 'Bs'], ['Bs', 'W1'], ['K3', 'Kp'], ['Kp', 'Sk'], ['Sk', 'S2'],
    ['Hl', 'Dd'], ['Dd', 'D1'], ['D1', 'D2'], ['D2', 'D3'], ['D3', 'D4'], ['D4', 'D5'], ['D5', 'Dd'],
    ['Hb', 'Bd'], ['Bd', 'B1'], ['B1', 'B2'], ['B2', 'Bd'],
    ['Hz', 'Wd'], ['Wd', 'W1'], ['W1', 'W2'], ['W2', 'W3'], ['W3', 'Wd'],
    ['Sd', 'S1'], ['S1', 'S2'], ['S1', 'S3'], ['S2', 'S3'], ['S3', 'Sq'], ['Sq', 'Qd'],
    ['Qd', 'Q2'], ['Q2', 'Q1'], ['Q1', 'Qh'], ['Qh', 'Hq'],
  ],
  // Where a run after the first can start you, [x, z, yaw]: a different room each time (src/main.js pickStart)
  spawns: [[2.5, 1.6, 0], [7.6, 1.9, 1.57], [1.3, -3.6, -1.57], [7.0, -2.4, 0], [12.3, -3.2, 3.14], [13.0, 2.6, 0], [16.4, 3.4, 0], [16.0, -2.7, 1.57], [9.5, -0.7, 1.57]],
  vacStart: 'L1', // where he starts
  // His fixed loop (he finds his own way between stops). It takes in the whole house, including the far end of the hallway.
  patrol: ['L2', 'Hl', 'Hk', 'H3', 'Hs', 'S1', 'S2', 'S1', 'Hs', 'H4', 'Hs', 'H3', 'Hk', 'K4', 'K3', 'K2', 'K1', 'K5', 'K1', 'Kd', 'Ld', 'L5', 'L4', 'L3', 'L2', 'L1', 'D1', 'D2', 'D3', 'D4', 'D5', 'B1', 'B2', 'W1', 'W2', 'W3', 'Sk', 'S3', 'Q1', 'Q2', 'T1'],

  // Knockables: { id, type (TUNING.knockTypes), on (a solid's id), x, z }. Height comes from the surface, so nothing floats.
  // on: 'floor' stands it on the ground. 20 in all, weighted toward tiers 1–2 and the far end of the hallway.
  // Living room 4, kitchen 6, hallway 4, storage 6. Tier 0: 2 · tier 1: 9 · tier 2: 9.
  knockables: [
    // living room
    { id: 'cup1', type: 'teacup', on: 'coffeeTable', x: 3.15, z: 2.35 },
    { id: 'lamp', type: 'table_lamp', on: 'coffeeTable', x: 3.65, z: 2.75 },
    { id: 'globe', type: 'snow_globe', on: 'book4', x: 1.82, z: 5.18 },
    { id: 'clock', type: 'mantel_clock', on: 'book3', x: 1.42, z: 5.18, yaw: Math.PI }, // (facing the room)
    { id: 'figurine', type: 'cat_figurine', on: 'book2', x: 0.98, z: 5.18 },
    { id: 'tvFrame', type: 'picture_frame', on: 'tvUnit', x: 5.62, z: 1.85, yaw: -1.57 },
    { id: 'remote', type: 'tv_remote', on: 'rodW', x: 3.05, z: 5.2, yaw: 0.4 }, // the TV remote: the tutorial's, then just another thing to bat off
    { id: 'succulent', type: 'succulent_pot', on: 'coffeeTable', x: 3.25, z: 2.78 },
    { id: 'monstera', type: 'monstera', on: 'floor', topple: true, x: 5.55, z: 0.45 },
    { id: 'treeYarn', type: 'yarn_ball', on: 'tree4', x: 1.2, z: 0.55 },
    { id: 'yarn', type: 'yarn_ball', on: 'couchSeat', x: 0.8, z: 3.0 },
    { id: 'floorVaseL', type: 'vase', on: 'floor', topple: true, x: 5.65, z: 3.4 },
    // kitchen
    { id: 'jar', type: 'cookie_jar', on: 'fridge', x: 10.35, z: 4.95 },
    { id: 'teapot', type: 'teapot', on: 'c1', x: 7.2, z: 0.45 },
    { id: 'mug2', type: 'mug', on: 'c1', x: 6.8, z: 0.45 },
    { id: 'mug5', type: 'mug', on: 'c1', x: 7.72, z: 0.4 },
    { id: 'shelfPlate', type: 'dinner_plate', on: 'shelfD2', x: 7.2, z: 0.21 },
    { id: 'mug3', type: 'mug', on: 'k1', x: 7.1, z: 5.18 },
    { id: 'salt', type: 'salt_shaker', on: 'k2', x: 8.86, z: 5.18 },
    { id: 'pepper', type: 'pepper_shaker', on: 'k2', x: 8.98, z: 5.2 },
    { id: 'k2Plate', type: 'dinner_plate', on: 'k2', x: 8.5, z: 5.18 },
    { id: 'cakeStand', type: 'cake_stand', on: 'island', x: 8.5, z: 2.9 },
    { id: 'sugar', type: 'sugar_bowl', on: 'c2a', x: 9.6, z: 0.35 },
    { id: 'jug', type: 'measuring_jug', on: 'c3', x: 10.45, z: 3.4, yaw: 1.57 },
    { id: 'geranium', type: 'geranium_pot', on: 'c3', x: 10.45, z: 4.2 },
    { id: 'jade', type: 'jade_plant', on: 'c2b', x: 10.45, z: 1.2 },
    // hallway: louder the closer to Grandma's door
    { id: 'hallVase', type: 'vase', on: 'hallTable', x: 5.13, z: -0.25 },
    { id: 'phone', type: 'rotary_phone', on: 'sideTable', x: 10.4, z: -1.1 },
    { id: 'glasses', type: 'glasses', on: 'sideTable', x: 10.12, z: -1.05 },
    { id: 'standPlant', type: 'snake_plant', on: 'plantStand', x: 15.0, z: -1.1 },
    { id: 'floorVaseH', type: 'vase', on: 'floor', topple: true, x: 17.3, z: -1.15 },
    // the laundry room: crockery put away on the boxes, the duster, the odd thing nobody could throw out
    { id: 'w1Mug', type: 'mug', on: 'w1', x: 11.1, z: 3.4 },
    { id: 's1Pot', type: 'teapot', on: 's1', x: 13.47, z: 4.3, yaw: 1.57 },
    { id: 'e1Frame', type: 'picture_frame', on: 'e1', x: 15.1, z: 1.2, yaw: -1.57 },
    { id: 'w2Vase', type: 'vase', on: 'w1', x: 11.1, z: 3.25 },
    { id: 'e2Plate', type: 'dinner_plate', on: 'e2', x: 15.1, z: 2.5 },
    { id: 's2Candle', type: 'candlestick', on: 's2', x: 14.2, z: 4.3 },
    { id: 'pothos', type: 'pothos', on: 'lShelf', x: 12.5, z: 4.36 },
    { id: 'roll2', type: 'toilet_roll', on: 'lShelf', x: 11.7, z: 4.36 },
    // the parlour
    { id: 'pianoClock', type: 'mantel_clock', on: 'piano', x: 17.75, z: 1.35, yaw: -1.57 },
    { id: 'pianoFrame', type: 'picture_frame', on: 'piano', x: 17.75, z: 2.2, yaw: -1.57 },
    { id: 'standGeranium', type: 'geranium_pot', on: 'pStand', x: 17.62, z: 0.37 },
    { id: 'decanter', type: 'crystal_decanter', on: 'pTable', x: 16.43, z: 4.25 },
    { id: 'wine', type: 'wine_glass', on: 'pTable', x: 16.59, z: 4.36 },
    { id: 'lily', type: 'peace_lily', on: 'floor', topple: true, x: 15.65, z: 0.35 },
    // dining room
    { id: 'wallClock', type: 'wall_clock', on: 'clockPeg', x: 5.9, z: -4.5, yaw: -1.57 }, // jump at it and bat it on the way up
    // his five balls of best wool, hidden up high: they won't wake Grandma, and unravelling them makes him furious. All five, though...
    { id: 'woolRed', type: 'wool_red', on: 'e2', x: 15.1, z: 2.1 },
    { id: 'woolBlue', type: 'wool_blue', on: 'tBookB', x: 16.07, z: -3.75 },
    { id: 'woolGreen', type: 'wool_green', on: 'sWardrobe', x: 12.2, z: -5.6 },
    { id: 'woolGold', type: 'wool_gold', on: 'rodE', x: 4.9, z: 5.2 },
    { id: 'woolPurple', type: 'wool_purple', on: 'pShelf', x: 17.76, z: 3.4 },
    { id: 'candle1', type: 'candlestick', on: 'dTable', x: 2.6, z: -3.9 },
    { id: 'cup2', type: 'teacup', on: 'dTable', x: 3.4, z: -3.8 },
    { id: 'cake', type: 'cake_stand', on: 'dTable', x: 3.05, z: -4.15 },
    { id: 'wine2', type: 'wine_glass', on: 'dTable', x: 2.5, z: -4.22 },
    { id: 'violet', type: 'african_violet', on: 'clockStand', x: 5.7, z: -4.5 },
    { id: 'frame', type: 'picture_frame', on: 'dShelf1', x: 2.6, z: -6.43 },
    { id: 'cup3', type: 'teacup', on: 'dShelf2', x: 4.2, z: -6.42 },
    { id: 'candle2', type: 'candlestick', on: 'dShelf2', x: 3.7, z: -6.42 },
    { id: 'sideVase', type: 'vase', on: 'dSide', x: 1.3, z: -6.3 },
    { id: 'urn', type: 'urn', on: 'dSide', x: 0.92, z: -6.3 }, // Grandpa
    { id: 'decanter2', type: 'crystal_decanter', on: 'dSide', x: 1.56, z: -6.3 },
    // bathroom
    { id: 'dentures', type: 'dentures_glass', on: 'bSink', x: 8.64, z: -4.5 },
    { id: 'soap', type: 'soap_dish', on: 'bSink', x: 9.38, z: -4.5 },
    { id: 'perfume', type: 'perfume', on: 'bShelf', x: 7.0, z: -4.82 },
    { id: 'talc', type: 'talc_tin', on: 'bShelf', x: 7.25, z: -4.82 },
    { id: 'duck', type: 'rubber_duck', on: 'tubS', x: 6.9, z: -4.15 },
    { id: 'roll', type: 'toilet_roll', on: 'bRadiator', x: 6.75, z: -1.55 },
    { id: 'fern', type: 'fern_pot', on: 'bRadiator', x: 7.02, z: -1.55 },
    { id: 'toothbrush', type: 'toothbrush_cup', on: 'bSink', x: 9.4, z: -4.8 }, // (at the back corner, beside the taps: not in the basin)
    { id: 'bostonFern', type: 'boston_fern', on: 'bCabinet', x: 9.02, z: -4.85 },
    // sewing room
    { id: 'buttons', type: 'button_jar', on: 'sDesk', x: 13.9, z: -3.5 },
    { id: 'buttons2', type: 'button_jar', on: 'sShelf1', x: 14.23, z: -4.75 },
    { id: 'cup4', type: 'teacup', on: 'sDesk', x: 13.9, z: -4.1 },
    { id: 'pins', type: 'pincushion', on: 'sDesk', x: 13.68, z: -3.75 },
    { id: 'lily2', type: 'peace_lily', on: 'floor', topple: true, x: 10.0, z: -1.78 },
    // study
    { id: 'studyFig', type: 'cat_figurine', on: 'tBookA', x: 15.07, z: -3.75 },
    { id: 'studyLamp', type: 'table_lamp', on: 'tDesk', x: 17.55, z: -3.05 },
    { id: 'studyCup', type: 'teacup', on: 'tDesk', x: 17.5, z: -2.45 },
    { id: 'cactus', type: 'cactus_pot', on: 'tDesk', x: 17.75, z: -2.75 },
  ],

  // Links that need a ledge grab (a clean jump can't reach). from: a solid id, or 'floor' with a start point.
  grabLinks: [
    ['floor', 'plantStand', { x: 15.0, z: -0.62 }],
    ['floor', 'w1', { x: 11.8, z: 3.4 }],
    ['floor', 'e1', { x: 14.6, z: 1.2 }],
    ['e1', 'e2'],
    ['floor', 's1', { x: 13.45, z: 3.8 }],
    ['s1', 's2'],
    ['tubS', 'bShelf', { x: 7.1, z: -4.15 }],
  ],
  links: [
    // the high route, living room ↔ kitchen, without touching the floor
    ['book4', 'rodW'], ['rodW', 'bracketA'], ['bracketA', 'rodE'], ['rodE', 'header'], ['header', 'k1'], ['k1', 'k2'], ['k2', 'fridge'],
    // the climb onto it
    ['book1', 'book2'], ['book2', 'book3'], ['book3', 'book4'],
    // the counter run
    ['c1', 'c2a'], ['c2b', 'c3'], ['c3', 'fridge'],
    // the cat tree
    ['tree1', 'tree2'], ['tree2', 'tree3'], ['tree3', 'tree4'],
    // the dining room
    ['dChairN', 'dTable'], ['dChairS', 'dTable'], ['dSide', 'dShelf1'], ['dShelf1', 'dShelf2'],
    // the bathroom and the sewing room
    ['pStool', 'pKeys'], ['pKeys', 'piano'], ['piano', 'pShelf'],
    ['sChair', 'sDesk'], ['sDesk', 'sShelf1'], ['sShelf1', 'sShelf2'], ['sShelf2', 'scP'], ['sWardrobe', 'scP'], ['dShelf2', 'dcP'],
  ],
};
