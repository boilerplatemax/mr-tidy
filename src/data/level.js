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

/** Floor-length curtains on the wall with a pelmet you can walk along. side: the face that looks into the room. Open: drawn by the model. */
function openCurtain(id, room, x0, x1, z0, z1, side) {
  const inX = side === 'e' || side === 'w', c = 0.05, d = 0.15; // the fabric, m out from the wall
  const cur = inX ? [side === 'e' ? x0 + c : x1 - d, side === 'e' ? x0 + d : x1 - c, z0, z1] : [x0, x1, side === 's' ? z0 + c : z1 - d, side === 's' ? z0 + d : z1 - c];
  return [box(id + 'P', room, x0, x1, z0, z1, 2.0, 2.2, { noVisual: true }), box(id, room, cur[0], cur[1], cur[2], cur[3], 0, 2.0, { land: false, stripes: [side], climbTo: id + 'P', noVisual: true })];
}
/** Closed curtains hanging well out from the wall: climb them, or slip behind them. */
function closedCurtain(id, room, x0, x1, z0, z1, side) {
  const inX = side === 'e' || side === 'w', t = 0.06;
  const cur = inX ? [side === 'e' ? x1 - t : x0, side === 'e' ? x1 : x0 + t, z0, z1] : [x0, x1, side === 's' ? z1 - t : z0, side === 's' ? z1 : z0 + t];
  return [box(id + 'P', room, x0, x1, z0, z1, 2.0, 2.06, { tex: 'wood_walnut' }), box(id, room, cur[0], cur[1], cur[2], cur[3], 0, 2.0, { land: false, stripes: [side], climbTo: id + 'P', tex: 'fabric_velvet_curtain', occludes: true })];
}

