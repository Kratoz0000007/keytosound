import { describe, it, expect } from 'vitest';
import { gust, SMOKE, SPOT, spawnPuff, spotlight, stepPuff } from '../../src/themes/jazz/stage';
import { approach, HOT_HOLD_MS, litBy, stageHeat } from '../../src/themes/stage/motion';

const W = 1200;
const H = 800;
const half = () => 0.5;

describe('stageHeat', () => {
  it('runs hot only above 60 wpm while the keys are still going', () => {
    expect(stageHeat(61, 100)).toBe(1);
    expect(stageHeat(60, 100)).toBe(0);
    expect(stageHeat(90, HOT_HOLD_MS + 1)).toBe(0);
  });
});

describe('approach', () => {
  it('closes 63% of the gap in one time constant, whatever the frame rate', () => {
    expect(approach(0, 1, 0.6, 0.6)).toBeCloseTo(1 - Math.exp(-1));
    let stepped = 0;
    for (let i = 0; i < 60; i++) stepped = approach(stepped, 1, 0.01, 0.6);
    expect(stepped).toBeCloseTo(approach(0, 1, 0.6, 0.6));
  });
});

describe('spotlight', () => {
  it('hangs one beam in each top corner, each leaning in toward the middle', () => {
    const left = spotlight(-1, 0, 0, W, H);
    const right = spotlight(1, 0, 0, W, H);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(W);
    expect(left.angle).toBeGreaterThan(0);
    expect(right.angle).toBeLessThan(0);
  });

  it('swings the two beams on mirrored sine waves', () => {
    const t = Math.PI / 2 / SPOT.swayRate;
    const left = spotlight(-1, t, 0, W, H);
    const right = spotlight(1, t, 0, W, H);
    expect(left.angle).toBeCloseTo(SPOT.aim + SPOT.sway);
    expect(right.angle).toBeCloseTo(-left.angle);
  });

  it('burns at 8% idle, and 15% and narrower when hot', () => {
    const idle = spotlight(-1, 0, 0, W, H);
    const hot = spotlight(-1, 0, 1, W, H);
    expect(idle.alpha).toBeCloseTo(0.08);
    expect(hot.alpha).toBeCloseTo(0.15);
    expect(hot.halfAngle).toBeLessThan(idle.halfAngle);
  });
});

describe('litBy', () => {
  it('is brightest on the centre line and dark outside the beam', () => {
    const cone = spotlight(-1, 0, 0, W, H);
    const along = (d: number, off = 0) => [
      cone.x + Math.sin(cone.angle + off) * d,
      cone.y + Math.cos(cone.angle + off) * d,
    ];
    const [cx, cy] = along(400);
    const [ex, ey] = along(400, cone.halfAngle * 2);
    expect(litBy(cone, cx, cy)).toBeCloseTo(1);
    expect(litBy(cone, ex, ey)).toBe(0);
    expect(litBy(cone, cone.x, cone.y - 50)).toBe(0);
  });
});

describe('smoke', () => {
  it('rises, and a keystroke draft pushes it right', () => {
    const still = spawnPuff(W, H, half, true);
    const blown = { ...still };
    stepPuff(still, 1, 0, 0, W, H, half);
    stepPuff(blown, 1, 0, 1, W, H, half);
    expect(still.y).toBeLessThan(H * 0.5);
    expect(blown.x - still.x).toBeCloseTo(SMOKE.draftSpeed);
  });

  it('comes back in at the bottom once it leaves the top', () => {
    const puff = spawnPuff(W, H, half, true);
    puff.y = -puff.r - 1;
    stepPuff(puff, 0, 0, 0, W, H, half);
    expect(puff.y).toBeGreaterThan(H);
  });

  it('gusts on each keystroke, up to a cap', () => {
    expect(gust(0, 1)).toBeCloseTo(SMOKE.gust);
    expect(gust(0.9, 5)).toBe(SMOKE.maxDraft);
  });
});
