# Audio

**Files:** `src/audio/audio.js`, `src/audio/sound-bank.js`, `src/audio/synth.js`, captions in `src/ui/subtitles.js`

## What it does

- **Bootstrap:** the `AudioContext` is created on the first click (the Begin button, the same click that grabs
  pointer lock). Before that, `audio.play()` returns `null` and nothing breaks.
- **Positional sound:** mono sources through an HRTF `PannerNode` (inverse distance rolloff). Pass `pos` or `follow`
  (an Object3D) to place a sound in the world.
- **Occlusion:** about 10 times a second each positional voice counts the colliders with `occludes: true` between
  you and it (0, 1, 2+) and low-passes and quietens accordingly.
- **Reverb:** two generated impulse responses: a close room (sources inside an indoor box) and dry open air.
- **The bed:** looping ambience on the `bed` bus is crossfaded to a muffled copy while you're indoors.
- **Ducking:** `pushDuck()` / `popDuck()` dip the ambience under speech.
- **The sound bank:** every sound is a named slot. Gameplay only plays slot names. Each slot has a placeholder
  generator (synth code, so the game is never silent) and can name real files that replace it when they load.
- **Captions:** a slot with `subtitle: 'knocking'` is captioned automatically when played, with a direction from
  where it is: `[knocking, outside, behind you]`.

## API

```js
audio.start(THREE.Vector3)                     // from the first click (Input's 'firstClick')
audio.onStart.push(() => audio.play('amb.wind')) // start loops once audio exists
const v = audio.play('lamp.hum', { pos: { x, y, z }, gain: 1, rate: 1, loop: true, fadeIn: 0.5 });
v?.stop(0.2);  v?.fadeTo(0.5, 1);  v?.setPosition(x, y, z);
audio.play('foot.' + surface, { fallback: 'foot.concrete' });
audio.world = collisionWorld;  audio.indoorBoxes = [box3];
audio.onCaption = (label, pos) => subtitles.sound(label, pos, audio.listenerPos, player.yaw);
audio.update(dt, camera)                       // per frame: listener pose, occlusion, indoor bed
audio.suspend() / audio.resume()               // on pause / resume

// sound-bank.js
'door.creak': { gen: v(creak, 3), gain: 0.5, subtitle: 'a door creaks', files: ['game-assets/audio/door_1.ogg'] },
```

Synth building blocks (`synth.js`): `buffer`, `noise`, `brown`, `sine`, `saw`, `biquad` (lp / hp / bp, frequency can be
a function of t), `env`, `grains`, `mix`, `normalise`, `declick`, `loopable`. A generator returns one Float32Array, or
use `v(fn, n)` for n random variants.

## Knobs (`TUNING.audio`)

`sampleRate` (22.05 kHz: the lo-fi feel), `master`, `buses`, `refDistance` / `rolloff` / `maxDistance`,
`occlusion` (Hz and gain per wall count, update rate, smoothing), `reverb.indoor` / `reverb.outdoor`
(length, decay, wet, tone), `indoorBedHz`, `indoorBedLevel`, `indoorFade`, `duck`.

## Gotchas we hit

- **The AudioContext needs a click.** Browsers refuse to start audio without a user gesture. Make the first click
  (Begin) do it, and make it the same click that locks the pointer. Headless checks need
  `--autoplay-policy=no-user-gesture-required` (check-page.mjs passes it) and `window.__startAudio()`.
- **Crossfade, don't sweep.** Sweeping a low-pass as you cross a doorway sounds phased. Crossfade to a fixed muffled
  copy.
- **Make loops seamless.** Use `loopable()` (an equal-power crossfade of the tail into the head) on noise loops; tonal
  loops need a whole number of cycles in the buffer.
- **Suspend on pause.** Otherwise loops keep playing over the pause menu.
- **Every threat sounds before it's seen.** Give anything dangerous a sound slot with a caption, so a player with
  the sound off still gets the warning.
- **Audio files are per game.** The kit ships none; real recordings replace slots through `files`.
