# Interaction, prompts, the pixel font and captions

**Files:** `src/player/interaction.js`, `src/ui/prompt.js`, `src/ui/pixel-label.js`, `src/ui/hand-font.js`, `src/ui/subtitles.js`

## What it does

- **The picker:** each tick a ray from the camera finds the nearest interactable whose box it crosses, within reach
  and not behind a solid collider. It also remembers the nearest thing in view you *can't* use and why.
- **Feedback:** the target brightens and breathes (a multiplicative highlight: dark stays dark). The prompt under the
  view says the action: `E — Open`, `Hold E — Turn on the light`. A hold fills a bar while rising ticks play and
  the view dips a little toward the job; looking away (beyond a short grace) or letting go cancels.
- **Blocked actions:** a thing you can't use shows its reason, greyed (`Locked. Needs a key`). E on it plays a dull
  thud and flashes the reason. E is never silently ignored.
- **The pixel font:** a hand-drawn bitmap alphabet (capitals, lowercase, digits, punctuation, arrows) drawn 1:1 into
  small canvases and scaled by whole numbers. Hands: `print` (the HUD and menu), `pencil` (uneven handwriting),
  `ink` (slanted). Good for notes on in-world canvas textures too.
- **HUD labels:** a layer laid exactly over the game canvas on its own ~240-line grid, so the font stays the same size
  at any render resolution. A label redraws only when its rows change.
- **Captions:** `[label, where]` with direction words: ahead, to the left / right, behind you, above you, right
  beside you, outside / indoors, or `from the <place>` for named areas.

## API

```js
interaction.ctx = { player, hasKey: false };   // passed to every callback
interaction.add({
  object: mesh, kind: 'hold', hold: 1.2,       // or kind: 'tap'
  label: (ctx) => (ctx.lampOn ? 'Turn off the light' : 'Turn on the light'),
  canUse: (ctx) => ctx.hasKey, why: () => 'Locked. Needs a key',
  onUse: (ctx) => {...}, hint: 'A dim second line', reach: 2.5, tag: 'cabinet',
});
interaction.remove(it);  interaction.refreshBox(it);   // after moving it
promptBus.say('Hands full');                            // flash any refusal on the prompt

const hud = new HudLayer(canvas);
const label = hud.label('my-class').place('left', 6, 6);  // HUD px from the left / top
label.set([{ text: 'Day 1' }, { text: 'dim line', dim: true }, { bar: 0.5, width: 40 }]); label.show(true);
write(ctx2d, 'Text', x, y, { hand: 'pencil' });  measure('Text');  wrap('long text', 120)

subtitles.sound('a door creaks', pos, listenerPos, yaw);  subtitles.line('Voice', 'Did you hear that?');
subtitles.places.push({ name: 'shed', minX, maxX, minZ, maxZ });
```

## Knobs (`TUNING.interact`, `TUNING.prompt`, `TUNING.hud`, `TUNING.subtitles`)

Reach, highlight strength and pulse, hold grace, hold view dip; prompt position, bar width, flash time, refresh
rate; HUD grid lines; caption time and max lines.

## Gotchas we hit

- **The HUD says what to do, never what's out there.** Tasks, prompts and progress go on the HUD; threats stay in
  sound and captions. It keeps the fear in the world.
- **Give every interactable its own materials** (`uniqueMaterials(object)`) or the highlight lights every object
  sharing that material.
- **Its own collider blocks its own ray.** Tag the interactable and its proxy the same (`tag: 'cabinet'`) so the
  occlusion test skips it.
- **Name the action, not the object.** "Turn on the light", not "Light switch". A blocked action says why, and what
  would fix it.
- **Draw pixel text 1:1 and scale up by whole numbers.** Scaling the canvas by a fraction or drawing it smaller blurs
  the glyphs. Unknown characters draw as `?`: add glyphs to `G` in `hand-font.js`.
- **Rebuild the prompt on a timer, redraw only on change.** Rebuilding canvases every frame makes garbage.
