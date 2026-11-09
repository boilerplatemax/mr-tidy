# Build Prompt: "Mr. Tidy" — A PSX Cat Horror Game

You are building a complete, playable browser horror game. Read this whole document before writing any code. Where a detail is specified, follow it exactly. Where something is unspecified, choose the option that best serves the **tone** described below, and leave a short `// DESIGN NOTE:` comment explaining the choice.

> **How this document is used:** §1 explains the full vision so you understand where the game is headed. **§0 (Phase 1: MVP) is what you build first, and only that.** Don't start anything in §3–§15 that §0 doesn't call for until the MVP is approved. When §0 and a later section disagree, §0 wins for Phase 1.

> **Starter kit:** a `starter-kit/` folder will be provided alongside this prompt. **Read everything in it before writing code.** Reuse its controller, renderer/shader, utilities and patterns instead of rewriting them, and follow its conventions (file layout, naming, mesh format). If something in the starter kit conflicts with this document, follow the starter kit for *technical* matters and this document for *design* matters, and list every conflict in a short note at the top of your first reply.

---

## 0. PHASE 1: MVP (build this first)

### 0.1 Goal of the MVP
Prove the core loop in a **grey-box house**: moving and climbing as a cat is fun, swiping things off ledges is satisfying, the shop vac hunting you by sound is tense, and getting caught by the hose is startling. **No decoration, no lore, no real models.** All the effort goes into **level design, movement feel, the vacuum AI and the catch.**

