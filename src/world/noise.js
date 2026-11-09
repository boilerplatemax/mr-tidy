// Noise events (build prompt 0.5, 6, 7): anything that makes a sound the house can react to goes through here. The vac's
// ears (step 12) and Grandma's wake meter (step 9) listen on this one bus.
// An event: { kind: 'crash' | 'step' | 'thud', x, y, z, loud (points for a crash), room, objectId? }
export class Noise {
  constructor() { this.listeners = []; this.last = null; this.count = 0; }
  /** fn(event) for every noise. */
  on(fn) { this.listeners.push(fn); }
  emit(ev) { this.last = ev; this.count++; for (const fn of this.listeners) fn(ev); }
}