export const LEVEL = {
  ceiling: H,
  wallT: T,

  rooms: [
    { id: 'living', name: 'living room', min: [0, 0], max: [6, 5.4], floorTex: 'carpet_rose', wallTex: 'wallpaper_rose', surface: 'carpet' },
    { id: 'kitchen', name: 'kitchen', min: [6, 0], max: [10.8, 5.4], floorTex: 'floor_lino_checker', wallTex: 'wallpaper_mustard', surface: 'lino' },
    { id: 'storage', name: 'storage room', min: [12, 0], max: [15.4, 3.8], floorTex: 'floor_planks', wallTex: 'plaster', surface: 'wood' },
    { id: 'hall', name: 'hallway', min: [0, -1.4], max: [18, 0], floorTex: 'floor_planks', wallTex: 'wallpaper_damask_green', surface: 'wood' },
    { id: 'dining', name: 'dining room', min: [0, -6.6], max: [6, -1.4], floorTex: 'floor_planks', wallTex: 'wallpaper_rose', surface: 'wood' },
    { id: 'bath', name: 'bathroom', min: [6, -5], max: [9.6, -1.4], floorTex: 'tile_bath_floor', wallTex: 'tile_mint_wall', surface: 'lino' },
    { id: 'sewing', name: 'sewing room', min: [9.6, -6], max: [14.4, -1.4], floorTex: 'carpet_rose', wallTex: 'wallpaper_mustard', surface: 'carpet' },
    { id: 'pantry', name: 'pantry', min: [10.8, 1.6], max: [12, 3.8], floorTex: 'floor_lino_checker', wallTex: 'plaster', surface: 'lino' }, // joins the kitchen to the storage room
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
    { axis: 'x', at: -6.6, from: -IN, to: 6 + IN }, // dining room, north
    { axis: 'z', at: 0, from: -6.6 + IN, to: -1.4 - IN }, // dining room, west
    { axis: 'z', at: 6, from: -6.6 + IN, to: -1.4 - IN, openings: [{ from: -3.1, to: -2.2, top: 2.05 }] }, // dining room | bathroom
    { axis: 'x', at: -5, from: 6 + IN, to: 9.6 + IN }, // bathroom, north
    { axis: 'z', at: 9.6, from: -6 + IN, to: -1.4 - IN, openings: [{ from: -3.6, to: -2.7, top: 2.05 }] }, // bathroom | sewing room
    { axis: 'x', at: -4, from: 14.4 - IN, to: 18 + IN }, // study, north
    { axis: 'z', at: 18, from: -4 + IN, to: -1.4 - IN }, // study, east
    { axis: 'x', at: 1.6, from: 10.8 - IN, to: 12 + IN }, // pantry, north
    { axis: 'x', at: 3.8, from: 10.8 - IN, to: 12 - IN }, // pantry, south
    { axis: 'x', at: -6, from: 9.6 - IN, to: 14.4 + IN }, // sewing room, north
    { axis: 'z', at: 14.4, from: -6 + IN, to: -1.4 - IN }, // sewing room, east
    { axis: 'x', at: 0, from: -IN, to: 18 + IN, openings: [ // hallway, south
      { from: 1.8, to: 4.3, top: 2.05 }, // a wide arch to the living room
      { from: 8.05, to: 8.95, top: 2.05 }, // to the kitchen
      { from: 13.3, to: 14.2, top: 2.05 }, // to the storage room
    ] },
    { axis: 'x', at: 5.4, from: -IN, to: 10.8 + IN }, // living room + kitchen, south
    { axis: 'x', at: 3.8, from: 12 - IN, to: 15.4 + IN }, // storage, south
    { axis: 'z', at: 0, from: -1.4 + IN, to: 5.4 - IN }, // west end
    // DESIGN NOTE: a wall to the ceiling would cut the high route, so this doorway has no lintel: the wall above it is
    // open like a transom left ajar. The door header (solid 'header') bridges it at 2.12 m and the cat walks through.
    { axis: 'z', at: 6, from: IN, to: 5.4 - IN, openings: [{ from: 3.9, to: 4.8, top: 2.05, noLintel: true }] }, // living | kitchen
    { axis: 'z', at: 10.8, from: IN, to: 5.4 - IN, openings: [{ from: 1.85, to: 2.75, top: 2.05 }] }, // kitchen | pantry
    { axis: 'z', at: 12, from: IN, to: 3.8 - IN, openings: [{ from: 3.0, to: 3.65, top: 2.05 }] }, // pantry | storage
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
    box('curtainW', 'living', 2.6, 3.5, 5.03, 5.19, 0, 1.99, { land: false, stripes: ['n'], climbTo: 'rodW' }),
    box('curtainE', 'living', 4.6, 5.2, 5.03, 5.19, 0, 1.99, { land: false, stripes: ['n'], climbTo: 'rodE' }),
    box('tvUnit', 'living', 5.465, 6 - IN, 1.82, 2.78, 0, 0.8, { noVisual: true }),
    ...closedCurtain('lwc', 'living', 4.6, 5.5, IN, 0.46, 's'), // closed, with room to hide behind
    // A scratching panel beside the rod: a second, climbed way onto the route (and a kick-off wall).
    box('scratchPanel', 'living', 5.3, 5.8, 5.0, 5.4 - IN, 0, 1.95, { stripes: ['n'], tex: 'fabric_carpet' }),
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
    box('kitchenPanel', 'kitchen', 9.3, 9.75, 5.0, 5.4 - IN, 0, 1.95, { stripes: ['n'], tex: 'fabric_carpet' }), // a climbed way off the kitchen floor, between k2 and the fridge
    box('shelfD2', 'kitchen', 6.6, 7.9, IN, 0.35, 1.52, 1.60), // dead end above c1

    // ------------------------------------------------------------ hallway: the dangerous crossing
    box('sideTable', 'hall', 10.0, 10.7, -1.4 + IN, -0.875, 0, 0.7),
    box('plantStand', 'hall', 14.8, 15.2, -1.3, -0.9, 0, 1.1, { tex: 'wood_walnut' }),

    // ------------------------------------------------------------ storage: ledges 1.1 m apart (a jump alone can't do it)
    // DESIGN NOTE: neighbouring units touch. A slot narrower than the cat (0.24 m) is a trap it can drop into and not leave.
    box('w1', 'storage', 12 + IN, 12.55, 1.0, 2.3, 0, 1.1, { tex: 'cardboard' }),
    box('w2', 'storage', 12 + IN, 12.55, 2.3, 3.0, 0, 2.2),
    box('e1', 'storage', 14.85, 15.4 - IN, 0.6, 1.9, 0, 1.1, { tex: 'cardboard' }),
    box('e2', 'storage', 14.85, 15.4 - IN, 1.9, 3.0, 0, 2.2),
    box('s1', 'storage', 13.25, 13.7, 3.25, 3.8 - IN, 0, 1.1, { tex: 'cardboard' }),
    box('s2', 'storage', 13.7, 14.6, 3.25, 3.8 - IN, 0, 2.2),

    // ------------------------------------------------------------ dining room: table, sideboard, then the shelves along the north wall
    box('dTable', 'dining', 2.3, 3.7, -4.42, -3.58, 0.71, 0.75, { noVisual: true }),
    box('dChairN', 'dining', 2.79, 3.21, -4.96, -4.54, 0.42, 0.46, { noVisual: true }),
    box('dChairS', 'dining', 2.79, 3.21, -3.46, -3.04, 0.42, 0.46, { noVisual: true }),
    box('dChairW', 'dining', 1.69, 2.11, -4.21, -3.79, 0.42, 0.46, { noVisual: true }),
    box('dChairE', 'dining', 3.89, 4.31, -4.21, -3.79, 0.42, 0.46, { noVisual: true }),
    box('dSide', 'dining', 0.72, 1.68, -6.6 + IN, -6.065, 0, 0.8, { tex: 'wood_walnut' }), // the sideboard
    ...openCurtain('dc', 'dining', 4.7, 5.9, -6.6 + IN, -6.6 + IN + 0.2, 's'),
    ...closedCurtain('dwc', 'dining', IN, 0.46, -3.2, -2.3, 'e'),
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
    box('sBed', 'sewing', 9.9, 10.99, -6 + IN, -3.77, 0, 0.55, { noVisual: true }),
    box('sWardrobe', 'sewing', 11.5, 12.58, -6 + IN, -5.28, 0, 2.07, { noVisual: true }),
    box('sDesk', 'sewing', 13.525, 14.4 - IN, -4.4, -3.2, 0, 0.75, { noVisual: true }),
    box('sChair', 'sewing', 12.79, 13.21, -4.01, -3.59, 0, 0.46, { noVisual: true }),
    box('sShelf1', 'sewing', 14.125, 14.4 - IN, -5.0, -4.5, 1.21, 1.25, { noVisual: true }),
    box('sShelf2', 'sewing', 14.125, 14.4 - IN, -5.55, -5.05, 1.71, 1.75, { noVisual: true }),
    ...openCurtain('sc', 'sewing', 13.1, 14.3, -6 + IN, -6 + IN + 0.2, 's'),
    ...closedCurtain('ssc', 'sewing', 10.0, 10.95, -1.86, -1.4 - IN, 'n'),

    // ------------------------------------------------------------ hall end and the study
    ...openCurtain('hc', 'hall', IN, IN + 0.2, -1.1, -0.3, 'e'),
    box('tStack', 'study', 14.93, 15.87, -4 + IN, -3.6, 0, 1.95, { noVisual: true }),
    box('tChair', 'study', 16.8, 17.64, -4 + IN, -3.125, 0, 0.64, { noVisual: true }),
    ...closedCurtain('tc', 'study', 17.54, 18 - IN, -2.9, -2.0, 'w'),
  ],

  // The real models. fit: stretched to fill those solids (see src/world/dress.js); the solids are drawn by these instead of as boxes.
  dress: [
    // living room
    { model: 'couch', fit: ['couchSeat', 'couchBack', 'couchArmN', 'couchArmS'], rot: 90 },
    { model: 'cattree_platform_60', fit: ['tree1'] }, { model: 'cattree_platform_60', fit: ['tree2'] }, { model: 'cattree_platform_60', fit: ['tree3'] }, { model: 'cattree_perch_tray', fit: ['tree4'], rot: 180 },
    { model: 'cattree_post_80', fit: ['tree1post'] }, { model: 'cattree_post_80', fit: ['tree2post'] }, { model: 'cattree_post_80', fit: ['tree3post'] }, { model: 'cattree_post_80', fit: ['tree4post'] },
    { model: 'psx_nightstand_oak', fit: ['book1'], rot: 180 }, { model: 'bookcase', fit: ['book2'], rot: 180 }, { model: 'bookcase', fit: ['book3'], rot: 180 }, { model: 'bookcase', fit: ['book4'], rot: 180 },
    { model: 'curtains_pelmet', fit: ['curtainW', 'rodW'], rot: 180 }, { model: 'curtains_pelmet', fit: ['curtainE', 'rodE'], rot: 180 },
    { model: 'tv_console', fit: ['tvUnit'], rot: -90, h: 0.8, tv: true },
    { model: 'psx_rug_braided', at: [3.0, 0.002, 1.6] }, { model: 'psx_floor_lamp', at: [0.35, 0, 4.55] }, { model: 'ceiling_light', at: [3, 0.6, 2.7] },
    // kitchen
    { model: 'counter_module', fit: ['c1'], h: 0.9 }, { model: 'counter_module', fit: ['c2a'], h: 0.9 }, { model: 'counter_module', fit: ['c2b'], rot: -90, h: 0.9 }, { model: 'counter_module', fit: ['c3'], rot: -90, h: 0.9 },
    { model: 'fridge', fit: ['fridge'], rot: -90 }, { model: 'dining_chair', fit: ['chair'], h: 0.46 },
    { model: 'shelf_floating_120', fit: ['k1'], rot: 180, top: true }, { model: 'shelf_floating_120', fit: ['k2'], rot: 180, top: true }, { model: 'shelf_floating_120', fit: ['shelfD2'], top: true },
    { model: 'ceiling_light', at: [8.4, 0.6, 2.7] },
    // hallway
    { model: 'side_table', fit: ['sideTable'], h: 0.78 }, { model: 'grandma_door', at: [18 - IN, 0, -0.7], rot: -90 },
    { model: 'curtains_pelmet', fit: ['hc', 'hcP'], rot: 90 },
    { model: 'ceiling_light', at: [5, 0.6, -0.7] }, { model: 'ceiling_light', at: [13, 0.6, -0.7] },
    // storage
    { model: 'psx_wardrobe_oak', fit: ['w2'], rot: 90, h: 2.07 }, { model: 'psx_wardrobe_oak', fit: ['e2'], rot: -90, h: 2.07 }, { model: 'psx_wardrobe_oak', fit: ['s2'], rot: 180, h: 2.07 },
    { model: 'psx_box_open', at: [14.3, 0, 0.7] }, { model: 'psx_trash_bag', at: [12.5, 0, 3.4] },
    // dining room
    { model: 'dining_table', at: [3, 0, -4] },
    { model: 'dining_chair', at: [3, 0, -4.75] }, { model: 'dining_chair', at: [3, 0, -3.25], rot: 180 }, { model: 'dining_chair', at: [1.9, 0, -4], rot: 90 }, { model: 'dining_chair', at: [4.1, 0, -4], rot: -90 },
    { model: 'bookcase', at: [IN, 0, -5.2], rot: 90 }, { model: 'curtains_pelmet', fit: ['dc', 'dcP'] },
    { model: 'shelf_floating_80', at: [2.6, 1.25, -6.6 + IN] }, { model: 'shelf_floating_120', at: [4.0, 1.7, -6.6 + IN] },
    { model: 'psx_rug_braided', at: [3.0, 0.002, -4], rot: 90 }, { model: 'psx_picture_landscape', at: [1.2, 0.2, -6.6 + IN] }, { model: 'psx_wall_clock', at: [5.925, 0.1, -4.5], rot: -90 }, { model: 'ceiling_light', at: [3, 0.6, -4] },
    // bathroom
    { model: 'psx_sink_unit_white', at: [9.019, 0, -5 + IN + 0.31], squash: [0.96, 0.35] }, { model: 'medicine_cabinet', at: [9.02, 1.7, -5 + IN] },
    { model: 'shelf_floating_60_white', at: [7.1, 1.34, -5 + IN] }, { model: 'radiator', at: [6.75, 0, -1.4 - IN], rot: 180 }, { model: 'ceiling_light', at: [7.8, 0.6, -3.2] },
    // sewing room
    { model: 'psx_bed_single_oak', at: [10.445, 0, -4.85] }, { model: 'psx_wardrobe_oak', at: [12.04, 0, -5.62] },
    { model: 'psx_table_pine', at: [13.95, 0, -3.8], rot: 90 }, { model: 'psx_chair_ladder_pine', at: [13.0, 0, -3.8], rot: 90 },
    { model: 'shelf_floating_60', at: [14.4 - IN, 1.25, -4.75], rot: -90 }, { model: 'shelf_floating_60', at: [14.4 - IN, 1.75, -5.3], rot: -90 },
    { model: 'curtains_pelmet', fit: ['sc', 'scP'] }, { model: 'ceiling_light', at: [12, 0.6, -3.7] },
    // study
    { model: 'bookcase', at: [15.4, 0, -4 + IN] }, { model: 'armchair', at: [17.22, 0, -3.525], rot: 180 }, { model: 'ceiling_light', at: [16.2, 0.6, -2.7] },
  ],

  tub: { x0: 6.2, x1: 8.0, z0: -5 + IN, z1: -4.1, top: 0.55 }, // the enamel tub drawn over its rims (src/world/house.js)

  // Painted windows on the wall behind the curtains: moonlit, for show. n: the way it faces. { x, z, w }
  windows: [
    { x: 3.05, z: 5.4 - IN, n: [0, -1], w: 0.8 }, { x: 4.9, z: 5.4 - IN, n: [0, -1], w: 0.55 }, { x: 5.05, z: IN, n: [0, 1], w: 0.8 },
    { x: 5.3, z: -6.6 + IN, n: [0, 1], w: 0.9 }, { x: IN, z: -2.75, n: [1, 0], w: 0.75 }, { x: 13.7, z: -6 + IN, n: [0, 1], w: 0.9 },
    { x: 10.47, z: -1.4 - IN, n: [0, -1], w: 0.8 }, { x: IN, z: -0.7, n: [1, 0], w: 0.6 }, { x: 18 - IN, z: -2.45, n: [-1, 0], w: 0.75 },
  ],

  // Places to hide: he can't see a cat low down in here, unless he goes looking and gets lucky. min/max: [x, z].
  hides: [
    { id: 'tub', min: [6.3, -4.825], max: [7.9, -4.2] }, { id: 'lwc', min: [4.6, IN], max: [5.5, 0.4] }, { id: 'dwc', min: [IN, -3.2], max: [0.4, -2.3] },
    { id: 'ssc', min: [10.0, -1.8], max: [10.95, -1.4 - IN] }, { id: 'tc', min: [17.6, -2.9], max: [18 - IN, -2.0] },
  ],

  // The cats who came before, down the hallway in order, the empty frame nearest Grandma's door. x along the hall's south wall.
  portraits: [[0.7, '01_biscuit', 1], [1.35, '02_mr_whiskers', 2], [4.75, '03_duchess', 3], [5.5, '04_pepper', 4], [6.9, '05_tuna', 5], [10.0, '06_marigold', 6], [11.4, '07_sapphire', 7], [12.6, '08_mittens', 8], [15.5, '09_empty', 0]],

  // Grandma's door, on the wall at the east end of the hallway. It can't be opened.
  grandmaDoor: { x: 18 - IN, zMin: -1.15, zMax: -0.25, top: 2.05, strip: 0.03 },

  // Wall outlets. He starts plugged into the first one, just outside Grandma's door; if the cat swipes the one he's using he
  // ends up in whichever is nearest. pos is on the wall face, n the way the plate faces, node the waypoint the cord runs from.
  outlets: [
    { id: 'grandma', room: 'hall', pos: [16.8, 0.3, -IN], n: [0, 0, -1], node: 'H4' },
    { id: 'living1', room: 'living', pos: [6 - IN, 0.3, 1.2], n: [-1, 0, 0], node: 'L1' },
    { id: 'living2', room: 'living', pos: [IN, 0.3, 4.6], n: [1, 0, 0], node: 'L4' },
    { id: 'kitchen1', room: 'kitchen', pos: [10.8 - IN, 0.3, 1.72], n: [-1, 0, 0], node: 'K3' },
    { id: 'kitchen2', room: 'kitchen', pos: [8.0, 0.3, 5.4 - IN], n: [0, 0, -1], node: 'K2' },
    { id: 'storage1', room: 'storage', pos: [12.8, 0.3, IN], n: [0, 0, 1], node: 'Sd' },
    { id: 'hall1', room: 'hall', pos: [5.5, 0.3, -IN], n: [0, 0, -1], node: 'H2' },
    { id: 'hall2', room: 'hall', pos: [13.0, 0.3, -1.4 + IN], n: [0, 0, 1], node: 'H3' },
    { id: 'dining1', room: 'dining', pos: [6 - IN, 0.3, -3.2], n: [-1, 0, 0], node: 'D5' },
    { id: 'bath1', room: 'bath', pos: [9.6 - IN, 0.3, -2.0], n: [-1, 0, 0], node: 'B2' },
    { id: 'sewing1', room: 'sewing', pos: [14.4 - IN, 0.3, -5.2], n: [-1, 0, 0], node: 'W2' },
  ],

  // The links a player must be able to jump, checked against TUNING (src/world/route-check.js). Every one is two-way
  // unless oneWay. grab: true means a clean jump isn't enough, the link is meant to need a ledge grab.
  // Mr. Tidy's waypoint graph, on the floor. Nodes: [x, z]. Edges are two-way and are checked against his body in the route check.
  waypoints: {
    L1: [5.2, 1.2], L2: [3.05, 1.0], L3: [1.8, 2.0], L4: [2.0, 4.2], L5: [4.4, 3.7], Ld: [5.5, 4.35], // living room
    Kd: [6.6, 4.35], K1: [6.8, 4.0], K2: [9.5, 4.2], K3: [9.55, 2.3], K4: [8.5, 1.4], K5: [6.7, 1.7], // kitchen
    Hw: [1.2, -0.45], Hl: [3.05, -0.45], H2: [5.6, -0.45], Hb: [7.95, -0.45], Hk: [8.5, -0.45], H3: [11.2, -0.45], Hz: [12.05, -0.45], Hs: [13.75, -0.45], Ht: [16.35, -0.45], H4: [16.8, -0.45], // hallway
    Sd: [13.75, 0.5], S1: [13.75, 2.0], S2: [13.0, 2.3], S3: [14.4, 2.3], // storage
    Dd: [3.05, -1.85], D1: [1.2, -2.4], D2: [1.2, -5.2], D3: [3.0, -5.6], D4: [5.0, -5.4], D5: [5.0, -2.6], // dining room
    Bd: [7.95, -1.85], B1: [7.0, -3.4], B2: [8.3, -3.6], // bathroom
    Wd: [12.05, -1.85], W1: [11.4, -3.0], W2: [12.3, -4.4], W3: [12.2, -2.6], // sewing room
    Db: [6.0, -2.65], Bs: [9.6, -3.15], // the doors that join the north rooms up
    Kp: [10.8, 2.3], Pc: [11.4, 2.3], Pa: [11.4, 3.32], Pb: [12.0, 3.32], Sp: [12.8, 3.4], // kitchen, pantry, storage
    Ty: [16.35, -1.85], T1: [16.2, -3.0], // study
  },
  waypointEdges: [
    ['L1', 'L2'], ['L2', 'L3'], ['L3', 'L4'], ['L4', 'L5'], ['L5', 'L1'], ['L5', 'Ld'], ['Ld', 'Kd'], ['L2', 'Hl'],
    ['Kd', 'K1'], ['K1', 'K2'], ['K2', 'K3'], ['K3', 'K4'], ['K4', 'K5'], ['K5', 'K1'], ['K4', 'Hk'],
    ['Hw', 'Hl'], ['Hl', 'H2'], ['H2', 'Hb'], ['Hb', 'Hk'], ['Hk', 'H3'], ['H3', 'Hz'], ['Hz', 'Hs'], ['Hs', 'Ht'], ['Ht', 'H4'], ['Hs', 'Sd'], ['Ht', 'Ty'], ['Ty', 'T1'],
    ['D5', 'Db'], ['Db', 'B1'], ['B2', 'Bs'], ['Bs', 'W1'], ['K3', 'Kp'], ['Kp', 'Pc'], ['Pc', 'Pa'], ['Pa', 'Pb'], ['Pb', 'Sp'], ['Sp', 'S2'],
    ['Hl', 'Dd'], ['Dd', 'D1'], ['D1', 'D2'], ['D2', 'D3'], ['D3', 'D4'], ['D4', 'D5'], ['D5', 'Dd'],
    ['Hb', 'Bd'], ['Bd', 'B1'], ['B1', 'B2'], ['B2', 'Bd'],
    ['Hz', 'Wd'], ['Wd', 'W1'], ['W1', 'W2'], ['W2', 'W3'], ['W3', 'Wd'],
    ['Sd', 'S1'], ['S1', 'S2'], ['S1', 'S3'],
  ],
  vacStart: 'L1', // where he starts
  // His fixed loop (he finds his own way between stops). It takes in the whole house, including the far end of the hallway.
  patrol: ['L2', 'Hl', 'Hk', 'H3', 'Hs', 'S1', 'S2', 'S1', 'Hs', 'H4', 'Hs', 'H3', 'Hk', 'K4', 'K3', 'K2', 'K1', 'K5', 'K1', 'Kd', 'Ld', 'L5', 'L4', 'L3', 'L2', 'L1', 'D1', 'D2', 'D3', 'D4', 'D5', 'B1', 'B2', 'W1', 'W2', 'W3', 'Pc', 'Pa', 'T1'],

  // Knockables: { id, type (TUNING.knockTypes), on (a solid's id), x, z }. Height comes from the surface, so nothing floats.
  // on: 'floor' stands it on the ground. 20 in all, weighted toward tiers 1–2 and the far end of the hallway.
  // Living room 4, kitchen 6, hallway 4, storage 6. Tier 0: 2 · tier 1: 9 · tier 2: 9.
  knockables: [
    // living room
    { id: 'cup1', type: 'teacup', on: 'coffeeTable', x: 3.15, z: 2.35 },
    { id: 'lamp', type: 'table_lamp', on: 'coffeeTable', x: 3.65, z: 2.75 },
    { id: 'globe', type: 'snow_globe', on: 'book4', x: 1.82, z: 5.18 },
    { id: 'clock', type: 'mantel_clock', on: 'book3', x: 1.42, z: 5.18 },
    { id: 'figurine', type: 'cat_figurine', on: 'book2', x: 0.98, z: 5.18 },
    { id: 'tvFrame', type: 'picture_frame', on: 'tvUnit', x: 5.7, z: 2.5 },
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
    // hallway: louder the closer to Grandma's door
    { id: 'phone', type: 'rotary_phone', on: 'sideTable', x: 10.4, z: -1.1 },
    { id: 'glasses', type: 'glasses', on: 'sideTable', x: 10.12, z: -1.05 },
    { id: 'standJar', type: 'vase', on: 'plantStand', x: 15.0, z: -1.1 },
    { id: 'floorVaseH', type: 'umbrella', on: 'floor', topple: true, x: 17.3, z: -1.15 },
    // storage: crockery put away, and the odd thing nobody could throw out
    { id: 'w1Mug', type: 'mug', on: 'w1', x: 12.3, z: 1.6 },
    { id: 's1Pot', type: 'teapot', on: 's1', x: 13.4, z: 3.5 },
    { id: 'e1Frame', type: 'picture_frame', on: 'e1', x: 15.1, z: 1.2 },
    { id: 'w2Vase', type: 'vase', on: 'w2', x: 12.3, z: 2.7 },
    { id: 'e2Plate', type: 'dinner_plate', on: 'e2', x: 15.1, z: 2.5 },
    { id: 's2Candle', type: 'candlestick', on: 's2', x: 14.2, z: 3.5 },
    // dining room
    { id: 'candle1', type: 'candlestick', on: 'dTable', x: 2.6, z: -3.9 },
    { id: 'cup2', type: 'teacup', on: 'dTable', x: 3.4, z: -3.8 },
    { id: 'frame', type: 'picture_frame', on: 'dShelf1', x: 2.6, z: -6.43 },
    { id: 'cup3', type: 'teacup', on: 'dShelf2', x: 4.2, z: -6.42 },
    { id: 'candle2', type: 'candlestick', on: 'dShelf2', x: 3.7, z: -6.42 },
    { id: 'sideVase', type: 'vase', on: 'dSide', x: 1.2, z: -6.3 },
    // bathroom
    { id: 'dentures', type: 'dentures_glass', on: 'bSink', x: 8.64, z: -4.5 },
    { id: 'soap', type: 'soap_dish', on: 'bSink', x: 9.38, z: -4.5 },
    { id: 'perfume', type: 'perfume', on: 'bShelf', x: 7.0, z: -4.82 },
    { id: 'talc', type: 'talc_tin', on: 'bShelf', x: 7.25, z: -4.82 },
    { id: 'duck', type: 'rubber_duck', on: 'tubS', x: 6.9, z: -4.15 },
    { id: 'roll', type: 'toilet_roll', on: 'tubE', x: 7.95, z: -4.5 },
    // sewing room
    { id: 'buttons', type: 'button_jar', on: 'sDesk', x: 13.9, z: -3.5 },
    { id: 'buttons2', type: 'button_jar', on: 'sShelf1', x: 14.23, z: -4.75 },
    { id: 'cup4', type: 'teacup', on: 'sDesk', x: 13.9, z: -4.1 },
    // study
    { id: 'studyFig', type: 'cat_figurine', on: 'tStack', x: 15.4, z: -3.75 },
    { id: 'studyCup', type: 'teacup', on: 'tChair', x: 17.2, z: -3.5 },
  ],

  // Links that need a ledge grab (a clean jump can't reach). from: a solid id, or 'floor' with a start point.
  grabLinks: [
    ['floor', 'plantStand', { x: 15.0, z: -0.62 }],
    ['floor', 'w1', { x: 12.8, z: 1.6 }],
    ['w1', 'w2'],
    ['floor', 'e1', { x: 14.6, z: 1.2 }],
    ['e1', 'e2'],
    ['floor', 's1', { x: 13.45, z: 3.0 }],
    ['s1', 's2'],
    ['tubS', 'bShelf', { x: 7.1, z: -4.15 }],
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
    // the dining room
    ['dChairN', 'dTable'], ['dChairS', 'dTable'], ['dSide', 'dShelf1'], ['dShelf1', 'dShelf2'],
    // the bathroom and the sewing room
    ['sChair', 'sDesk'], ['sDesk', 'sShelf1'], ['sShelf1', 'sShelf2'], ['sShelf2', 'scP'], ['sWardrobe', 'scP'], ['dShelf2', 'dcP'],
  ],
};
