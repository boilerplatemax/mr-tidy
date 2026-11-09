// Every tunable number lives here. Comment what each value affects. Gameplay code never hard-codes these.
// Player-facing comfort options (sensitivity, look preset, volume...) live in src/data/settings.js; the values
// here are the authored defaults those settings start from.

export const TUNING = {
  // ---------------------------------------------------------------- your game
  game: {
    title: 'UNTITLED', // the title screen's name (drawn in the pixel font: capitals, digits and basic punctuation)
    storagePrefix: 'psxkit', // localStorage key prefix. CHANGE THIS per game, or two games on one origin share settings
  },

  // ---------------------------------------------------------------- the PS1 frame (src/render/ps1-renderer.js)
  render: {
    // Internal resolution. The renderer picks an INTEGER upscale k = round(screenHeight / lines) and renders
    // floor(screenHeight / k) lines, so every game pixel is exactly k×k screen pixels (no uneven rows, no shimmer).
    targetLines: 240,
    minLines: 200, // never chunkier than this, even on odd screen sizes
    aspect: 4 / 3, // used only by the optional 4:3 framing (pillarboxed). The default framing is 'fill' (widescreen)
    fov: 62, // vertical FOV in degrees. Narrow-ish: things can hide at the edges of the view
    near: 0.05,
    far: 120, // nothing beyond fog far is visible anyway; keep the depth range tight
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
    order: ['day', 'dusk', 'night'], // the dev key L cycles these
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

  // ---------------------------------------------------------------- the first-person controller (src/player/player.js)
  player: {
    radius: 0.28, // collision circle radius (m)
    height: 1.78, // standing capsule height
    crouchHeight: 1.12,
    eyeHeight: 1.65, // 1 unit = 1 m. Doors are ~2.0–2.1 m
    crouchEyeHeight: 1.0,
    crouchTime: 0.18, // s to go down / up (eased)
    stepHeight: 0.36, // ledges up to this are walked over (stairs, thresholds, porch steps)
    stepSmooth: 14, // 1/s: the eye catches up to a step-up at this rate, so stairs don't snap
    gravity: 18,
    walkSpeed: 2.75, // m/s
    jogSpeed: 4.7, // m/s, hold Shift
    crouchSpeed: 1.29,
    backwardMul: 0.8, // walking backwards is slower
    accel: 13, // 1/s: velocity reaches 63 % of target in 1/accel s (≈ 0.08 s). Short, no ice
    decel: 16, // 1/s: stopping is a touch faster than starting
    airControl: 0.15,
    lookRadPerPx: 0.0021, // mouselook: radians per mouse count at sensitivity 1
    pitchLimit: 1.48, // rad (~85°)
    // Head-bob: amplitude in metres per gait; sway = sideways share; roll = radians of tilt at walk amplitude.
    bob: { walk: 0.022, jog: 0.04, crouch: 0.012, sway: 0.5, roll: 0.004 },
    stride: { walk: 0.72, jog: 1.05, crouch: 0.52 }, // metres per footstep
    bobLock: 3, // 1/s: how fast the bob's phase is pulled back onto the footsteps after a gait change (never jumps)
    bobGaitEase: 6, // 1/s: how fast the bob's depth eases between walk, jog and crouch
    landDip: 0.08, // m: camera dip when landing from a drop
  },

  // Surfaces: footstep sound family (foot.<sound> in the sound bank; defaults to the surface's own name),
  // speed multiplier, loudness multiplier. Tag colliders and ground regions with these names.
  surfaces: {
    concrete: { speed: 1.0 },
    wood: { speed: 1.0 },
    gravel: { speed: 1.0, gain: 1.1 },
    grass: { speed: 1.0 },
    mud: { speed: 0.7, gain: 1.3 },
  },

  // ---------------------------------------------------------------- look-at interaction (src/player/interaction.js)
  interact: {
    reach: 2.1, // metres from the eye
    highlight: 0.28, // brightness lift on the looked-at object (multiplies lit colour: dark stays dark)
    pulse: 2.2, // highlight pulse speed
    holdGrace: 0.12, // s you may glance off the target during a hold before it cancels
    holdDip: 0.05, // rad: the view dips a little toward the job while a hold fills (feedback through motion)
  },
  prompt: {
    y: 0.57, // the prompt's first line: a fraction of the view's height (just under the crosshair-less centre)
    barWidth: 48, // HUD px: the progress bar under a hold prompt
    flashSeconds: 1.6, // s a refusal ("Locked. Needs a key") stays lit after E was refused
    refresh: 0.05, // s between rebuilding the prompt (it only redraws when its text changed)
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

  // ---------------------------------------------------------------- the demo scene (src/demo/demo-scene.js)
  demo: {
    preset: 'dusk', // starting light preset
    spawn: { x: 0, y: 0, z: 7, yaw: 0 }, // feet position (m) and facing (rad, 0 = looking toward −z)
    lamp: { color: 0xffc98a, intensity: 2.6, distance: 7.5, decay: 1.4 }, // the room's bare bulb
    switchHold: 1.0, // s: Hold E on the switch
    knockGap: [14, 24], // s between the distant knocks (a positional, captioned sound)
    titleCamera: { x: -3.2, y: 1.15, z: 6.5, yaw: -0.42, pitch: 0.02, sway: 0.015 }, // the title screen's slow view
  },
};