### 0.2 Grey-box art rules
- Every piece of furniture and every object is a **box, cylinder or simple primitive**. Don't add decorative detail (no doilies, picture frames, textures or props for dressing).
- Use a **readable colour code** (flat colours plus simple lighting):
  - Floor and walls: neutral greys (each room a slightly different shade so they're easy to tell apart).
  - **Surfaces you can land on:** a warm tint (tan/orange) on their top faces.
  - **Surfaces you can claw-climb:** a vertical stripe pattern (a procedural canvas texture).
  - **Knockable objects:** white / off-white.
  - **Shop vac:** dark grey body, a black intake hole, and the hose in black.
  - **Grandma's door:** a distinct colour (deep red), with a light strip under it.
- Apply only the **low internal resolution (about 320×240) and fog** from §3. Dithering, vertex wobble and the CRT effect are optional in Phase 1; add them only if the starter kit already has them.

### 0.3 The grey-box map
Build it at real human scale from level data (see §5 for the data approach). It's a single storey with **three height tiers**:
- **Tier 0, the floor (0 m):** where the vacuum lives. It's dangerous.
- **Tier 1, furniture (0.4–1.0 m):** chairs, couch, tables, counters, bed-height boxes.
- **Tier 2, high routes (1.5–2.2 m):** shelves, the fridge top, bookcase tops, curtain rods, the top of a cat tree, the tops of door frames.

Rooms, each with its own movement idea:
1. **Living room (start / tutorial space):** a **cat tree** (tier 0 → 1 → 2 in short hops), a couch whose side can be claw-climbed, and a **bookcase "staircase"** of shelves at staggered heights. The player learns jumping, ledge grabbing and claw climbing here. The vacuum starts here, near its wall outlet.
2. **Kitchen:** a **counter run**, an L-shaped run of counters with **1–1.5 m gaps** that need charged jumps, ending on **top of the fridge** (tier 2). A table island in the middle works as a tier-1 stepping stone.
3. **Storage / sewing room:** a **vertical climbing room** of tall shelving units (up to 2.2 m) with ledges spaced so you have to **ledge-grab** and mantle. Put the rewards (knockables) high up.
4. **The hallway:** long and mostly open, with **few perches** (one side table, one tall plant stand). It's the dangerous floor crossing, connecting everything, and Grandma's door is at the end.
5. **Grandma's door:** the end of the hallway. It can't be opened. Light leaks under it.

**The high-route loop:** a continuous tier-2 route linking the living room and the kitchen via bookcase tops → curtain rod → the top of the door frame → the kitchen shelves → the fridge. A skilled player can cross between those rooms **without touching the floor**. Include **one or two spots on the loop that are within hose reach**, so it's fast but not perfectly safe. Also include **dead ends** where the player has to drop down and commit to the floor.

Place about **20 knockable objects** across all three tiers, weighted toward tier 1–2 and toward the far end of the hallway (crashes there wake Grandma more).

### 0.4 Cat movement and parkour (inspired by *Peak*'s climbing)
Use the starter kit's controller as a base if one is included, then add:
- **Cat-height first-person camera** (about 0.25 m), plus walk / run / slink (§4.2).
- **Charged jump** (hold and release) with a **landing-spot highlight** on valid surfaces (§4.2).
- **Ledge grab:** if a jump comes up short but the cat's front reaches within ~0.25 m of a ledge top, **catch the edge automatically and hang** (the camera dips to look at the edge, and the paws are shown gripping it). Press jump to **mantle up** (a short animated pull-up of about 0.4 s). Press back / crouch to let go. Hanging slowly uses stamina.
- **Claw climbing:** on striped surfaces, holding forward while touching them lets the cat **climb vertically**, using **stamina**. While climbing, you can jump off sideways or backwards (a wall-jump-like kick-off) to reach nearby surfaces.
- **Stamina bar:** shown only while it's being used (a thin pixel bar at the bottom of the screen). It refills quickly whenever the cat is standing on any flat surface. When it runs out, the cat **slides down** (at a controlled speed, with no fall damage).
- **No fall damage anywhere.** Big drops just play a heavier landing thud (which is a small noise event the vacuum can hear).
- Movement should feel **snappy and forgiving**, like a cat: tight air control, coyote time (about 0.1 s), and jump buffering.

### 0.5 Swiping (inspired by *Catlateral Damage*)
- A **visible grey-box paw** (a rounded box/capsule with small toe bumps) sits at the bottom-right of the view. A left click plays a quick **swipe arc** across the screen.
- Objects in a short cone in front of you get an impulse in the swipe/facing direction. Small objects fly off, and bigger ones need several swipes to nudge toward the edge.
- Objects that fall to the floor **break into 3–6 small cubes** (or bounce if not breakable), leave a flat mess decal (a coloured square), and create a **noise event** (§6, §7).

### 0.6 The shop vac (MVP version)
- **Model:** a grey-box **shop vac**: a wide, squat dark-grey cylinder on castors (about 0.45 m tall, so it looms over the cat), with a lid. On the front sits a **large, gaping, circular black intake hole**. The **hose comes out of that hole.** Above the hole, a **simple angry face** is drawn on a canvas texture (two eyes and a mouth; the hole can read as an open mouth if that looks better — your call). In the MVP, the face just goes from neutral to angry to furious with the anger level.
- **Hose:** a **segmented chain (10–14 segments)** coming out of the intake hole, driven by simple IK / follow-the-leader. At rest it trails on the floor in front of the vac. When reaching, it **snakes up out of the hole** toward its target.
- **AI states:** `PATROL → INVESTIGATE (noise) → CLEAN (mess) → CHASE (sees cat) → SEARCH → PATROL`, plus `HOSE_REACH` and `CATCH` (see §8.4). Use waypoint-graph navigation on the floor.
- **Anger: 3 levels in the MVP** (a simplified version of §8.3):
  - **Level 1 (start):** slow patrol. Only investigates crashes nearby.
  - **Level 2 (after about 5 knock-overs):** hears crashes anywhere in the house, moves faster, and uses the hose on nearby perches.
  - **Level 3 (after about 10):** fast, aggressive hose use, and also hears running footsteps and landing thuds within ~4 m.
- **Sound:** a constant motor drone (a synthesized placeholder) that is **spatialized**. Its **volume rises steeply the closer it gets to the cat**, and its pitch rises with anger. The player must be able to locate it by ear alone. Add a distinct **hose rattle** during the reach wind-up.
- **Hose reach:** when the cat is on a perch within reach (horizontal ≤ 1.6 m, vertical ≤ 2.0 m from the hole), there's a **1 s telegraph**: the hose rises out of the hole, sways and "sniffs" toward the cat, and the rattle plays. Then it **lunges**. The player can dodge by jumping or dropping. A missed lunge slaps the surface (knocking objects off, which still counts for the player) and stalls the vac for 1 s.
- **Cleaning** messes is cosmetic only and **never removes progress** (§6.3).

### 0.7 The catch (MVP version, but polish it)
When the hose nozzle touches the cat (or the vac body touches the cat on the floor):
1. Control locks instantly. Play a loud suction burst and a screen shake.
2. **The camera is dragged along the hose's actual path** back toward the shop vac: sample the hose segment positions at the moment of capture, build a spline from the nozzle back to the intake hole, and move the camera along it over about 0.6–0.8 s, speeding up as it goes. The camera rolls/spins as it travels.
3. At the end of the path, the camera **stops just in front of the intake hole and turns to face the vac**, so the furious face and the gaping black hole fill the screen. Hold for about 1.2 s while the motor screams and pitches up, and the face jitters.
4. Hard cut to black, then a beat of silence, then the **restart** screen ("Try again").

### 0.8 Win condition (MVP version)
- The `grandmaWake` meter (0–100) fills from knock-overs, scaled by distance to Grandma's door (§7.1). It **never decreases**.
- Feedback: placeholder snoring from behind the door that gets lighter in stages, and a small 5-stage HUD icon (it can be a simple shape in Phase 1).
- At 100: the light under the door snaps brighter, the vac's motor winds down and its face goes dark, it stops dead, and a **"Good Kitty"** screen appears with the time taken and objects broken. (The full Grandma unplugging cutscene in §7.3 is Phase 2.)

### 0.9 Debug (required in Phase 1)
- `F1` overlay: the vac's state, anger level, vision cone, hearing radius, nav path, the hose reach sphere, the `grandmaWake` value, stamina and FPS.
- `F2` third-person camera, `F3` noclip, `F4` anger +1, `F5` wake +20, `F6` trigger the catch, `F8` freeze the vac.

### 0.10 Not in Phase 1
Decor and real models, portraits and nameplates, the Grandma model and the unplugging cutscene, the full five-stage face, hiding spots, the cord trail, the full audio pass, menus and settings beyond click-to-start / restart, and the full PSX shader stack.

### 0.11 MVP is done when
- [ ] A player can do the full high-route loop between the living room and the kitchen without touching the floor.
- [ ] Grabbing a ledge after a near-miss jump, then mantling up, feels good.
- [ ] Claw climbing with stamina works, and running out of stamina slides you down cleanly.
- [ ] Swiping an object off a shelf is satisfying (visible paw, good impulse, fun fall).
- [ ] With eyes closed, you can tell roughly where the vac is and how close it is.
- [ ] Every hose grab is telegraphed and dodgeable.
- [ ] The camera dragged along the hose to face the vac is startling, even in grey boxes.
- [ ] Filling the wake meter ends the run with "Good Kitty."
- [ ] Every number that affects feel is in `CONFIG`.

After Phase 1, stop and report what's built, what felt good or bad in your own testing, and which `CONFIG` values matter most for tuning.

---

## 1. The Pitch (read this twice)

You play a mischievous house cat in an old lady's house at night. Your mission is to knock things over: mugs off counters, plants off windowsills, the remote off the couch. Every crash is noise, and the noise is slowly waking Grandma, who is asleep in her bedroom at the end of the hall.

But the house has a guardian: **Mr. Tidy**, Grandma's old shop vac. He is plugged into the wall, he has a face painted above the gaping black intake hole on his front, and he does not like messes. Every time you break something, he gets a little angrier, a little faster, and his smile gets a little flatter. His long flexible hose snakes out of that hole and can reach up onto counters and shelves to pull you down.

If he catches you, the hose latches on and drags you back along itself to the vac, where you're spun around to face his furious face and the gaping hole, which fill the screen. Game over.

If you make enough noise, Grandma wakes up, shuffles out of her room, and **unplugs the vacuum**. Mr. Tidy powers down mid-hunt, his face goes dark, and the cat wins.

**Tone:** Baldi's Basics and Slender, as filtered through early PS1 liminal-space horror. It's funny in concept and genuinely tense in the moment. The house feels a little too big, a little too empty, a little wrong. It's never gory. The horror comes from sound, anticipation and that face.

---

## 2. Tech Requirements

- **Single `index.html` file.** All JS, CSS and generated assets go inline. No build step.
- **Three.js** loaded via an import map from a CDN (pin a specific version, e.g. `three@0.160.0`). Put the CDN URL in one constant so it can be swapped for a local vendored copy for offline play.
- **The game must be fully playable with placeholder art.** Build every model from Three.js primitives / simple custom geometry, and generate textures procedurally on `<canvas>`. The final generic props (furniture, mugs, plants, etc.) will come from PSX asset packs, and the custom hero models are listed in §15. Structure the code so any model can be replaced with an imported GLB: one `buildX()` function per model returning a `THREE.Group`, plus an `ASSETS` map where a GLB path can be set per model. If a path is set, load it (GLTFLoader) and fall back to the primitive version if loading fails.
- **No physics library.** Write a small custom physics system for knockable objects (see §6).
- **Audio:** Web Audio API, all sounds synthesized procedurally as placeholders. Every sound goes through one `playSound(name, opts)` / `loopSound(name)` layer so real audio files can be dropped in later without touching gameplay code.
- Target 60fps on a GTX 1650-class desktop and a mid-range laptop.
- Pointer lock for mouse look. Show a click-to-start screen.

### 2.1 Code organization (inside the single file)
Use clearly labeled sections in this order:
1. `CONFIG`: one object holding every tunable number (speeds, noise values, anger thresholds, hose reach, FOV, render resolution, etc.).
2. Renderer and PSX post-processing
3. Audio layer
4. Procedural textures
5. Model builders (`buildCat()`, `buildVacuum()`, `buildMug()`, ...)
6. House / level construction (data-driven, see §5)
7. Physics for knockables
8. Player (cat) controller
9. Vacuum AI
10. Grandma / noise / win system
11. Catch sequence (jumpscare)
12. UI / HUD / menus
13. Main loop
14. Debug tools

---

## 3. PSX Visual Style

This is non-negotiable and is most of the vibe.

- **Low internal resolution:** render to a render target of about **320×240** (configurable). Upscale to the window with nearest-neighbour filtering, letterboxed to 4:3.
- **Ordered (Bayer 4×4) dithering** with colour quantization to about 5 bits per channel, done in a full-screen post-processing shader.
- **Vertex snapping (wobble):** in the vertex shader, snap clip-space positions to a low-res grid so geometry jitters slightly when the camera moves.
- **Affine-style texture warping** if feasible (optional; skip it if it causes artifacts).
- **Nearest-neighbour textures**, small (32×32 to 64×64), with visible pixels.
- **Fog:** dense, dark, warm-brown/grey distance fog. You should not see the end of the long hallway clearly.
- **Lighting:** very dim. Sources are moonlight through windows (cool blue), a few nightlights and lamps left on (warm yellow pools), the blue flicker of a TV left on in the living room, and the light under Grandma's bedroom door. Low ambient. Darkness should be the dominant colour.
- **Optional CRT touch:** a faint scanline overlay and slight vignette (toggle in settings).

---

## 4. The Player: The Cat

### 4.1 Camera
- **First person at cat height:** camera about **0.25 m** off the floor (the house is built at real human scale, so everything looms).
- FOV around 80°. Subtle head-bob while walking, a faster bob when running.
- Show the **cat's front paws** at the bottom of the screen: low-poly, a ginger/orange tabby texture. Paws animate when walking, swipe when batting, and stretch forward when jumping.
- When looking straight down, you can see the paws and front legs. Hold a key (`C`) to **look back over the shoulder** and see your own tail swishing (a fast camera rotation; release to snap back).
- A debug toggle (`F2`) switches to a third-person camera, for testing only.

### 4.2 Movement
| Action | Key | Notes |
|---|---|---|
| Walk | WASD | Normal speed, quiet footsteps |
| Run | Shift | Fast, makes small footstep noise that the vacuum can hear when close (not Grandma) |
| Slink | Ctrl (hold) | Very slow, lower camera, silent |
| Jump | Space (hold to charge, release to jump) | See below |
| Bat / swipe | Left click | Paw swipe that pushes whatever's in front of you |
| Meow | E | Small noise. Adds a tiny amount to Grandma's meter but **strongly attracts the vacuum**. A risky lure tool. |
| Look back | C (hold) | Over-shoulder view |

**Jumping is the core traversal skill.**
- Hold Space to charge (the camera dips slightly and a subtle wiggle animates the paws, like a cat preparing to pounce). Release to leap.
- When aiming at a valid surface (couch, chair, counter, table, shelf, windowsill, bed, top of fridge), show a **faint pixel outline / reticle highlight** on the landing spot. A short charge reaches low surfaces, a full charge reaches counters, and a chain of jumps (chair → table → shelf) reaches the high stuff.
- Floor → chair (0.45 m) → counter / table (0.9 m) → shelves / top of fridge (1.5–1.8 m).
- Drop off edges by just walking off. Landing from height makes a soft thump.

### 4.3 Batting objects (inspired by *Catlateral Damage*)
- The paw is always visible at the bottom of the view, and left click plays a swipe arc across the screen. Any knockable object within ~0.4 m in front gets an impulse in the camera's facing direction.
- Small objects move a lot, heavy objects only a little. Some objects need **multiple swipes** to inch toward the edge (this is the comedy: cat slowly, deliberately pushing a mug off the counter while the vacuum hum gets closer).
- When an object's centre of mass passes the edge of its surface, it tips and falls (see §6).

---

## 5. The House

A single-storey old bungalow, built at real human scale. Construct it from **data**: an array of rooms, walls, doors, furniture placements and knockable placements. That way the layout can be edited easily and later replaced by a room-builder export.

### 5.1 Rooms
1. **Living room:** floral couch, armchair, doily-covered side tables, a wood-cabinet CRT TV left on showing static (it gives a flickering blue light), a bookshelf, a lamp, heavy curtains, a china cabinet. This is where the vacuum starts, plugged into an outlet here.
2. **Kitchen:** counters with a lino floor, a fridge (climbable top), a table and chairs, a sink, a windowsill with plants, a ticking wall clock, a fruit bowl.
3. **Dining room:** a long table with a lace tablecloth, a sideboard with fine china, a candle holder.
4. **The long hallway:** connects everything. Make it **slightly too long** for a house this size, with patterned runner carpet, a framed cat portrait every few metres, a side table with a phone and a vase, and a nightlight at the far end. Grandma's bedroom is at the very end; light leaks under her door.
5. **Bathroom:** small. Tiles, a toilet-roll stand, a shelf of perfume bottles and powders, a fuzzy pink bath mat.
6. **Sewing / craft room:** yarn baskets, a sewing machine table, a dress form mannequin (unsettling silhouette in the dark), shelves of jars of buttons.
7. **Grandma's bedroom:** door closed. **The player cannot enter.** You can hear her snoring through the door. This is the "goal" room: it's what you're trying to wake.

### 5.2 Cat portraits (atmosphere only)
- About 8 framed portraits of previous cats hang in the hallway and living room. Each is a small procedural painting of a different cat (vary the colour, pattern and pose).
- Each has a brass nameplate with a name and dates, readable when you look at it up close (a small text popup): e.g. *"Biscuit 1961–1974"*, *"Mr. Whiskers 1975–1983"*, *"Duchess 1984–1989"*, *"Pepper 1990–1992"*, *"Tuna 1993"*… The lifespans get shorter, and the last few have only one year.
- The final frame, closest to Grandma's door, is **empty**, with a nameplate that already shows the player cat's name and a start date.
- The portraits are **never explained** and have **no gameplay function**. They cannot be knocked over. They exist purely to unsettle.

### 5.3 Liminal touches
- A clock ticking somewhere, never quite locatable.
- The TV static hiss, audible from the hallway.
- Doors left ajar at odd angles.
- A long empty stretch of runner carpet with nothing on it.
- Grandma's snoring is the house's "heartbeat," audible everywhere but faint, and loudest near her door.

---

## 6. Knockable Objects and Mess

### 6.1 The objects
Place about **25–35 knockable objects** around the house, more than are needed to win, so the player has choices and routes. Each object has:
```js
{ id, type, room, position, surface, mass, noise, breakable, messType }
```
Suggested set (mix of noise values):
| Object | Noise | Where |
|---|---|---|
| Coffee mug | Medium | Kitchen counter, side tables |
| Potted plant | Medium (dirt mess) | Windowsills |
| TV remote | Low | Couch arm |
| Glass vase | High | Hallway table, dining table |
| China plate | High | Sideboard, china cabinet shelf |
| Picture frame (small, standing) | Low | Side tables (not the portraits) |
| Ball of yarn | Very low (rolls away) | Sewing room |
| Jar of buttons | High (scatter mess) | Sewing room shelf |
| Perfume bottle | Medium | Bathroom shelf |
| Toilet roll | Very low | Bathroom |
| Fruit bowl | Medium | Kitchen table |
| Candle holder | Medium | Dining table |
| Snow globe | High | Bookshelf |
| Teacup and saucer | Medium | Side table |
| Cookbook | Low | Kitchen counter |
| Telephone handset | Medium (dial tone keeps playing) | Hallway table |

### 6.2 Physics (custom, simple)
- Objects sit on surfaces (axis-aligned boxes). When batted, they slide with friction.
- When the centre passes a surface edge, the object tips (rotates toward the edge) and falls with gravity, tumbling with a random spin.
- On hitting the floor:
  - **Breakable:** replace the object with 4–8 low-poly shards plus a decal (a ceramic shard pile, a dirt splat, scattered buttons). Play the break sound.
  - **Non-breakable:** it bounces once, rolls and settles. Play a thud.
- Objects falling onto lower surfaces (counter → chair) should land there, not clip through.

### 6.3 Messes
- Every fallen object creates a **mess** at its landing spot, registered with the vacuum AI.
- **Cleaning a mess never undoes progress.** The noise already reached Grandma. When the vacuum cleans a mess, the debris is sucked up (shards fly into the nozzle) and the decal fades. This is purely cosmetic, and it pulls the vacuum around the house.

---

## 7. Grandma and the Win Condition

### 7.1 The noise meter
- A hidden-ish value `grandmaWake` goes from 0 to 100.
- Each knock-over adds that object's noise value, scaled by **distance to Grandma's bedroom** (crashes near the hallway count for more; kitchen crashes count for less). Tune it so that about **10–14 knock-overs** win on average.
- **The meter never decreases.** The player never loses progress.

### 7.2 How the player reads the meter (no plain progress bar)
Communicate it diegetically, with a small optional HUD element as backup:
- **Snoring changes by stage:**
  - 0–25: deep, steady, slow snoring.
  - 25–50: snoring with occasional snorts and pauses.
  - 50–75: restless. Bed springs creak, she mumbles in her sleep ("…Biscuit?…", "…who's there…").
  - 75–99: very light sleep. She coughs, the floor creaks, the light under her door flickers.
- **HUD backup:** a small pixel-art sleeping face icon in the corner whose "Z"s shrink, and whose eyes slowly open, in five stages. Toggle it in settings (on by default).
- Each time a stage threshold is crossed, play a distinct one-shot cue (a loud snort, a cough, a creak) so the player knows they made progress.

### 7.3 The ending
When `grandmaWake` reaches 100:
1. A huge snort, then silence. The vacuum **freezes** for a beat.
2. Grandma's bedroom door creaks open. Warm light spills into the hallway.
3. Control is taken away. The camera smoothly turns toward the hallway/living room, wherever the outlet is visible (route the camera if needed).
4. Grandma, seen from cat height (we see slippers, a nightgown hem, a walking stick; her face stays out of frame or in shadow), shuffles to the wall outlet.
5. She bends and **yanks the plug**. Play a big electrical "thunk" and the vacuum motor winding down in pitch.
6. Mr. Tidy's face **goes dark** (the painted face texture fades to black), his hose drops limp, and he slumps.
7. Grandma mutters something like *"Silly old thing, running all night."* She shuffles back, and the camera follows her into her bedroom. The cat hops onto the bed, where it's warm and the snoring starts again.
8. Fade to the title card: **"Good Kitty."** Show stats: time taken, objects broken, times spotted.

---

## 8. The Antagonist: Mr. Tidy

### 8.1 Design
An old **shop vac** with a personality face. It's an original design with this exact silhouette:
- **Body:** a wide, squat cylindrical drum about 0.45 m tall and 0.45 m in diameter. That's taller than the cat's eye line, so from the cat's point of view he looks like a squat, looming barrel.
- **Intake hole:** a large, gaping, circular black hole on the front of the drum. The hose comes out of it. Looking into it, there's darkness with a faint rim of dust.
- **Colour:** faded cherry red body, a black domed lid on top with a carry handle, and a black bumper ring around the base.
- **Wheels:** small castors underneath. He glides, he doesn't walk.
- **Face:** painted on the front of the drum, above the intake hole (the hole can work as the mouth), as a canvas texture with **big round black eyes** and a wide painted grin. The face has **five anger states** (procedurally drawn, swapped by anger level):
  1. Cheerful wide smile, open eyes.
  2. Smaller, tighter smile.
  3. Flat line mouth, eyes narrowing.
  4. Frown, slanted angry brows painted on.
  5. Furious: a jagged gritted-teeth mouth, sharp brows, eyes with tiny pinprick highlights. This is the jumpscare face.
- **Hose:** a long corrugated black hose coming out of the intake hole, ending in a metal wand and floor nozzle. The hose is built as a chain of segments (a simple IK / follow-the-leader chain), so it can **snake, rise and reach**.
- **Cord:** a thin grey power cord trailing from the back of the drum to the wall outlet in the living room. Store a breadcrumb trail of the vacuum's path and render the cord along it (simplified, capped length; it can pass "through" doorways and just stays on the floor). The cord is a great tell, because you can follow it to find him. It also sets up the ending, where Grandma pulls the plug.

### 8.2 Sound
- A constant **motor drone** (filtered noise plus a low oscillator), spatialized. **Pitch and volume rise with anger level and with proximity.** Like Baldi's slaps, the sound is the main threat indicator.
- **Hose rattle:** a distinct clattering, sucking sound when the hose is extended and reaching. This is the warning before a high-perch grab.
- Wheel squeaks on turns.
- A suction "slurp" when cleaning a mess.
- A short motor surge when he spots the player.

### 8.3 Anger levels and the difficulty ramp
Anger is tied to the **number of objects knocked over**, not time, so the player controls the pace.
| Anger | Trigger | Behaviour |
|---|---|---|
| 1 Calm | Start | Slow patrol on a fixed loop, cleaning any mess on his route. Doesn't actively hunt. Only reacts if he bumps into the cat. |
| 2 Annoyed | 2 knock-overs | Hears crashes: heads to the most recent mess (at moderate speed), cleans it, then patrols near it. |
| 3 Irritated | 5 knock-overs | Faster. Also hears running footsteps and meows within ~4 m. Starts **hose-checking** surfaces near messes (sweeps the hose along counters and shelves). |
| 4 Angry | 8 knock-overs | Fast. Hose almost always partly raised. Checks hiding spots (under the couch and bed skirts) with the hose. Follows the player's last known position more aggressively. |
| 5 Furious | 11 knock-overs | Very fast in straight lines but turns slowly (so dodging around furniture still works). Constant loud motor. Lights flicker briefly when he passes lamps. |

Tune the speeds so the player can always just barely outrun him on the floor at anger 3, but not at 5. At 5, survival comes from using heights, corners and hiding.

### 8.4 AI states
```
PATROL → (hears noise / sees mess) → INVESTIGATE → CLEAN
       → (sees player) → CHASE → (loses player for N seconds) → SEARCH → PATROL
       → (player on reachable perch & in range) → HOSE_REACH
       → (hose contact) → CATCH
```
- **Vision:** a forward cone (~70°, range by anger level) with raycasts against walls and furniture. The cat is harder to see in dark areas and when slinking.
- **Hearing:** noise events have a position and radius. Knock-overs are heard house-wide from anger 2 up.
- **Navigation:** a simple navmesh or waypoint graph over the house floor (precompute it from the level data). He goes around furniture, not through it, and he can't go under low furniture except with the hose.
- **Cleaning:** at a mess, he stops, the nozzle lowers, debris flies in, and it takes about 1.5–3 s. **This is the player's window to escape or set up the next crash.**

### 8.5 The hose (key mechanic)
- High perches are **not** fully safe. If the player is on a perch within hose reach (horizontal ≤ 1.6 m, vertical ≤ 1.9 m from the vacuum; scale with anger), and he knows or suspects the player is there, he can **reach**.
- **Telegraph:** the hose rattle plays, and the hose rises out of the intake hole in a slow, searching, snake-like motion: about 1.2 s of wind-up where the nozzle sways and "sniffs" toward the player. Then it **lunges** toward the player's position.
- The player can dodge by **jumping to another surface or dropping down** during the wind-up or lunge. A missed lunge slaps the surface (knocking over any objects there, which, deliciously, counts toward Grandma's meter) and pauses the vacuum for 1 s.
- Hiding spots (under the couch, under the bed skirt in the sewing room, behind the curtains, inside an open cupboard) are safe until anger 4, after which the hose can probe them. Probing is also telegraphed: the nozzle pushes in slowly with a rattle and a sniffing suction sound.

---

## 9. The Catch / Jumpscare (most important moment, polish it)

When the hose nozzle touches the cat (or the drum bumps the cat on the floor at anger ≥ 2):
1. **Instant control loss.** A loud suction *FWOOMP*. The screen shakes.
2. The camera is **dragged along the hose's actual path** back to the vac: sample the hose segment positions at the moment of capture, build a spline from the nozzle to the intake hole, and move the camera along it over about 0.6–0.8 s, speeding up, with the FOV narrowing and a motion-smear effect (cheap: accumulate frames or add a radial blur in the post shader).
3. The camera **spins/rolls** as the cat travels along the hose.
4. At the end of the path, it stops just in front of the intake hole and turns to **face Mr. Tidy's furious face (anger state 5)** and the gaping hole, filling most of the screen. Hold the shot for **1.2 s**: the motor screams and pitches up, the face trembles with vertex jitter, and the eyes' highlights flicker.
5. A hard cut to black. One beat of silence. Then the soft *tick… tick…* of the kitchen clock.
6. Game over screen: a dithered, still image of the empty portrait frame from the hallway. The nameplate now reads the cat's name with the **end year filled in**. Text: *"Mr. Tidy keeps a clean house."* Buttons: **Try Again** / **Main Menu**.

Restarting resets the whole run (it's a short game, about 10–20 minutes when won, like Slender).

---

## 10. UI and Menus

- **Title screen:** a dithered shot of the dark hallway with the vacuum silhouette at the far end. Title: **MR. TIDY**. Options: Start, Settings, Controls.
- **Intro text** (typed out, skippable): *"Grandma's asleep. The house is quiet. Too quiet. Make some noise."* Then a hint: *"Knock things over. Wake Grandma. Don't let Mr. Tidy catch you."*
- **HUD (minimal):**
  - A small dot crosshair.
  - Landing highlight when charging a jump.
  - Grandma sleep icon (§7.2), toggleable.
  - A brief floating "CRASH!"-style pixel text when something breaks (optional, toggle).
  - No health, no map.
- **Settings:** mouse sensitivity, master/music/SFX volume, render resolution (240p / 360p / 480p), CRT overlay on/off, HUD sleep icon on/off, invert Y.
- **Pause** on Esc.

---

## 11. Audio Layer Notes

All placeholder sounds are synthesized; the real soundtrack and SFX will be swapped in later.
- An ambient bed: low room tone, a faint fridge hum in the kitchen, the TV hiss in the living room, the clock tick.
- Footsteps vary by floor (carpet = soft thud, lino = light tap, tile = clicky), and the volume depends on the movement mode.
- Use `PannerNode` spatialization for the vacuum, Grandma's snoring and room sources.
- Expose a `SOUNDS` registry: `{ name: { synth: fn, file: null } }`. If `file` is set later, load and play the file instead of the synth.
- **No music during gameplay** by default. Leave a `music` channel with a hook for a tension track whose intensity parameter follows the anger level.

---

## 12. Debug Tools (toggle with F1)

- Show the vacuum's state, anger level, vision cone, hearing radius, nav path and hose reach sphere.
- Show `grandmaWake` as a number.
- Keys: `F2` third-person camera, `F3` noclip/fly, `F4` set anger +1, `F5` add 20 wake, `F6` trigger the catch sequence, `F7` trigger the ending, `F8` freeze the vacuum.
- An FPS counter.

---

## 13. Build Order (milestones)

**Phase 1 is §0 (the MVP).** Build that, report back, and wait for approval. The milestones below are **Phase 2**, the full game, built on top of the approved MVP. Each milestone should leave the game runnable.
1. **Renderer and PSX look:** low-res target, dithering, vertex snap, fog, one test room.
2. **Cat controller:** first-person cat-height camera, paws, walk/run/slink, charged jump onto surfaces with landing highlight.
3. **House:** all rooms from level data, furniture, lighting, portraits with nameplates.
4. **Knockables:** batting, custom physics, falling, breaking, mess decals.
5. **Grandma system:** wake meter, snoring stages, HUD icon, stage cues.
6. **Vacuum, basic:** model, face states, cord, navigation, patrol, investigate, clean.
7. **Vacuum, hunting:** vision, hearing, chase, search, anger ramp.
8. **Hose:** IK chain, reach telegraph, lunge, hiding-spot probing.
9. **Catch jumpscare** and game over.
10. **Ending sequence** and win screen.
11. **Audio pass:** all synthesized sounds, spatialization, registry.
12. **Menus, settings, polish, tuning.**

At the end, provide a short **"How to tune"** note listing the most important `CONFIG` values.

---

## 14. Acceptance Checklist

- [ ] It looks unmistakably PS1: low-res, dithered, wobbly vertices, dark and foggy.
- [ ] Being a cat feels right: low camera, the house feels huge, and jumping onto counters is satisfying.
- [ ] Pushing a mug slowly off a counter is funny and tense.
- [ ] You can always tell roughly where Mr. Tidy is by sound alone.
- [ ] His face visibly gets angrier as you break more things.
- [ ] High perches feel safe-ish early and risky later, because of the hose.
- [ ] Every hose grab is telegraphed and dodgeable by an alert player.
- [ ] Cleaning messes never removes progress.
- [ ] The catch sequence is startling every time, with his face filling the screen.
- [ ] The ending lands: Grandma unplugs him, his face goes dark, and the cat curls up on her bed.
- [ ] The cat portraits feel quietly wrong and are never explained.
- [ ] Everything is in one `index.html` and runs by double-clicking it (or from a simple local server if import maps require it; document which).

---

## 15. Custom Hero Assets (cannot come from generic PSX packs)

Everything not on this list (furniture, kitchen props, mugs, plants, vases, TV, lamps, frames, doors, wall and floor textures) comes from generic PSX packs. Only these need custom work. The code must support each as a GLB/texture swap with the exact structure below.

### Must-have 3D models
1. **Mr. Tidy body:** the squat cherry-red shop-vac drum with a **gaping circular intake hole** on the front (modelled as a real recess the camera can almost look into), black domed lid with carry handle, black bumper ring, castor wheels. Low poly (~300–600 tris). It needs a **flat, separate face material slot / UV region** on the front so the face texture can be swapped at runtime. Pivot at the floor, centre. Nodes: `body`, `lid`, `face`, `intakeHole`, `hoseSocket` (empty inside the intake hole, where the hose comes out), `catchCamTarget` (empty in front of the hole where the catch camera ends up), `cordSocket` (empty at the back).
2. **Mr. Tidy hose + wand + nozzle:** a corrugated hose built as **10–14 separate segment meshes** (or a skinned chain of bones), then a metal wand and a floor nozzle. It must be articulated so the code can drive it with IK (snaking, rising, lunging, probing under furniture). Nodes: `hoseSeg_00…N`, `wand`, `nozzle`, plus `nozzleTip` (an empty used for catch detection and suction particles).
3. **First-person cat forelegs and paws:** ginger tabby, low poly, rigged. Animations: `idle`, `walk`, `run`, `slink`, `swipe` (left and right), `jumpCharge` (wiggle), `jumpLeap` (stretch forward), `land`. Seen up close at 0.25 m camera height, so the paw pads and claws should read clearly at 320×240.
4. **Cat tail:** rigged (4–6 bones), with `swish` idle and `puff` (startled, for when the vacuum spots you) animations. Only seen through the look-back key. Also used for a whole-body sprite or simple model in the ending's curl-up shot.
5. **Grandma, from cat height:** only the parts that are ever in frame: slippers, legs/ankles, nightgown hem, one hand and arm, and a walking stick. The face is never needed. Animations: `shuffle`, `bendReach`, `yankPlug`, `turnAround`. A generic old-woman character from a pack *might* work if it can be animated like this; otherwise this is custom.

### Must-have 2D art (textures)
6. **Mr. Tidy face sheet:** five anger states (cheerful → furious) in one atlas, plus a sixth "powered off / dark" state. This is the single most important art asset in the game.
7. **Cat portraits:** 8 painted cat portraits (different cats, oil-painting style but pixelated), plus the **empty frame** canvas. Frames themselves can come from a pack.
8. **Nameplate text:** brass plates rendered procedurally from data (names and years), so no art is needed. Just a brass texture.
9. **Grandma sleep icon:** five-stage pixel HUD icon.

### Small but specific (quick to make, rarely in packs)
10. **Wall outlet + plug with prongs:** the plug has to visibly yank out in the ending.
11. **Power cord:** generated procedurally as a tube along the vacuum's breadcrumb path. No model needed.

### Not needed as models
- Broken versions of objects: shards are generated procedurally (§6.2).
- Mess decals (dirt, shards, buttons): procedural textures.
