# <GAME NAME> — Build Prompts

> **How to use this template:** copy it to `build-prompts.md` and write your own milestones in the format below.
> Delete these quote blocks when you're done.

An ordered set of prompts for the agent building <GAME NAME>. **Each prompt is one milestone:** don't start the next
until the current one's "Done when" list passes and the agent has reported back. The agent's standing rules are in
`CLAUDE.md`; the design is in `game-design-document.md`. These prompts don't repeat those files; they point at them.

**The four things every prompt is judged on:**

1. **Atmosphere:** does it look, sound and feel like *this* game?
2. **Smoothness:** 60 fps, responsive controls, no stutter, no friction that isn't designed.
3. **A clean world:** nothing glitched, floating, clipping or z-fighting, and nowhere to get stuck.
4. **Payoff:** does it set something up or pay something off?

---

## How to use this file

- **One milestone per session.** Start each one with the *Session opener* below with the milestone's prompt pasted
  under it. When it's done, `/clear` and start the next one fresh. Or run a batch unattended:
  `.\run-milestones.ps1 -Prompts "1","2","2B"` (quote ids with letters).
- **After each milestone**, play it yourself for five minutes and answer the agent's playtest questions. Your answers
  are the most valuable input in the whole process.
- **Build to a First Playable early** (the smallest loop that proves the game is scary) and play it hard before
  building more.

### Session opener

```text
You're the lead game designer and developer on <GAME NAME>. CLAUDE.md is already loaded.
Read the latest entries in docs/design-log.md (if it exists) and the parts of
game-design-document.md this milestone needs. Do only the milestone below, then stop and report.

<paste the prompt here>
```

---

## Prompt 0: Project setup

```text
The starter kit is already in place (see README.md and docs/). Rename it for this game: set TUNING.game.title and
TUNING.game.storagePrefix, the <title> in index.html, and the README's first lines. Create docs/design-log.md with a
first entry. Audit the asset library: list every folder and what's useful, in docs/asset-audit.md. Leave the demo
scene in place for now.

Done when: the page loads with no console errors under the new name, and the asset audit exists.
```

## Prompt 1: The first space (grey box)

```text
Replace src/demo/ with the game's first real space, in grey box: the layout from the GDD's <section>, at real scale,
with hand-placed colliders, light zones for each room, indoor boxes, footstep surfaces and the fog the GDD describes.
No art yet: pixel textures painted in code. Walk every wall and doorway standing and crouched.

Done when: you can walk the whole space with no stuck spots, no light leaks at night, the overlay shows 60 fps on
integrated graphics, and the validation pass is clean.
```

## Prompt <N>: <milestone name>

```text
<What to build, in the player's terms first: what they see, hear and do. Then the systems it needs, the rules it must
keep (point at CLAUDE.md sections rather than repeating them), and what it must NOT do.>

<Edge cases and how each should feel.>

Done when: <a short checklist a human can verify by playing: observable outcomes, not implementation details>.
```

> Tips for writing prompts that work:
> - One milestone = one thing the player can feel. If it needs two "Done when" lists, it's two prompts.
> - Say what's out of scope. Agents fill silence with features.
> - Write "Done when" as things you can check by playing, plus "no console errors" and "60 fps".
> - Big prompts need a turn budget (`-MaxTurns`) or a split into A / B parts.
> - Add playtest fixes as their own lettered prompts (4B, 4C) rather than editing done ones.
