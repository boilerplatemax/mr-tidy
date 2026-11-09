// Every tunable number lives here. Comment what each value affects. Gameplay code never hard-codes these.
// Player-facing comfort options (sensitivity, look preset, volume...) live in src/data/settings.js; the values
// here are the authored defaults those settings start from.

export const TUNING = {
  // ---------------------------------------------------------------- your game
  game: {
    title: 'MR. TIDY', // the title screen's name (drawn in the pixel font: capitals, digits and basic punctuation)
    storagePrefix: 'mrtidy', // localStorage key prefix. CHANGE THIS per game, or two games on one origin share settings
  },

  // ---------------------------------------------------------------- the PS1 frame (src/render/ps1-renderer.js)
  render: {
    // Internal resolution. The renderer picks an INTEGER upscale k = round(screenHeight / lines) and renders
    // floor(screenHeight / k) lines, so every game pixel is exactly k×k screen pixels (no uneven rows, no shimmer).
    targetLines: 240,
    minLines: 200, // never chunkier than this, even on odd screen sizes
    aspect: 4 / 3, // used only by the optional 4:3 framing (pillarboxed). The default framing is 'fill' (widescreen)
    fov: 80, // vertical FOV in degrees (build prompt 4.1). Wide: at cat height the room should loom
    near: 0.04, // the cat's nose is close to everything
    far: 30, // nothing beyond fog far is visible anyway; keep the depth range tight
    sceneBuffer: 'half', // 'half' float scene buffer keeps dark scenes clean before the colour quantise
    shadows: false, // one shadow-casting light at most (a flashlight). Off in the demo
    // Vertex snapping (polygon jitter). Grid step in INTERNAL pixels: 1 = what the PS1 did.
    jitterPixels: 1.0,
    // Affine texture warping: 0 = perspective-correct, 1 = full PS1 affine. OFF by default in the look presets
    // (it makes doors and big walls swim). When it's on, large polygons must be subdivided (subdivideMaxEdge).
    warp: 0.55,
    subdivideMaxEdge: 0.75, // metres: static triangles longer than this get split (src/render/geometry.js subdivide)
    // Colour depth + ordered dither (post pass, done in sRGB like the hardware).
    colorBits: 5, // 5 bits per channel = 15-bit colour
    dither: 1.0, // Bayer 4×4 amplitude in quantisation steps (1 = classic)
    // Textures: crisp up close, a few mip levels at distance so far surfaces don't sparkle.
    maxMipLevel: 3, // clamp: deeper levels blur atlas tiles into each other
    mipBias: 0.5, // > 0 picks blurrier (stabler) mips sooner; 0 = textbook
  },

  // ---------------------------------------------------------------- sky, fog, light rig (src/render/environment.js)
  // Colours are sRGB hex. Fog is linear near → far in metres. The sky's horizon colour IS the fog colour, so
  // silhouettes fade into the sky with no seam. indoor*: how much sun / sky reaches inside the indoor boxes, plus a
  // flat fill (nothing casts shadows, so without this a roofed room would be lit by the sun).
  lighting: {
    order: ['greybox', 'day', 'dusk', 'night'], // the dev key L cycles these
    // Phase 1: readable flat colours and distance fog (build prompt 0.2), not the final dim lighting (section 3).
    greybox: {
      fog: 0x17181c, fogNear: 3.5, fogFar: 14, skyTop: 0x17181c,
      hemiSky: 0xfff4e6, hemiGround: 0x4a4744, hemi: 1.9,
      sun: 0xdfe6f2, sunIntensity: 0.9, sunDir: [0.35, 0.8, 0.5], ambient: 0x101010, // gives the box faces different shades
      indoorSun: 1.0, indoorSky: 1.0, indoorFill: 0x000000,
    },
    day: {
      fog: 0xa9aea0, fogNear: 14, fogFar: 70, skyTop: 0x8796a3,
      hemiSky: 0xc8cfd2, hemiGround: 0x5a5440, hemi: 1.15,
      sun: 0xfff1d6, sunIntensity: 1.6, sunDir: [0.45, 0.75, 0.5], ambient: 0x202020,
      indoorSun: 0.0, indoorSky: 0.22, indoorFill: 0x5c564a,
      disc: { color: 0xfff8e8, size: 0.03, glow: 0.25 },
    },
    dusk: {
      fog: 0x4a3f40, fogNear: 4, fogFar: 26, skyTop: 0x24222f,
      hemiSky: 0x8a7470, hemiGround: 0x241c16, hemi: 0.75,
      sun: 0xff9a5a, sunIntensity: 0.9, sunDir: [-0.9, 0.18, 0.2], ambient: 0x141012,
      indoorSun: 0.0, indoorSky: 0.12, indoorFill: 0x1a1618,
      disc: { color: 0xffb070, size: 0.05, glow: 0.6 },
    },
    night: {
      fog: 0x07090c, fogNear: 2.5, fogFar: 17, skyTop: 0x020305,
      hemiSky: 0x2a3446, hemiGround: 0x050505, hemi: 0.55,
      sun: 0x6f86b0, sunIntensity: 0.18, sunDir: [0.3, 0.8, 0.4], ambient: 0x080808, // moonlight
      indoorSun: 0.0, indoorSky: 0.35, indoorFill: 0x060607,
      disc: { color: 0x9aa8c0, size: 0.022, glow: 0.12 },
    },
    indoorFade: 0.12, // metres over which "indoor" lighting blends in at an indoor box's edge (walls are ~0.2 m thick)
  },

  // ---------------------------------------------------------------- the loop (src/core/loop.js)
  loop: {
    step: 1 / 60, // fixed gameplay tick (s). Rendering interpolates between the last two ticks
    maxSteps: 6, // ticks per frame at most: after a long stall (tab hidden) the backlog is dropped, no spiral
    maxFrame: 0.1, // s: a frame longer than this counts as this long
  },

  // ---------------------------------------------------------------- the cat (src/player/player.js)
  player: {
    radius: 0.12, // collision circle radius (m)
    edgeSupport: 0.6, // share of the radius that must be over a surface to stand on it: lower = hang further off edges
    height: 0.30, // standing height of the collision span (m)
    slinkHeight: 0.2,
    eyeHeight: 0.25, // camera height at cat scale: everything looms
    slinkEyeHeight: 0.17, // the camera drops a little while slinking
    slinkTime: 0.12, // s to go down / up
    stepHeight: 0.06, // ledges up to this are walked over (door sills). Must stay small or a cat strolls onto chairs
    stepSmooth: 16, // 1/s: the eye catches up to a step at this rate
    gravity: 18, // m/s². Affects every jump: re-run the route check after changing it
    walkSpeed: 1.7, // m/s
    runSpeed: 3.6, // m/s, hold Shift. A little faster than the vac at its angriest
    slinkSpeed: 0.65, // m/s, hold C. Silent
    backwardMul: 0.85, // walking backwards is slower
    accel: 18, // 1/s: reaches 63 % of target speed in 1/accel s. Snappy
    decel: 22, // 1/s: stops faster than it starts
    airAccel: 9, // 1/s: tight air control while steering
    airDecel: 6, // 1/s: letting go of the keys mid-air brakes, so you can stop on a narrow perch
    lookRadPerPx: 0.0021, // mouselook: radians per mouse count at sensitivity 1
    pitchLimit: 1.48, // rad (~85°)
    // Head-bob: amplitude in metres per gait; sway = sideways share; roll = radians of tilt at walk amplitude.
    bob: { walk: 0.004, run: 0.008, slink: 0.002, sway: 0.5, roll: 0.003 },
    stride: { walk: 0.26, run: 0.42, slink: 0.2 }, // metres per footstep
    stepGain: { walk: 0.8, run: 1.2 }, // footstep loudness. Slink has none: it's silent
    bobLock: 3, // 1/s: how fast the bob's phase is pulled back onto the footsteps after a gait change (never jumps)
    bobGaitEase: 8, // 1/s: how fast the bob's depth eases between gaits
    unstickAfter: 0.2, // s wedged before the failsafe lifts the cat to the nearest free spot
    landDip: 0.03, // m: camera dip when landing
    landSoft: 2.2, // m/s: impacts below this make no sound at all
    landHeavy: 5.2, // m/s: impacts above this (a drop of about 0.75 m) are the heavy thud the vac can hear
  },

  // ---------------------------------------------------------------- the charged jump (src/player/player.js)
  // A full charge rises maxVy² / 2g = 0.95 m: floor to counter top. Re-run the route check after changing any of these.
  jump: {
    chargeTime: 0.75, // s to full charge. Tap = no charge. Slower = the target sweeps more gently
    stickDist: 1.1, stickInset: 0.08, // the target stays on a perch until the arc would land this far (m) past it; how far inside its edge the target is held (m)
    minVy: 3.0, maxVy: 5.85, // m/s up at no charge / full charge
    minSpeed: 1.4, maxSpeed: 3.2, // m/s forward at no charge / full charge: the charge sets the distance, not a run-up
    runCarry: 2.2, // m/s: a tap at a run keeps at most this much speed (so a run-and-tap can't clear the counter gaps)
    moveMul: 0.5, // walking speed multiplier while charging
    pounceMin: 0.15, // charge above which a jump with no keys held leaps the way you're looking
    coyote: 0.1, // s after leaving an edge you can still jump
    coyoteCharge: 0.3, // the charge you get for a fresh press during coyote time
    buffer: 0.12, // s a press before landing still counts
    airSteerMin: 1.0, // m/s: steering speed in the air on a very short hop
    dip: 0.03, dipPitch: 0.06, // the camera dips (m, rad) at full charge
    holdAtMax: 0.8, // s a full charge is held, standing still, before the jump is called off. Walking or steering never cancels it
    predictDt: 1 / 60, predictT: 1.4, // s: landing-spot prediction step (the same as the physics, so the target and the real landing agree) and horizon
    marker: { // the jump target: a ring painted onto the world around the landing spot (src/player/landing-marker.js)
      ringInner: 0.085, ringOuter: 0.135, ringFull: 1.3, ringMin: 0.45, // m; closer than ringFull m the ring shrinks, down to this share
      retractMin: 0.04, retractHold: 0.14, // m, s: a spot that moves back this far must stay back this long before the target follows
    },
    markerEase: 14, // 1/s: how fast the target glides to a new spot
    dotBelowLip: 0.04, // m: where the dot sits under an edge you'd catch
    markerColors: { land: 0xfff0c8, grab: 0x9fe6a0, wall: 0x9fb4d8 }, // landing on a surface / would catch this edge / would hit a wall
    shimmer: { color: 0xffc890, base: 0.035, amp: 0.05, freq: 2.2, speed: 1.3, fade: 7, pad: 0.006 }, // the soft glow over the target perch: strength, slow broad wave (size, speed), 1/s fade-in, m past its faces
  },

  assets: { vacuum: 'game-assets/models/shopvac.glb' }, // the one real model in Phase 1. If it fails to load, a primitive stands in

  // ---------------------------------------------------------------- Mr. Tidy (src/vacuum/)
  vac: {
    radius: 0.24, height: 0.45, // m: the body, for navigation and (later) catching the cat
    // Anger has four stages: 1 neutral (nothing broken yet), 2 annoyed (looks and sounds it, still harmless), 3 angry (hunts you), 4 furious. Arrays below are by stage.
    speed: [0.7, 0.8, 1.4, 2.4], // m/s
    turnRate: 2.4, // rad/s
    arrive: 0.14, // m from a waypoint at which he moves on
    angerAt: [1, 5, 10], // knock-overs that raise him to stages 2, 3 and 4. The first break sets him off
    hearNear: 7, // m: annoyed, he only investigates crashes this close. Angry or worse, he hears them anywhere
    hearSteps: 4, hearWalk: 1.8, // m: angry or worse, he hears a cat running or walking on the floor this close. Slinking is silent
    hearLand: [3.5, 8], quietLand: 0.25, // m he hears a landing from (soft, heavy), from the annoyed stage up; share of that if you land holding C
    sightRange: [0, 0, 6.5, 9], // m he can see the cat. Neutral and annoyed he doesn't hunt
    harmlessAt: 2, // at this stage and below, touching him does nothing
    hearSneeze: 9, // m he hears a sneeze from
    sightCos: 0.82, // cos of half his view: about 70° in all
    slinkSight: 0.5, // slinking halves how far away he notices you
    slinkNotice: 2.5, // ...and he takes this many times longer to react
    sneakAnger: 3, // at this stage or below, a crouching cat he can't see can brush right past him
    perchSight: 0.7, // he's a floor machine: a cat up on something is harder to notice
    cleanSight: 0.6, // busy with a mess, he only notices you closer: a clean is still your window
    hideLose: 0.8, // s to lose track of a slinking cat that's out of sight (otherwise loseTime)
    campTime: 6, ignoreTime: 5, // s staring at a cat above his reach before he gives up; s after that before he'll notice it again
    noticeTime: [0.7, 0.7, 0.45, 0.25], // s of being seen before he reacts: a fair moment to duck
    loseTime: 2.5, // s out of sight before he gives up the chase and searches
    searchTime: 3.2, // s he looks around where he last saw you
    searchTurn: 2.0, // rad/s while looking around
    chaseSpeed: [1.3, 1.3, 2.3, 3.1], // m/s. The cat runs at 3.6, so it can always just outrun him
    replan: 0.15, // s between re-thinking the route while chasing
    catchReach: 0.14, // m past his body at which he catches the cat
    solidShare: 0.85, // how much of the cat's radius his body keeps out: it can brush him, not go through him
    catchHeight: 0.42, // m: a cat with its feet above this is out of reach of his body
    investigateMul: 1.25, // he goes to a noise this much faster than he patrols
    cleanTime: 2.2, // s to suck up a mess: the player's window to get away or set up the next crash
    cleanSee: 1.4, // m: a mess this close, in plain sight, stops him to clean it
    cleanReach: 2.2, // m: when he arrives at a noise, a mess within this is what he cleans
    spotEvery: 0.25, // s between looking around for messes
    model: {
      scaleY: 0.45, scaleXZ: 0.58, // the model is 1 unit tall and 0.78 wide: this makes it a squat 0.45 m drum, 0.45 m across
      holeY: 0.115, holeR: 0.09, holeZ: 0.2225, // the black mouth (m): height, radius, how far forward
      faceY: 0.29, faceW: 0.26, faceH: 0.19, faceZ: 0.236, // the calm faces' plate on the dome, above the hole
      face: { // the skin the face is painted on: it follows his outline ([height, radius] in m)
        profile: [[0.0225, 0.151], [0.045, 0.194], [0.18, 0.204], [0.2025, 0.222], [0.225, 0.226], [0.236, 0.222], [0.281, 0.211], [0.326, 0.206], [0.36, 0.19]],
        lift: 0.006, arc: 3.6, y0: 0.02, y1: 0.36, pxPerM: 358, centerY: 0.15, // m off his surface; rad round him; the height range the canvas covers; canvas px per m; where the camera looks at him
      },
      stretch: [1, 1, 1.08, 1.22], holeRs: [0.09, 0.085, 0.058, 0.066], tone: [1, 0.92, 0.72, 0.5], // by stage: how tall he stands; the intake's radius; how dark his body has gone
      twitch: 0.09, listenTilt: 0.14, flickTime: 0.45, // rad of twitching at the end; rad he leans back when he stops to listen; s his face flickers when he changes
      catchDist: 0.42, // m in front of the hole where the camera ends up: close, but you see the whole of his face
      reelY: 0.2, reelZ: 0.275, // the cord reel on his back (m): height, how far behind him
      reelMax: 0.095, reelMin: 0.045, reelFlange: 0.105, // m: the coil's radius when full and when nearly paid out; the plate behind it
    },
  },
  suck: { // really close, he plants himself and sweeps the nozzle back and forth with the suction on (src/vacuum/vacuum.js)
    minAnger: 3, // from the angry stage
    enter: 1, exit: 1.3, maxY: 1.2, // m from the hole that starts it and ends it; m up, above which he goes back to the strike
    windup: 0.5, // s for the nozzle to get into position before it can catch you
    reach: 1.2, minR: 0.45, // m: the sweep passes at the cat's distance, within these
    arc: 0.9, rate: [0, 0, 2.6, 3.6], speed: 5, // rad either side of where he faces; how fast it swings, by stage; m/s the nozzle can move
    pullRadius: 0.8, pull: 0.8, // m from the nozzle that drags a cat on the ground in, and m/s at its strongest. A run beats it; a slink doesn't
  },
  // ---------------------------------------------------------------- how he thinks and what gives him away
  alert: { // he heard something: he stops dead, the motor drops, the nozzle lifts toward it
    time: [1.0, 0.9, 0.65, 0.5], cooldown: 1.8, // s he listens, by stage; s before another noise can stop him again
    dip: 0.72, rateDip: 0.22, dipEase: 9, // how far the motor falls away (share of volume, share of pitch), 1/s
    sniffOut: 0.55, sniffUp: 0.5, sniffSpeed: 2.5, // m the nozzle lifts toward the sound
    stingEvery: 4, // s between heard-you stingers
  },
  roam: { // the patrol isn't a circuit: he picks where to go next, and changes his mind
    think: [5, 11], // s between second thoughts
    pauseChance: 0.32, backChance: [0.2, 0.2, 0.3, 0.35], pause: [0.9, 2.4], // stops to look around; turns round and goes back, by stage; s
    hunchChance: [0, 0, 0.16, 0.28], // by stage: the odd hunch that takes him to the room you're in
    noiseBonus: 18, randomWeight: 16, distWeight: 0.7, // how he scores a place: age in seconds, plus somewhere noisy, a dice roll, minus m away
    noiseLasts: 40, // s a crash keeps pulling him toward its room
    lookSpeed: 1.3, // rad/s looking around
  },
  sting: { // eye contact and being spotted
    eyeCos: 0.94, cooldown: 9, freeze: 0.32, pulse: 0.6, // how squarely you must be looking at him; s between stingers; s he freezes, staring back; s the screen flinches
    shriekEvery: 16, shriekFace: 1.3, // s between shrieks; s his mouth stays open
  },
  creep: { // the hose comes for a cat hiding up high: slowly, from a long way off, with the motor nearly silent
    minAnger: 3, minHeight: 1.2, // from the angry stage, for a cat at least this high
    after: 2.0, // s of knowing where you are up there before it starts
    range: 8, length: 9, speed: 0.72, replan: 0.5, maxTime: 16, // m it can reach and stretch to; m/s; s between re-routes; s before it gives up
    motor: 0.22, // how quiet the motor goes
    floorY: 0.6, // m: a cat below this has come down, and he goes after it instead
    cooldown: [0, 0, 16, 10], // s before he tries again, by stage
  },
  fog: { // the dust cloud (src/vacuum/dust-cloud.js)
    minAnger: 4, cooldown: 28, minDist: 2.5, lostFor: 0.4, // furious only; s before he can do it again (from when the last cloud has gone); only if you're this far off, or he lost you this long ago
    wind: 1.4, recover: 0.7, // s of telegraph (planted, nozzle up, screaming); s standing still after
    radius: 4.8, grow: 1.6, hold: 8, fade: 3, density: 1.45, // m; s to fill; s at full; s to clear; how thick (per metre)
    color: 0x8a7a60, moteColor: 0xbfae8a, moteSize: 0.018, motes: 120, moteAlpha: 0.75, puffs: 14, puffSize: 2.6, puffSpeed: 1.6, puffAlpha: 0.32,
    // Fair play: he's blind in his own cloud, and slow, and the strike is much easier to dodge.
    sight: 1.5, speedMul: 0.62, strikeRangeMul: 0.6, extraWindup: 0.45, strikeCdMul: 2,
  },
  blast: { // the dust blast: he spits a glob of dirt at a cat he can see (src/vacuum/blast.js)
    minAnger: 3, cooldown: [0, 0, 8, 5], // from the angry stage; s between blasts by stage
    range: 7, minRange: 1.2, // m: how far it's aimed from
    aim: 0.6, recover: 0.5, // s of telegraph (the wheeze, the nozzle lifting), s after firing
    speed: 9, gravity: 2.5, lead: 0.5, // m/s, m/s² of droop, how much of the cat's movement it aims ahead for
    hit: 0.32, life: 3, // m from the cat that counts as a hit; s before it falls apart
    // The lob: a slow high arc that comes down on you. For a cat up high or behind something, and now and then anyway.
    lobAbove: 0.55, lobChance: 0.3, lobGravity: 9, lobApex: 0.75, lobCeiling: 0.25, lobAimOut: 0.35, lobAimUp: 0.8, splash: 0.42, // m cat height it's always a lob from; the chance otherwise; m/s²; m above the higher end its arc peaks; m kept under the ceiling; where the nozzle aims from; m round where it lands that still hits you
    knockRadius: 0.2, knockSpeed: 2.2, // an object it hits gets shoved (which can knock it off: that still counts for you)
    aimOut: 0.7, aimUp: 0.35, // m: where the nozzle lifts to, to aim
    cubes: 8, cubeSize: 0.05, spread: 0.08, color: 0x7d7360, puffTime: 0.4, puffSize: 0.35,
  },
  dust: { // what a dust blast does to the cat (src/player/player.js): it bowls you over, then you stagger
    tumble: 0.8, knock: 2.6, knockUp: 2.4, // s you've no control; m/s it throws you along the shot, and up (enough to come off a shelf)
    roll: 1.3, pitch: 0.55, drop: 0.13, // the view: rad it rolls, rad it tips, m it falls toward the floor
    time: 3.4, speedMul: 0.55, weave: 0.55, weaveRate: 4.6, lean: 0.08, // dazed: s; how much it slows you; rad your steering wanders; rad/s; rad the view hangs off level
    sneezeDelay: 1.6, sneezeDip: 0.05, // s until the sneeze; m the camera jolts
  },
  hose: { // the snake out of the hole (src/vacuum/hose.js, src/vacuum/voxels.js)
    minLength: 1.6, // m: the hose is never shorter than this. When the tip is close, the excess hangs and bows aside like a chain
    slackPull: 0.02, damping: 0.92, sag: 6, aside: 14, chainPasses: 6, // the chain: how much a slack hose keeps to its route, how fast swinging dies down, m/s² of droop, of bowing sideways; how stiffly the links hold
    length: 3.8, segments: 22, radius: 0.028, tubeSegments: 56, tubeSides: 6, // m it can stretch to; points along it; m; how smooth the tube is
    color: 0x0c0c0e, nozzleColor: 0x8a8a90, nozzleR: 0.04, nozzleLen: 0.12,
    restReach: 0.7, follow: 14, floorY: 0.05, // m in front of him that the nozzle rests; how fast it catches up
    track: 34, trailStep: 0.06, // 1/s: how fast the body settles onto its trail; m between trail points
    cell: 0.12, clearance: 0.03, searchLimit: 20000, // the 3D grid: m per cell, m kept clear of surfaces, the most cells one search may look at
    replan: 0.2, arch: 0.3, arcPoints: 8, // s between re-thinking its route; how far under the tip it comes up from; points on that curve
    retractSpeed: 7, // m/s reeling back in
    reachH: 2.2, reachTop: 1.8, // m: how far out from the hole, and how high a cat it will go for. Above reachTop is safe
    minPerch: 0.3, // m: a cat higher than this counts as perched: harder to spot, and he parks near it
    standoff: 1.1, // m: how close to a perched cat he tries to park
    minAnger: 3, // he only uses the hose once he's angry
    cooldown: [0, 0, 5, 2.5], // s between attacks
    windup: 1.0, // s of prep: the hose rises and hovers, sniffing, with the rattle playing
    rear: 0.45, rearMin: 0.8, // the cobra: m above the cat it rears up to, and never lower than this off the floor
    hover: 0.9, sway: 0.08, swayRate: 7, riseSpeed: 3, // m short of the cat that it waits; m it sways; rad/s; m/s rising
    homeSpeed: 5.5, homeTurn: 1.8, homeTime: 0.5, homeReplan: 0.08, // the charge: m/s; rad/s it can turn (lower = easier to dodge); s before it runs out; s between re-aiming around obstacles
    hit: 0.2, // m from the cat's chest that counts as caught
    giveUp: 0.3, // m past its range that the cat can be when the prep ends before he doesn't bother
    slapRadius: 0.5, slapSpeed: 2.2, // m around the tip that a missed charge knocks things; m/s
    stall: 1.0, // s he stands there after a miss
    cleanSpeed: 3, cleanTimeout: 2.0, // m/s the nozzle goes out to a mess; s he'll wait for it to get there before he just starts
  },
  catch: { // the catch: the most important moment in the game (src/vacuum/catch.js)
    // The ride: you're reeled across the floor along a route of its own that keeps the camera out of everything.
    rideSpeed: 1.9, rideMin: 1.1, rideMax: 2.4, // m/s on average; shortest and longest it can take (s)
    clearance: 0.12, minY: 0.12, // m the camera keeps from every surface (more than the near plane reaches); m it stays above the floor
    smooth: 4, step: 0.04, // the route is resampled every step m and averaged over this many samples either way, to round its corners
    lookEase: 5, // 1/s how fast the view comes round to him. It looks at him the whole way: steady, however the route bends
    hoseGap: 0.6, // m the end of the hose stays ahead of you as it reels in: never around the camera
    turn: 0.16, // s to turn and face him at the end of it
    hold: 1.2, // s held on his face
    faceJitter: 0.0008, // m his face trembles
    beat: 0.8, // s of black silence before the restart screen
    screamRate: 2.3, screamGain: 1.4, screamRamp: 0.9, // the motor at the end: pitch, loudness, s to get there
  },
  drone: { // the motor. The player must be able to find him by ear (src/vacuum/vacuum.js)
    closeness: 2.2, // m: at this distance the drone is at half volume. Smaller: it rises more steeply as he nears
    floor: 0.05, // the quietest it ever gets, anywhere in the house, so he can always be heard
    gain: 1, // overall level
    rate: [0.9, 0.98, 1.12, 1.32], // pitch by anger stage
    nearRate: 0.08, // extra pitch right next to you
    update: 0.08, // s between adjustments
    windDown: 1.2, // s for the motor to die when Grandma wakes
  },
  cord: { // the power cord: one outlet, by Grandma's door, and a fixed length (src/vacuum/cord.js)
    length: 24, // m. Every room is in reach, but not by every route: when he'd run out he goes back the way he came
    spacing: 0.2, capacity: 420, round: 0.6, roundTight: 0.14, roundSteps: 8, wander: 0.05, wanderRate: 1.7, // (the last five: m it curves round a waypoint, and round a tight spot off the graph; points per curve; m it drifts off a straight line; how fast)
    // m between points on the tube; the most points it can have
    radius: 0.009, y: 0.012, slack: 0.018, // m: thickness, height off the floor, how much it wanders
    color: 0x2a2a2c, plugColor: 0x141414,
    // Swipe the outlet he's plugged into: the cord whips back, he's dead for a moment, then he plugs into the nearest outlet.
    retract: 1.0, off: 5.0, extend: 1.2, // s: the cord reeling back, powered off, the cord going out to the new outlet
    unplugAnger: 3, // the anger stage unplugging him leaves him at, up or down
    lock: 18, // s after plugging back in before that outlet can be hit again (so nobody can stand there and keep him off forever)
  },

  // ---------------------------------------------------------------- Grandma and the win (src/world/grandma.js)
  grandma: {
    gain: 0.85, // scales every crash. The main "how long is a run" number: aim for 10–14 knock-overs on average
    farScale: 0.6, nearScale: 1.5, // what a crash is worth far from her door / right at it
    range: 17, // m from the door at which a crash counts as far
    thresholds: [25, 50, 75], // wake values where the snoring lightens and a cue plays
    crossfade: 1.0, // s between snoring stages
    winBeat: 1.4, // s from her waking to the Good Kitty screen
    soundBehind: 0.6, // m behind the door the snoring comes from (the wall muffles it)
    refDistance: 4, rolloff: 0.8, // how her cues carry through the house
    snoreNear: 2, snoreFar: 7, // m from the door: full snoring within snoreNear, silent beyond snoreFar
    labelNear: 2.2, // m from the door at which "Grandma's room" shows on screen
  },

  // ---------------------------------------------------------------- the dash (src/player/player.js)
  dash: {
    time: 0.15, speed: 6.2, // s, m/s: about 0.9 m. Gravity is off for its duration
    exitSpeed: 2.6, // m/s carried out of an air dash
    cooldown: 0.55, // s between dashes. Air only, once until you touch something
    fovKick: 7, fovEase: 14, // degrees wider during a dash, 1/s
  },

  // ---------------------------------------------------------------- ledge grab and mantle (src/player/player.js)
  ledge: {
    paw: 0.25, // m: how far above the feet the cat's front is
    reach: 0.25, // m: the edge is caught if it's within this above the cat's front (build prompt 0.4)
    minAbove: 0.1, // m: an edge closer to the feet than this you simply land on
    gap: 0.07, // m: how far from the face the cat's body can be and still catch it
    maxVy: 1.4, // m/s: rising faster than this, the cat is going to clear the edge anyway: don't catch it
    facing: 0.3, // cos: how squarely the view (or the keys) must face the edge
    dropLock: 0.22, // s after walking off an edge before it can grab (so a drop doesn't snag the ledge you just left)
    letGoLock: 0.35, // s after letting go before it can grab again
    hangDrop: 0.34, // m: feet below the edge while hanging: the eye is under the lip, looking up at the paws
    hangDip: -0.16, // rad: the view tips up toward the edge (negative = up)
    yawLimit: 1.57, pitchMin: -0.9, pitchMax: 0.9, // rad: how far you can look around while hanging (left/right of the ledge, down, up)
    lookSettle: 10, // 1/s: how fast the view eases inside those limits when you catch the edge
    settle: 30, // 1/s: how fast the body settles into the hanging pose
    mantleTime: 0.4, // s: the pull-up
    shimmySpeed: 0.5, // m/s along a ledge with A / D or the arrow keys
    shimmyEnd: 0.06, // m from the end of an edge where the cat goes round the corner (or stops, if it can't)
    inward: [0.16, 0.12, 0.08, 0.04], // m past the lip to end up, tried in order (narrow perches take the shorter ones)
  },
  // ---------------------------------------------------------------- claw climbing and stamina
  climb: {
    speed: 0.9, // m/s up or down a striped face
    strafe: 0.45, // m/s sideways along it
    contact: 0.05, // m: how close to the face counts as touching it
    facing: 0.6, // cos: how squarely the keys must push into the face
    airFacing: 0.3, // cos: in mid-air you cling just by flying at a face while looking at it, no keys needed
    topOff: 0.2, // m: this far below the top, the cat pulls itself over
    slideSpeed: 0.9, // m/s down when stamina runs out. Controlled, no damage
    kickVy: 3.6, kickSpeed: 2.6, // m/s: a tapped kick-off (up, away)
    springVy: 5.85, springSpeed: 3.2, // m/s: a fully charged spring off the wall (hold Space while clinging)
    kickLock: 0.3, // s after a kick-off before the claws can catch stripes again
    outKick: 0.5, // when kicking sideways: how much of the leap also goes out from the wall
  },
  stamina: {
    climbDrain: 0.3, // per second moving on a climbable face (1 = the full bar: about 3.3 s, 3 m)
    hangDrain: 0.22, // per second hanging on a ledge: a full bar is about 4.5 s
    clingDrain: 0.1, // per second clinging still to a climbable face
    shimmyDrain: 0.12, // extra per second moving along a ledge
    kickCost: 0.1, // per kick-off
    springCost: 0.1, // extra for a fully charged spring
    regen: 1.6, // per second while standing on any flat surface
    barWidth: 100, barBottom: 12, // HUD px
    barHold: 0.5, // s the bar stays after refilling
  },
  // ---------------------------------------------------------------- the swipe and knockable physics (src/world/knockables.js)
  swipe: {
    reach: 0.55, // m from the eye to an object's centre
    cone: 0.68, // cos of the half-angle: how far off-centre an object can be and still get hit
    time: 0.3, // s: the whole swipe animation
    impactAt: 0.09, // s into the swipe when objects get hit
    cooldown: 0.32, // s between swipes
    impulse: 0.6, // shove strength: speed = impulse / mass. Light things fly, heavy things inch
    maxSpeed: 3.2, // m/s: a cap, so a very light thing doesn't launch across the house
    sideBias: 0.18, // how much the shove also goes the way the paw sweeps (to the left)
  },
  knock: {
    friction: 3.2, // m/s² of sliding slowdown. Higher: objects stop sooner, more swipes to reach an edge
    stopSpeed: 0.03, // m/s: slower than this and it's at rest
    supportR: 0.01, // m: an object is supported if its centre is over a surface. This is the "centre passes the edge" test
    wallBounce: 0.3, objBounce: 0.3, // how much speed survives hitting a wall / another object
    gravity: 18, // m/s²
    tipTime: 0.12, tipRate: 5, tipSpeed: 0.45, tipGravity: 0.45, // tipping over an edge: s, rad/s, m/s minimum outward, share of gravity
    spin: 14, // rad/s of random tumble as it falls
    toppleSpeed: 0.5, // m/s: a shove at least this hard knocks over something standing on the floor
    bounce: 0.3, bounceMin: 1.2, bounceKeep: 0.55, // first-hit bounce: share of impact speed, least impact to bounce, share of sideways speed kept
  },
  // shape, size (m), mass (only the ratio to swipe.impulse matters), breakable, noise (points toward waking Grandma, scaled
  // by distance to her door in step 9), cubes (min, max when it breaks), decal (the mess square's colour and size in m).
  // topple: stands on the floor, and a swipe knocks it over where it stands.
  knockTypes: {
    mug: { shape: 'cyl', r: 0.042, h: 0.095, mass: 0.2, breakable: true, noise: 8, cubes: [3, 4], decal: 0xbfb5a0, decalSize: 0.22 },
    plate: { shape: 'cyl', r: 0.1, h: 0.025, mass: 0.25, breakable: true, noise: 11, cubes: [4, 6], decal: 0xd6d0c2, decalSize: 0.28 },
    vase: { shape: 'cyl', r: 0.06, h: 0.24, mass: 0.55, breakable: true, noise: 11, cubes: [4, 6], decal: 0x9fb2c0, decalSize: 0.3 },
    jar: { shape: 'cyl', r: 0.05, h: 0.12, mass: 0.42, breakable: true, noise: 10, cubes: [4, 6], decal: 0xa8b878, decalSize: 0.26 },
    book: { shape: 'box', w: 0.16, h: 0.04, d: 0.22, mass: 0.9, breakable: false, noise: 5, decal: 0x7a6a55, decalSize: 0.18 },
    yarn: { shape: 'sphere', r: 0.06, h: 0.12, mass: 0.12, breakable: false, noise: 3, decal: 0xb07a90, decalSize: 0.14 },
    floorVase: { shape: 'cyl', r: 0.1, h: 0.46, mass: 0.7, breakable: true, topple: true, noise: 12, cubes: [5, 6], decal: 0x8fa08f, decalSize: 0.36 },
  },
  debris: {
    cubeSize: [0.02, 0.04], // m: the small cubes a broken thing turns into
    speed: [0.5, 1.6], up: [0.8, 2.0], // m/s: how they scatter
    bounce: 0.35, bounces: 3, // share of speed kept per bounce; how many before they stop
    startY: 0.06, // m above the floor they burst from
    maxCubes: 160, maxDecals: 40,
    decalY: 0.004, decalStep: 0.0004, // m off the floor; extra lift per decal so overlaps never z-fight
  },
  paws: {
    color: 0xa89a88, glow: 0x2a241e, // a little light of its own, so an underside isn't black
    // The swipe: the same paw as the hanging one. It only exists while you're swiping: it rises into view, sweeps, drops away.
    swipeStartX: 0.12, swipeEndX: -0.1, swipeHiddenY: -0.2, swipeY: -0.045, swipeZ: -0.2, // camera space, m
    swipeLift: 0.03, swipeReach: 0.05, // m: the arc up and forward
    swipeYaw0: 0.5, swipeYaw1: -0.6, swipeRoll0: -0.2, swipeRoll1: 0.2, // rad: how the paw turns through the sweep
    swipeLeg: 1.32, swipeLegLen: 2.6, // the forearm, as when hanging
    swipeOut: 0.42, reveal: 0.2, // share of the swipe spent going out; share spent rising into view (and dropping away)
    hangDist: 0.13, hangFollow: 0.3, hangNarrow: 0.55, hangTurn: 0.45, hangMargin: 0.03, // as you look along the ledge: eye-to-edge distance (m), how far the paws shift along it (m), how much closer together they get, how far they turn with the view, m kept from the ledge's end
    keepEdge: 0.9, keepNear: 0.07, // if one paw leaves the frame the pair moves back in: screen edge share, least distance in front of the eye (m)
    climbSpread: 0.06, climbUp: 0.03, climbReach: 0.03, climbStride: 0.2, climbLeg: -0.55, climbIn: 0.008, // on a climbable face: m apart from centre, m above the eye, m each paw reaches up and down, m climbed per pair of steps, rad the forearm comes back from the wall, m off the wall
    hangSpread: 0.055, hangIn: 0.03, hangLift: 0.014, hangLeg: 1.32, hangLegLen: 2.6, // on the lip: m apart from centre, m past the edge, m above the top, rad the forearm drops below it, forearm length multiplier (reaches off the bottom of the view)
    tremble: 0.0035, trembleRate: 46, trembleAt: 0.4, // m, rad/s: the hanging paws shake as stamina gets low, starting at this share of the bar
    shimmyStep: 0.03, shimmyLift: 0.012, shimmyStride: 0.22, // moving along a ledge: m each paw leads and trails, m it lifts, m travelled per pair of steps
    climbSideReach: 0.025, climbSideEase: 12, // climbing sideways: m each paw leads and trails, 1/s easing in and out
    drop: 0.08, ease: 18, // m below the lip as it appears, 1/s ease in and out
  },

  debug: {
    noclipSpeed: 3, // m/s (F3); Shift triples it
    thirdPersonDist: 1.3, // m behind the cat (F2)
  },

  // Surfaces: footstep sound family (foot.<sound> in the sound bank; defaults to the surface's own name),
  // speed multiplier, loudness multiplier. Tag colliders and ground regions with these names.
  surfaces: {
    carpet: { speed: 1.0 },
    lino: { speed: 1.0 },
    wood: { speed: 1.0 },
  },

  hud: {
    wakeIcon: false, // the small sleeping-face icon. Off for now
    lines: 240, // the HUD's own pixel grid (lines), whatever the render resolution: the pixel font stays one size
  },
  subtitles: { seconds: 3.2, maxLines: 3 }, // how long a caption stays; how many stack

  // ---------------------------------------------------------------- audio (src/audio/audio.js)
  audio: {
    sampleRate: 22050, // placeholder sounds are generated at this rate: the 22 kHz lo-fi feel
    master: 0.9,
    buses: { sfx: 1.0, ambience: 0.7, voice: 1.0 },
    // Positional rolloff (PannerNode, HRTF). inverse model: gain = ref / (ref + rolloff·(d − ref))
    refDistance: 1.5, rolloff: 1.1, maxDistance: 80,
    // Occlusion: a ray from listener to source counts occluding colliders. Per wall count: low-pass Hz and gain.
    occlusion: { hz: [20000, 1400, 650], gain: [1, 0.5, 0.3], update: 0.1, smooth: 0.12 },
    // Reverb: generated impulse responses, chosen by where the SOURCE is (inside an indoor box or not).
    reverb: { indoor: { seconds: 0.7, decay: 3.2, wet: 0.38, tone: 2600 }, outdoor: { seconds: 0.35, decay: 6, wet: 0.08, tone: 5000 } },
    indoorBedHz: 700, // the ambience bed (wind) heard through the walls while you're indoors (fixed low-pass)
    indoorBedLevel: 0.35, // level of that muffled copy
    indoorFade: 0.7, // s to crossfade outside ⇄ inside bed
    duck: { gain: 0.32, attack: 0.25, release: 0.9 }, // ambience dips under voices (pushDuck / popDuck)
  },

  // ---------------------------------------------------------------- the house (src/world/house.js)
  house: {
    colors: { // the readable grey-box code (build prompt 0.2). Room floors and walls are in src/data/level.js
      landTop: 0xc98a4a, // the top of anything you can land on
      furniture: 0x8a857c, // sides of furniture
      ceiling: 0x77777c, ceilingLine: 0x3c3c42, ceilingGlow: 0.55, // the ceiling: tile colour, tile lines, how much it lights itself (nothing shines on it from below)
      wallTop: 0x3a3a3e, outside: 0x202024,
      knockable: 0xece6d8, // anything you can knock over
      climb: '#8b9a90', climbDark: '#737f77', // every climbable surface, whatever it is, is this: quiet grey-green lines
      grandmaDoor: 0x7a1414, doorStrip: 0xc89a5a, doorStripWake: 0xfff4d8, outlet: 0xb8b4a8,
    },
    preset: 'greybox', // starting light preset
    spawn: { x: 2.2, y: 0, z: 1.6, yaw: 0.78 }, // feet position (m), facing (rad, 0 = toward -z): at the cat tree
    titleCamera: { x: 3.0, y: 0.25, z: 4.2, yaw: 0.5, pitch: 0.12, sway: 0.01 }, // the title screen's slow view
  },
};
