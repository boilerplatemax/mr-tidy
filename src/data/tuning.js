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
    blackout: { // the power's gone (stage 5)
      fog: 0x050608, fogNear: 1.6, fogFar: 11, skyTop: 0x040507,
      hemiSky: 0x34405e, hemiGround: 0x0c0c0f, hemi: 0.44,
      sun: 0x5a70a0, sunIntensity: 0.08, sunDir: [0.3, 0.8, 0.4], ambient: 0x0b0b10,
      indoorSun: 1.0, indoorSky: 1.0, indoorFill: 0x000000,
    },
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

  curb: { x: 40, z: 0, camY: 0.32, from: 3.2, to: 1.05, push: 7.5, eyes: [[8.6, 8.85], [9.2, 9.6]], length: 10.4, lamp: 14 }, // the secret ending, out the front: where; the camera's height and how it creeps in (m, s); when his eyes come on (s); how long it lasts; the streetlamp
  bonus: { anger: 1 }, // each of his spare parts you break: knock-overs added toward his anger (they never wake Grandma)
  tail: { scale: 1.9, tilt: -1.0, x: 0.72, z: -0.24, hidden: -0.6, shown: -0.2, lean: 0, from: 3.4, full: 6, rise: 9, fall: 6 }, // the tail-peek experiment: size; how it's tipped toward the view; m out to the side (far enough that even its swish stays in the outer quarter of the view) and ahead; how far below the view it hides and how high it comes; rad it leans in; rad/s of turning where it starts showing and where it's all there; 1/s in and out
  tutorial: { gateHeight: 1.25, zoomFov: 30, tvDist: 1.0, moveFor: 1.2, turn: 1.3, // (zoomFov: degrees the view narrows to while you watch, from tvDist m square in front of the screen)
    arriveAfter: 3, show: 17, egg: 7.5, upAt: 1.45, // m to walk; s the view turns to the TV; s after the last prompt that he turns up; s the programme runs; s the cartoon the aerial brings in runs; m up that counts as "up by the remote", however you got there
    gates: { fall: 0.6, lie: 1.4 }, // once they're over: s to fall; s lying there before they flicker out (TUNING.flicker)
    lamp: { power: 2.6, dist: 5.5, color: 0xffc888 } }, // the living-room floor lamp, on until you pull its plug: its light (it goes with the power, too)
  flicker: [0.12, 0.1, 0.12, 0.1, 0.1, 0.08, 0.1, 0.08], // s: how a big thing vanishes: shown, hidden, shown, hidden, gone (the pet gates; big pieces he cleans up)
  // ---------------------------------------------------------------- the ending (src/world/ending.js)
  ending: {
    cut: 1.1, fadeIn: 0.6, idle: 0.7, turn: 0.5, pull: 0.15, grip: 0.02, toVac: 1.05, die: 0.45, after: 4.6, fadeOut: 1.2, // s: the fade from the house; up into her room; she stands a moment; turns to the wall; into the yank when the plug comes out, and when it's in her hand; then the cut to him; how long he keeps going on screen; from then until it's over; the fade at the end
    wordsAfter: 1.2, lightsAfter: 0.6, lightsBack: 1.6, // s after he dies: her line; the lights coming back on (if they were out)
    // She's staged in the house, at whichever outlet his plug is in. walkSpeed: m/s she shuffles at. standOff / handSide: m
    // off the wall and to one side she stands, so her (left) hand is at the outlet and her head stays clear of the wall as
    // she bends. clearance: m of room she needs. startFrom: [m back into the room, m to her left] she tries coming in from.
    // camTries: [m back, m to the left, m up] the camera tries, looking at lookY m up between her and the outlet; camIn /
    // camDrop: how far it eases in (share) and down (m). drop: s after the pull she lets the plug fall. lamp: the light she's put on
    walkSpeed: 0.5, standOff: 0.62, handSide: 0.12, clearance: 0.24,
    startFrom: [[1.2, 0], [1.0, 0.5], [1.0, -0.5], [0.8, 0.8], [0.8, -0.8], [0.6, 0], [0.2, 0.9], [0.2, -0.9]],
    camTries: [[2.3, 1.1, 1.35], [2.3, -1.1, 1.35], [1.9, 0.8, 1.3], [1.9, -0.8, 1.3], [1.5, 0.6, 1.25], [1.5, -0.6, 1.25], [2.6, 0, 1.4], [0.35, 2.2, 1.35], [0.35, -2.2, 1.35], [0.3, 1.6, 1.3], [0.3, -1.6, 1.3], [0.95, 2.1, 1.3], [0.95, -2.1, 1.3], [0.9, 1.6, 1.25], [0.9, -1.6, 1.25], [1.2, 0, 1.2]], // (the short, sideways ones are for a narrow hallway)
    lookY: 0.7, camIn: 0.22, camDrop: 0.3, drop: 0.45, lamp: 3.2, lightColor: 0xffc27a,
    vacDist: [1.15, 0.9, 0.7], vacUp: 0.08, push: 0.18, sink: [0.16, 0.08], vacAngles: [0.45, -0.45, 0.8, -0.8, 0.15, -0.15, 1.2, -1.2], // rad off his heading the camera tries, in order. sink: m the camera and where it looks drop as he slumps (to keep his dead face in view) // m: how far in front of him the camera can stand (it tries the first, then closer); above his face; how far it creeps in
  },
  assets: { tail: 'game-assets/models/cat_tail.glb', grandma: 'game-assets/models/grandma.glb', forelegs: 'game-assets/models/cat_forelegs.glb', vacuum: 'game-assets/models/shopvac.glb', knockables: 'game-assets/models/knockables_v2.glb', marmalade: 'game-assets/textures/portraits/portrait_10_marmalade.png' }, // if the vac fails to load, a primitive stands in. marmalade: a picture of her for the end screens (e.g. 'game-assets/textures/portraits/portrait_marmalade.png'); null draws her

  // ---------------------------------------------------------------- Mr. Tidy (src/vacuum/)
  vac: {
    radius: 0.24, height: 0.45, // m: the body, for navigation and (later) catching the cat
    // Anger has four stages: 1 neutral (nothing broken yet), 2 annoyed (looks and sounds it, still harmless), 3 angry (hunts you), 4 furious. Arrays below are by stage.
    speed: [0.9, 1.1, 1.6, 2.5, 2.8], // m/s
    turnRate: 2.4, // rad/s
    arrive: 0.14, // m from a waypoint at which he moves on
    angerAt: [3, 5, 13, 21], // knock-overs (since he last calmed down) that raise him to stages 2, 3, 4 and 5: angry (hunting) on the 5th
    // Calming down: from stages 2–4 (never once the power's gone), with every mess found and nothing seen of the cat for
    // calmTime s, he cheers up again (stage 1). Each time, angerAt is scaled by calmEase (quicker to tick off) and calmTime
    // by calmLonger (he stays angry for longer); calmFrom: stages it can happen from
    calmTime: 45, calmEase: 0.7, calmLonger: 1.6, calmFrom: [2, 3], // (rare, and never once he is furious)
    rushSpeed: 3.0, // m/s he hurries to the very first mess of the night
    streakWindow: 14, streakBoost: 0.3, streakMax: 2.2, // knock-overs this many s apart are a rampage: each one after the first sends him that much faster to it (share of his speed), up to this many times as fast, and from 3 in a row he hears them from anywhere
    trackGrace: 1.1, // s after losing sight of you in a chase he still knows where you went
    searchRounds: [0, 0, 1, 2, 2], searchGuess: 1.6, // by stage: how many more places he tries after the first look round; m his guess at where you went is off by
    hearNear: 7, // m: cheerful or annoyed, he only investigates crashes this close. Angry or worse, he hears them anywhere
    hearSteps: 5.5, hearWalk: 2.6, // m: angry or worse, he hears a cat running or walking on the floor this close. Slinking is silent
    hearLand: [3.5, 8], quietLand: 0.25, // m he hears a landing from (soft, heavy), from the annoyed stage up; share of that if you land holding C
    sightRange: [0, 0, 6.5, 10, 11], // m he can see the cat. Neutral and annoyed he doesn't hunt
    harmlessAt: 2, // at this stage and below, touching him does nothing
    hearSneeze: 9, // m he hears a sneeze from
    hearPiano: [4, 11], // m he hears the piano from: walked on, landed on
    sightCos: 0.82, // cos of half his view: about 70° in all
    slinkSight: 0.5, // slinking halves how far away he notices you
    slinkNotice: 2.5, // ...and he takes this many times longer to react
    sneakAnger: 3, // at this stage or below, a crouching cat he can't see can brush right past him
    perchSight: 0.7, // he's a floor machine: a cat up on something is harder to notice
    cleanSight: 0.9, // busy with a mess, he only notices you closer: a clean is still your window
    hideLose: 1.7, // s to lose track of a slinking cat that's out of sight (otherwise loseTime)
    campTime: 10, ignoreTime: 4, // s staring at a cat above his reach before he gives up; s after that before he'll notice it again
    noticeTime: [0.7, 0.7, 0.35, 0.2, 0.15], // s of being seen before he reacts: a fair moment to duck
    loseTime: 4.5, // s out of sight before he gives up the chase and searches
    searchTime: 4.5, // s he looks around where he last saw you
    searchTurn: 2.0, searchArc: 1.1, // how fast he looks around; rad either side
    chaseSpeed: [1.3, 1.3, 2.9, 3.35, 3.5], // m/s. The cat runs at 3.6, so it can always just outrun him (only just)
    replan: 0.15, // s between re-thinking the route while chasing
    catchReach: 0.26, // m past his body at which he catches the cat
    solidShare: 0.85, // how much of the cat's radius his body keeps out: it can brush him, not go through him
    catchHeight: 0.42, // m: a cat with its feet above this is out of reach of his body
    investigateMul: 1.25, // he goes to a noise this much faster than he patrols
    cleanTime: 2.2, // s to suck up a mess: the player's window to get away or set up the next crash
    cleanTouch: 0.12, cleanCircle: 0.06, // m: the nozzle's tip must be this close to the mess before any of it goes; m it circles over it while it sucks
    vanishAt: 0.13, // m: a piece bigger than this doesn't go up the hose: it flickers twice and is gone (src/world/debris.js)
    cleanSee: 1.4, // m: a mess this close, in plain sight, stops him to clean it
    cleanReach: 2.2, // m: when he arrives at a noise, a mess within this is what he cleans
    spotEvery: 0.25, // s between looking around for messes
    model: {
      scaleY: 0.45, scaleXZ: 0.58, // the model is 1 unit tall and 0.78 wide: this makes it a squat 0.45 m drum, 0.45 m across
      holeY: 0.115, holeR: 0.036, holeZ: 0.2225, // the black mouth (m): height, radius, how far forward
      face: { // the skin the face is painted on: it follows his outline ([height, radius] in m)
        profile: [[0.0225, 0.151], [0.045, 0.194], [0.18, 0.204], [0.2025, 0.222], [0.225, 0.226], [0.236, 0.222], [0.281, 0.211], [0.326, 0.206], [0.36, 0.19]],
        lift: 0.006, arc: 3.6, y0: 0.02, y1: 0.36, pxPerM: 358, centerY: 0.15, // m off his surface; rad round him; the height range the canvas covers; canvas px per m; where the camera looks at him
      },
      stretch: [1, 1, 1.08, 1.22, 1.3], holeRs: [0.036, 0.036, 0.036, 0.036, 0.036], tone: [1, 0.92, 0.72, 0.5, 0.34], // by stage: how tall he stands; the intake's radius; how dark his body has gone
      twitch: 0.09, listenTilt: 0.14, flickTime: 0.45, // rad of twitching at the end; rad he leans back when he stops to listen; s his face flickers when he changes
      mawNose: { lift: 0.03, r: 0.028, ease: 14 }, // stage 5's toothed maw: m the nose hole (and the hose with it) rises above its usual height, its radius, 1/s it eases there
      bodyR: 0.24, // m: the drum's radius, which no part of his hose is ever drawn inside
      catchDist: 0.42, // m in front of the hole where the camera ends up: close, but you see the whole of his face
      reelY: 0.2, reelZ: 0.275, // the cord reel on his back (m): height, how far behind him
      reelMax: 0.095, reelMin: 0.045, reelFlange: 0.105, // m: the coil's radius when full and when nearly paid out; the plate behind it
    },
  },
  suck: { // really close, he plants himself and sweeps the nozzle back and forth with the suction on (src/vacuum/vacuum.js)
    minAnger: 3, // from the angry stage
    enter: 1, exit: 1.3, enterY: 0.3, maxY: 0.6, // m from the hole that starts it and ends it; m up it starts for (the floor), and the most it keeps going for (a jump clears it): higher, the creeping hose takes over
    windup: 0.5, // s for the nozzle to get into position before it can catch you
    reach: 1.2, minR: 0.45, // m: the sweep passes at the cat's distance, within these
    arc: 0.9, rate: [0, 0, 2.6, 3.6, 4], speed: 5, // rad either side of where he faces; how fast it swings, by stage; m/s the nozzle can move
    pullRadius: 0.95, pull: 1.15, // m from the nozzle that drags a cat on the ground in, and m/s at its strongest. A run beats it; a slink doesn't
  },
  // ---------------------------------------------------------------- how he thinks and what gives him away
  alert: { // he heard something: he stops dead, the motor drops, the nozzle lifts toward it
    time: [1.0, 0.9, 0.65, 0.5, 0.4], cooldown: 1.8, // s he listens, by stage; s before another noise can stop him again
    dip: 0.72, rateDip: 0.22, dipEase: 9, // how far the motor falls away (share of volume, share of pitch), 1/s
    sniffOut: 0.55, sniffUp: 0.5, sniffSpeed: 2.5, // m the nozzle lifts toward the sound
    stingEvery: 16, // s between heard-you stingers
  },
  roam: { // the patrol isn't a circuit: he picks where to go next, and changes his mind
    think: [4, 8], // s between second thoughts
    pauseChance: 0.32, backChance: [0.2, 0.2, 0.3, 0.35, 0.4], pause: [0.9, 2.4], // stops to look around; turns round and goes back, by stage; s
    hunchChance: [0, 0, 0.3, 0.45, 0.6], // by stage: the odd hunch that takes him to the room you're in
    noiseBonus: 18, randomWeight: 16, distWeight: 0.7, // how he scores a place: age in seconds, plus somewhere noisy, a dice roll, minus m away
    noiseLasts: 40, // s a crash keeps pulling him toward its room
    lookSpeed: 1.3, // rad/s looking around
  },
  // stage 5: s he stands there pulling the power out of the house; s the lights stutter; the little light the cat sees by; arcs around him.
  // The cut (src/vacuum/closeup.js): s on the outlet as the power runs out of it along his cord; s on him, crackling; the
  // sparks' speed along the cord (m/s), how many, their colour; s the electricity stays on him after the cut
  surge: { time: 3.4, flickerUntil: 2.6, eyeLight: 0.7, eyeDist: 2.6, arcs: 9, cutOutlet: 1.3, cutVac: 1.6, sparkSpeed: 7, cordArcs: 110, cordDensity: 0.55, sparkColor: 0xbfe0ff, arcAfter: 0.5, stutterEvery: [4, 11], // stutterEvery: s between each blackout light's little stutters
    bulbs: [[5, 2.85, -0.7], [8.4, 2.85, 2.7], [3, 2.85, -4]], bulbColor: 0xffd49a, bulbPower: 2.4, bulbDist: 6.5 }, // the failing ceiling bulbs in the blackout (hallway, kitchen, dining room): where, colour, strength at full, m they reach
  voice: { every: 7, hear: 11, huffEvery: 10, huff: 1.1, turn: 3.4, turnFace: 0.75, pokeEvery: 2.5, shhEvery: 6, searchEvery: 5, quietStart: 4 }, // (quietStart: s at the start of a run before he says anything) // s between lines; m away you can make him out; s between huffs (stage 2); s a huff takes; s the change to angry takes; s into it his face goes and he says it; s between lines when you bat him; s between his shushes; s between his calls while he searches
  closeup: { dist: [0.78, 0.62, 0.5], up: 0.05, fov: 52, glideIn: 0.45, glideOut: 0.5, near: 4.5, push: 0.12 }, // "...that's enough.": m from his face the camera tries; m above it; degrees the view narrows to; s gliding in and back (when you're near enough to see him: otherwise a cut); m it creeps in
  stalk: { chance: 0.35, speed: 0.45, dip: 0.8 }, // from angry: how often he creeps up instead of coming (always in his dust); how slow; how quiet
  eat: { inflate: 1.6, wide: 1.28, into: 0.13, chomps: [0.45, 0.75, 1.05] }, // stage 5's catch: how tall and wide he swells; m the camera goes into the mouth; s the bites come
  stuck: { after: 2.5, move: 0.04, tries: 2 }, // he hasn't moved this far in this long while trying to: find another way; after this many goes, he's moved
  stun: { time: 0.65, perKg: 0.3, max: 1.2, cooldown: 5 }, // something dropped on him: s he reels, plus this much per kg, at most; s before it can work again
  hide: { range: 2.6, chance: [0, 0, 0.35, 0.55, 0.7], time: 4 }, // the tub and behind the closed curtains: he goes looking when he reaches where he lost you. m he checks from; odds he finds you, by stage; s he then knows
  sting: { // eye contact and being spotted
    eyeCos: 0.94, cooldown: 28, freeze: 0.32, // how squarely you must be looking at him; s between stingers; s he freezes, staring back
    shriekEvery: 16, shriekFace: 1.3, // s between shrieks; s his mouth stays open
  },
  friend: { greetRange: 3.5, greetTime: 2.4, greetEvery: 22, chatEvery: 1.2, trunkOut: 0.3, trunkUp: 0.38 }, // (trunkOut / trunkUp: m in front of and above the hole the nozzle waves while he talks) // nothing broken yet: m away he says hello from; s he stops for it; s between hellos; s between chats when you bat him
  lunge: { // the berserker lunge: he coils, then hurls himself at a cat on the floor with the hose rammed out straight in front
    minAnger: 3, min: 0.9, max: 3.4, maxY: 0.6, // from the angry stage; m from the hole the cat must be; m up, at most
    coil: 0.55, speed: 5.0, time: 0.42, recover: 0.9, // s of winding up (a dead giveaway); m/s and s of the lunge; s standing there after
    reach: 1.55, hoseSpeed: 10, lead: 0.35, // m the hose is rammed out to; m/s it goes; how much of where the cat is going he allows for
    cooldown: [0, 0, 7, 4.5, 3.5], chance: 0.6, // s before the next, by stage; odds he goes for it when he could (if not, he thinks again in a moment)
  },
  peek: { // right behind you in a chase, with you running from him: his nozzle comes past you at the very edge of your view (src/vacuum/vacuum.js _tickPeek)
    reach: [0, 0, 1.7, 2.3, 2.9], every: [0, 0, 5, 3.5, 2.4], hold: [0, 0, 0.9, 1.3, 1.7], // by stage: m behind you he has to be; s between; s it stays
    ahead: [0, 0, 0.18, 0.26, 0.34], side: 0.3, down: -0.09, // m in front of your eye it reaches (nearer the middle of the view, the angrier he is); m off to the side; m below the eye
    snap: 0.07, snapRate: 11, speed: 9, // m and rad/s it snaps back and forth; m/s it gets there
  },
  burst: { minAnger: 3, lost: 0.7, time: 0.85, speed: 4.6, cooldown: [0, 0, 9, 6, 4.5] }, // lost you round a corner (s) and there you are again: he comes round it all at once, at this speed (faster than you) for this long; s before he can again, by stage
  ambush: { // he knows where you're hiding: he goes quietly to just outside your room, out of sight, and sends the hose in (then, dodge it, a chase)
    minAnger: 3, chance: [0, 0, 0.3, 0.4, 0.45], first: 30, cooldown: 45, near: [2.5, 7], time: 16, // by stage, odds on a second thought; s before the first; s between; m from you he waits; s the hose keeps coming
  },
  lurk: { // from angry, now and then he goes and stands where he can see you, and watches (src/vacuum/vacuum.js _startLurk)
    minAnger: 3, chance: [0, 0, 0.35, 0.45, 0.5], first: 25, cooldown: 40, // by stage, odds on a second thought; s before the first; s between
    near: [3, 8], watch: [6, 11], // m from you he picks a spot (one with a clear view of you); s he stays
    lookCos: 0.95, stare: 1.0, sayChance: 0.6, // how squarely you must look at him; s of it before he slips away; odds he says something as he goes
    cornerChance: 0.4, cornerNear: [1.6, 3.4], // odds he waits just round a corner from you instead (out of sight: peek round and he is there), and how close
    jump: 1.5, jumpChance: 0.5, jumpEvery: 2, outView: 0.2, // once you have seen him: look right away (him outside this cos of your view) and he may be this much nearer when you look back (odds, s between)
    close: 2.2, creep: 0.3, dip: 0.9, hoseUp: 0.6, leaveSpeed: 1.4, // m: nearer than this and he comes for you; m/s he edges nearer while you aren't looking; how quiet the motor goes; m the hose stands up; speed he slips away at (share of his patrol)
  },
  creep: { // the hose comes for a cat hiding up high: slowly, from a long way off, with the motor nearly silent
    minAnger: 3, minHeight: 0.35, // from the angry stage, for a cat up on anything (it has replaced the strike)
    after: 1.1, // s of knowing where you are up there before it starts
    range: 15, length: 17, speed: 0.72, replan: 0.6, maxTime: 30, // m it can reach (into the next room, and the one after) and stretch to; m/s; s between re-routes; s before it gives up
    perKnock: 0.07, maxBoost: 3, // the more that has been knocked over, the faster it comes: + this share of its speed per knock-over, up to this many times as fast
    under: 0.9, // s of knowing you're under something (a table, a bed, a chair) before it comes in after you
    motor: 0.22, // how quiet the motor goes
    floorY: 0.6, // m: a cat below this has come down, and he goes after it instead
    cooldown: [0, 0, 16, 10, 8], // s before he tries again, by stage
  },
  fog: { // the dust cloud (src/vacuum/dust-cloud.js)
    minAnger: 4, cooldown: 40, minDist: 2.5, lostFor: 0.4, // furious only; s before he can do it again (from when the last cloud has gone); only if you're this far off, or he lost you this long ago
    sprayArc: 1.5, sprayRate: [2.3, 3.1], wind: 1.5, coughs: [0.1, 0.65, 1.15], spray: 2.6, sprayEvery: 0.045, spraySpeed: 3.4, recover: 0.5, // s of telegraph (planted, coughing up dust at these moments); s spraying it out of the hose; s between puffs; m/s; s standing still after
    swaySpeed: 3.2, wobble: { amp: 0.16, rate: 6.5, wave: 7 }, // m/s the nozzle swings about; the whole hose flailing the while like an inflatable tube man: m out, how fast, how many ripples along it
    radius: 30, grow: 6, hold: 9, fade: 3.5, density: 1.15, // m it spreads from him (the whole house); s to fill; s at full; s to clear; how thick (per metre)
    color: 0x8a7a60, moteColor: 0xbfae8a, moteSize: 0.018, motes: 140, moteBox: 3, moteAlpha: 0.75, puffs: 46, puffSize: 2.2, puffLife: 3.2, puffAlpha: 0.36,
  },
  blast: { // the dust blast: he spits a glob of dirt at a cat he can see (src/vacuum/blast.js)
    minAnger: 3, cooldown: [0, 0, 8, 5, 4], // from the angry stage; s between blasts by stage
    range: 7, minRange: 1.2, // m: how far it's aimed from
    volley: [1, 1, 1, 3, 5], volleyGap: 0.17, volleySpread: 0.11, // shots at a time by stage; s between them; rad of scatter
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
    shockKnock: 2.2, shockUp: 1.8, // the live outlet in the blackout: m/s it throws you back, and up
    highAt: 0.35, highKnock: 3.6, highUp: 1.3, slideDrag: 0.7, // hit up on something (feet above this, m): thrown harder and flatter (m/s along, up), and it skids with this little grip (1/s) until the tumble's over, so you nearly always go off the edge
  },
  hose: { // the snake out of the hole (src/vacuum/hose.js, src/vacuum/voxels.js)
    minLength: 1.6, // m: the hose is never shorter than this. When the tip is close, the excess hangs and bows aside like a chain
    slackPull: 0.02, damping: 0.92, sag: 6, aside: 14, chainPasses: 6, // the chain: how much a slack hose keeps to its route, how fast swinging dies down, m/s² of droop, of bowing sideways; how stiffly the links hold
    length: 3.8, segments: 48, radius: 0.028, tubeSegments: 112, tubeSides: 6, // m it can stretch to; points along it; m; how smooth the tube is
    camClear: 0.3, // m the hose and nozzle bend away from the camera, whatever they're doing
    color: 0x0c0c0e, nozzleColor: 0x8a8a90, nozzleR: 0.04, nozzleLen: 0.12,
    restReach: 0.55, follow: 14, floorY: 0.05, // m in front of him that the nozzle rests; how fast it catches up
    track: 34, trailStep: 0.06, // 1/s: how fast the body settles onto its trail; m between trail points
    cell: 0.12, clearance: 0.03, searchLimit: 20000, // the 3D grid: m per cell, m kept clear of surfaces, the most cells one search may look at
    replan: 0.2, arch: 0.3, arcPoints: 8, // s between re-thinking its route; how far under the tip it comes up from; points on that curve
    retractSpeed: 7, // m/s reeling back in
    reachH: 2.2, reachTop: 1.8, // m: how far out from the hole, and how high a cat it will go for. Above reachTop is safe
    minPerch: 0.3, // m: a cat higher than this counts as perched: harder to spot, and he parks near it
    standoff: 1.1, // m: how close to a perched cat he tries to park
    minAnger: 3, // he only uses the hose once he's angry
    cooldown: [0, 0, 5, 2.5, 2], // s between attacks
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
    rideSpeed: 3.2, rideMin: 0.7, rideMax: 1.4, // m/s on average; shortest and longest it can take (s)
    clearance: 0.12, minY: 0.12, // m the camera keeps from every surface (more than the near plane reaches); m it stays above the floor
    smooth: 4, step: 0.04, // the route is resampled every step m and averaged over this many samples either way, to round its corners
    lookEase: 5, // 1/s how fast the view comes round to him. It looks at him the whole way: steady, however the route bends
    hoseGap: 0.6, // m the end of the hose stays ahead of you as it reels in: never around the camera
    turn: 0.16, // s to turn and face him at the end of it
    hold: 2.0, // s held on his face (the laugh or the scream)
    faceGap: 0.15, // m: the closest the camera ever comes to his face in the catch
    faceJitter: 0.003, // m he trembles (all of him, so his face never slides off his body)
    beat: 0.8, // s of black silence before the restart screen
    screamRate: 2.3, screamGain: 1.4, screamRamp: 0.9, // the motor at the end: pitch, loudness, s to get there
  },
  drone: { // the motor. The player must be able to find him by ear (src/vacuum/vacuum.js)
    closeness: 2.2, // m: at this distance the drone is at half volume. Smaller: it rises more steeply as he nears
    floor: 0.05, // the quietest it ever gets, anywhere in the house, so he can always be heard
    gain: 1, // overall level
    stageLevel: [0.28, 0.4, 0.72, 1, 1.15], hunting: 1.5, // how loud he is by stage (quiet to begin with), and how much louder when he's after you
    rate: [0.9, 0.98, 1.12, 1.32, 1.42], // pitch by anger stage
    nearRate: 0.08, // extra pitch right next to you
    update: 0.08, // s between adjustments
    windDown: 1.2, // s for the motor to die when Grandma wakes
  },
  cord: { // the power cord: one outlet, by Grandma's door, and a fixed length (src/vacuum/cord.js)
    length: 32, // m. Every room is in reach, but not by every route: when he'd run out he goes back the way he came
    spacing: 0.2, capacity: 420, round: 0.6, roundTight: 0.14, roundSteps: 8, wander: 0.05, wanderRate: 1.7, // (the last five: m it curves round a waypoint, and round a tight spot off the graph; points per curve; m it drifts off a straight line; how fast)
    // m between points on the tube; the most points it can have
    radius: 0.009, y: 0.012, slack: 0.018, // m: thickness, height off the floor, how much it wanders
    color: 0x2a2a2c, plugColor: 0x141414,
    // Swipe the outlet he's plugged into: the cord whips back, he's dead for a moment, then he plugs into the nearest outlet.
    retract: 2.6, off: 5.0, extend: 1.2, // s: the cord reeling back, powered off, the cord going out to the new outlet
    unplugAnger: 3, // the anger stage unplugging him leaves him at, up or down
    lock: 18, // s after plugging back in before that outlet can be hit again (so nobody can stand there and keep him off forever)
  },

  // ---------------------------------------------------------------- Grandma and the win (src/world/grandma.js)
  grandma: {
    gain: 0.5, // scales every crash. The main "how long is a run" number: about 30 knock-overs on average, counting the free ones (he reaches the blackout at about 21)
    freeKnocks: 5, // the first knock-overs of a run she sleeps right through
    farScale: 0.6, nearScale: 1.5, // what a crash is worth far from her door / right at it
    range: 17, // m from the door at which a crash counts as far
    thresholds: [25, 50, 75], // wake values where the snoring lightens and a cue plays
    crossfade: 1.0, // s between snoring stages
    winBeat: 1.4, // s from her waking to the Good Kitty screen
    soundBehind: 0.6, // m behind the door the snoring comes from (the wall muffles it)
    refDistance: 4, rolloff: 0.8, // how her cues carry through the house
    snoreNear: 2, snoreFar: 7, // m from the door: full snoring within snoreNear, silent beyond snoreFar
    labelNear: 1.5, // m from the door at which "Grandma's room" shows on screen
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
    cornerTime: 0.4, cornerSettle: 7, cornerPaw: 13, // going round a corner: s it eases over; 1/s the body and paws follow at
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
    barBottom: 12, // HUD px (the stamina meter is a moon that wanes)
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
    maxSpeed: 3.2, minSpeed: 2.0, nudge: 0.55, // m/s: the most and least a freeing hit gives it; what the earlier hits on something heavy do (they only rock it)
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
    noiseScale: 2.5, // a prop's noise (1 to 5) in points toward waking Grandma, before her distance scaling
    toppleSpeed: 0.5, // m/s: a shove at least this hard knocks over something standing on the floor
    bounce: 0.3, bounceMin: 1.2, bounceKeep: 0.55, // first-hit bounce: share of impact speed, least impact to bounce, share of sideways speed kept
  },
  knockFx: { // what the different objects do when they land (src/world/knockables.js)
    chunkSize: [0.05, 0.09], decalSize: 0.34, // m: the big pieces that a "break" leaves; a stain
    chatter: 3, roll: 1.3, // s dentures chatter across the floor; s a lid or head keeps rolling
    paperPieces: 5, woolPieces: 4, buttons: 20, feathers: 8, puffLife: 0.7, // how far the trails run (0.6 m a piece) and how much spills
    rollers: { toilet_roll: { len: 7, step: 0.07, width: 0.095, r0: 0.056, r1: 0.034, uniform: false }, yarn_ball: { len: 9, step: 0.05, width: 0.022, r0: 0.049, r1: 0.006, uniform: true, vanish: true }, wool: { len: 9, step: 0.05, width: 0.034, r0: 0.071, r1: 0.032, uniform: true, vanish: true } }, // (wool: his five balls of best wool, which unwind right across a room) things that unwind as they roll: m it holds; m between points; m wide; radius full and spent; shrinks every way
    rollFriction: 1.15, rollStart: 2.4, rollStop: 0.12, // m/s²; how fast it sets off; m/s at which it stops. Hit it again and it goes again
    handsetLeash: 0.34, // m: the phone's handset stays on its cord // the toilet roll: m of paper; m/s; m between points on the strip; points; m wide; radius full and bare
    vacBounce: 1.6, vacThrow: 1.0, // m/s an object comes off him at, up and outward
    bounceMul: 1.6, rollSpeed: 1.5, // how much livelier a bouncy thing is; m/s a ball carries on at
  },
  debris: {
    cubeSize: [0.018, 0.04], // m: the shards a broken thing turns into
    speed: [0.5, 1.6], up: [0.8, 2.0], // m/s: how they scatter
    bounce: 0.35, bounces: 3, // share of speed kept per bounce; how many before they stop
    startY: 0.06, // m above the floor they burst from
    maxCubes: 480, maxDecals: 90, // (the house has ~80 knockables now: enough for every one of them to break)
    decalY: 0.004, decalStep: 0.0004, // m off the floor; extra lift per decal so overlaps never z-fight
  },
  paws: {
    plantScale: 0.72, pawScale: 0.92, glow: 0x2a241e, legLen: 0.15, // planted paws: the forearm's scale, the pad's size on top of that, its length in the model
    shoulder: [0.065, -0.22, 0.03], // in camera space: where the forearms go to, just behind the eye. They run back to the body however you look
    // walking (src/player/paws.js _gait): each paw is planted in the world and steps when it's too far from where it belongs.
    // centre: m ahead of the cat it belongs; side: m out from the middle; reach: m ahead it's put down [walk, run]; lift: m
    // it comes up; swing: s a step takes; trigger / settle: m out of place before it steps, moving / standing (turning on
    // the spot); overlap: share of one paw's step done before the other may lift; stepUp / stepDown: m a surface can be
    // above / below the cat's and still take a paw (else it's an edge: the paw stays on); padY: m the pad sits up;
    // shoulder: [m out, m ahead, m up] where the forearm goes back to, on the body
    gait: { centre: 0.12, side: 0.05, reach: [0.06, 0.09], lift: [0.025, 0.04], swing: [0.13, 0.09], trigger: 0.05, settle: 0.045, overlap: 0.5, stepUp: 0.06, stepDown: 0.04, padY: 0.006, shoulder: [0.05, -0.06, 0.11] },
    order: ['natural', 'off'], // P cycles: walking paws on the floor, or none
    // the swipe, done by the right paw (camera space, m): path = rest below, up on the right, across to the left, back down;
    // up / across: share of the swipe each part ends at; arc: m the sweep bows up; pitch, yaw [from, to], roll [from, to]:
    // rad the paw is turned (toes up, toes swinging left, pad turning to face the way it bats); blendIn / blendOut: share
    // of the swipe spent leaving / going back to the planted paw; below: m under the view it rises from in the air
    swipe: { path: [[0.07, -0.13, -0.14], [0.085, -0.035, -0.15], [-0.06, -0.05, -0.17], [-0.02, -0.14, -0.13]], up: 0.3, across: 0.62, arc: 0.025, pitch: 0.55, yaw: [-0.2, 0.6], roll: [-0.5, -1.0], blendIn: 0.28, blendOut: 0.72, below: 0.14 },
    darkGlow: 0.33, darkAt: 0.6, // in the blackout (past this much dark) the paws are drawn unlit in their own colours at this brightness, so the leg, pads and claws still show
     // a little light of their own, so an underside isn't black; m: the forearm's length in the model
    hangDist: 0.13, hangFollow: 0.3, hangNarrow: 0.55, hangTurn: 0.45, hangMargin: 0.03, // as you look along the ledge: eye-to-edge distance (m), how far the paws shift along it (m), how much closer together they get, how far they turn with the view, m kept from the ledge's end
    keepEdge: 0.9, keepNear: 0.07, // if one paw leaves the frame the pair moves back in: screen edge share, least distance in front of the eye (m)
    climbSpread: 0.06, climbUp: 0.03, climbReach: 0.03, climbStride: 0.2, climbLeg: -0.55, climbIn: 0.008, // on a climbable face: m apart from centre, m above the eye, m each paw reaches up and down, m climbed per pair of steps, rad the forearm comes back from the wall, m off the wall
    hangSpread: 0.055, hangIn: 0.05, hangLift: 0.03, hangLeg: 1.32, hangLegLen: 2.6, // on the lip: m apart from centre, m past the edge, m above the top, rad the forearm drops below it, forearm length multiplier (reaches off the bottom of the view)
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
    portraitRange: 1.5, portraitCos: 0.975, // m and how squarely you must look at a portrait to read its plate
    wakeIcon: true, wakeShow: 3.5, wakeFade: 0.8, wakeNear: 2.6, // Grandma's face and how close she is to waking: on; s it stays up after a knock-over wakes her a little more; s it fades in and out over; m from her door it shows
    lines: 240, // the HUD's own pixel grid (lines), whatever the render resolution: the pixel font stays one size
  },
  subtitles: { seconds: 3.2, maxLines: 3 }, // how long a caption stays; how many stack
  todo: { x: 6, y: 6, knocks: 5, show: 9, bump: 3, showEvil: 8, evilDelay: 4.5 }, // Marmalade's to-do list (src/ui/todo.js): HUD px from the top left; knock-overs to tick it; s it shows at the start; s it pops up after each knock-over; s it shows when he's turned (and "Wake Grandma" is added), s after he turns

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
    startFar: 7, // m: on a new run he starts plugged in at least this far from you
    tile: { fabric_velvet_curtain: 0.4, carpet_rose: 0.35, fabric_carpet: 0.35, wood_walnut: 0.5, wood_oak: 0.5, cardboard: 0.5, formica_retro: 0.5, paint_cream: 0.5, tile_bath_floor: 0.5 }, // metres per repeat of a texture (default 0.5)
    colors: {
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
