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
    bob: { walk: 0.006, run: 0.012, slink: 0.003, sway: 0.5, roll: 0.004 },
    stride: { walk: 0.26, run: 0.42, slink: 0.2 }, // metres per footstep
    stepGain: { walk: 0.8, run: 1.2 }, // footstep loudness. Slink has none: it's silent
    bobLock: 3, // 1/s: how fast the bob's phase is pulled back onto the footsteps after a gait change (never jumps)
    bobGaitEase: 8, // 1/s: how fast the bob's depth eases between gaits
    landDip: 0.03, // m: camera dip when landing
    landSoft: 2.2, // m/s: impacts below this make no sound at all
    landHeavy: 5.2, // m/s: impacts above this (a drop of about 0.75 m) are the heavy thud the vac can hear
  },

  // ---------------------------------------------------------------- the charged jump (src/player/player.js)
  // A full charge rises maxVy² / 2g = 0.95 m: floor to counter top. Re-run the route check after changing any of these.
  jump: {
    chargeTime: 0.55, // s to full charge. Tap = no charge
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
    wiggle: 0.012, wiggleRate: 30, // rad, rad/s: the pounce wiggle at full charge
    predictDt: 0.02, predictT: 1.4, // s: landing-spot prediction step and horizon
    markerSize: 0.2, markerColor: 0xfff0c8, // m: the landing-spot outline
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
    hangDrop: 0.22, // m: feet below the edge while hanging (puts the eye just over the lip)
    hangDip: 0.24, // rad: the camera dips to look at the edge
    settle: 30, // 1/s: how fast the body settles into the hanging pose
    mantleTime: 0.4, // s: the pull-up
    inward: [0.16, 0.12, 0.08, 0.04], // m past the lip to end up, tried in order (narrow perches take the shorter ones)
  },
  paws: {
    color: 0xa89a88,
    gripX: 0.055, gripY: -0.012, gripZ: -0.17, gripTilt: 0.2, // the hanging pose (camera space, m and rad)
    drop: 0.08, pullDown: 0.1, ease: 18, // m hidden below the view, m lowered during the pull-up, 1/s ease in and out
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
      ceiling: 0x3a3a3e, outside: 0x202024,
      grandmaDoor: 0x7a1414, doorStrip: 0xffd28a, outlet: 0xb8b4a8,
    },
    doorLight: { color: 0xffc27a, intensity: 2.2, distance: 4.5, decay: 1.6 }, // the glow from under Grandma's door
    preset: 'greybox', // starting light preset
    spawn: { x: 2.2, y: 0, z: 1.6, yaw: 0.78 }, // feet position (m), facing (rad, 0 = toward -z): at the cat tree
    titleCamera: { x: 3.0, y: 0.25, z: 4.2, yaw: 0.5, pitch: 0.12, sway: 0.01 }, // the title screen's slow view
  },
};
