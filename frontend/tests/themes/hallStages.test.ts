import { describe, it, expect } from 'vitest';
import {
  CEILING,
  ceilingLight,
  liveRipples,
  STAVE,
  staveEnergy,
  staveLineY,
  staveOffset,
} from '../../src/themes/classical/stage';
import { flightMs, launch, notationEffects, typingWpm } from '../../src/themes/fx/notation';
import { litBy, rippleEnvelope } from '../../src/themes/stage/motion';

const W = 1200;
const H = 800;

describe('rippleEnvelope', () => {
  const ripple = { x: 300, y: 400, bornMs: 0 };

  it('peaks on the front as it runs outward, on both sides of the caret', () => {
    // After 0.5s at 400 px/s the front is 200px out.
    const at = (x: number) => rippleEnvelope(ripple, x, 400, 500, 400, 2, 50, 1000);
    expect(at(500)).toBeGreaterThan(at(300));
    expect(at(100)).toBeCloseTo(at(500));
  });

  it('is gone once the ripple has died, and fainter far from where it started', () => {
    expect(rippleEnvelope(ripple, 300, 400, 2500, 400, 2, 50, 1000)).toBe(0);
    const near = rippleEnvelope(ripple, 300, 400, 0, 400, 2, 50, 200);
    const far = rippleEnvelope(ripple, 300, 800, 0, 400, 2, 50, 200);
    expect(far).toBeLessThan(near);
  });
});

describe('Classical stage', () => {
  it('rules five evenly spaced stave lines', () => {
    const ys = [0, 1, 2, 3, 4].map((i) => staveLineY(i, H));
    for (let i = 1; i < 5; i++) expect(ys[i] - ys[i - 1]).toBe(STAVE.gap);
  });

  it('lies flat until a keystroke sends a ripple along it', () => {
    const y = staveLineY(2, H);
    expect(staveOffset([], 300, y, 1000)).toBe(0);
    const ripple = [{ x: 300, y, bornMs: 1000 }];
    expect(staveEnergy(ripple, 300, y, 1000)).toBeCloseTo(1);
  });

  it('forgets ripples once they have died away', () => {
    const ripples = [
      { x: 0, y: 0, bornMs: 0 },
      { x: 0, y: 0, bornMs: 5000 },
    ];
    expect(liveRipples(ripples, 5100)).toHaveLength(1);
  });

  it('keeps the ceiling light dark at rest and at 6% when hot, lighting the middle of the room', () => {
    expect(ceilingLight(0, 0, W, H).alpha).toBe(0);
    const hot = ceilingLight(0, 1, W, H);
    expect(hot.alpha).toBeCloseTo(CEILING.alpha);
    expect(litBy(hot, W / 2, H / 2)).toBeGreaterThan(0.9);
    expect(litBy(hot, 20, H / 2)).toBe(0);
  });
});

describe('notationEffects', () => {
  it('floats a note on letters only; digits are drums', () => {
    expect(notationEffects('m').note).toBe(true);
    expect(notationEffects('é').note).toBe(true);
    expect(notationEffects('3').note).toBe(false);
    expect(notationEffects('.').note).toBe(false);
  });

  it('sweeps the borders on space and Enter', () => {
    expect(notationEffects(' ').sweep).toBe(true);
    expect(notationEffects('Enter').sweep).toBe(true);
    expect(notationEffects('a').sweep).toBe(false);
  });
});

describe('notes flying into the ear', () => {
  it('reads typing speed off keystroke times, five characters a word', () => {
    // Ten keys a second is 120 wpm.
    expect(typingWpm([0, 100, 200, 300])).toBeCloseTo(120);
    expect(typingWpm([0])).toBe(0);
  });

  it('flies faster as the typing speeds up, within bounds', () => {
    expect(flightMs(0)).toBe(900);
    expect(flightMs(60)).toBeLessThan(flightMs(20));
    expect(flightMs(300)).toBe(320);
  });

  it('launches a note so it lands exactly on the target under gravity', () => {
    const from = { x: 100, y: 200 };
    const to = { x: 400, y: 600 };
    const g = 900;
    const { vx, vy } = launch(from, to, 500, g);
    const t = 0.5;
    expect(from.x + vx * t).toBeCloseTo(to.x);
    expect(from.y + vy * t + (g * t * t) / 2).toBeCloseTo(to.y);
  });
});
