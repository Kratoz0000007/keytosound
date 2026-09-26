import { describe, it, expect } from 'vitest';
import { isBeatKey, mascotTempo } from '../../src/ui/mascots/motion';

describe('isBeatKey', () => {
  it('counts space and the drum keys 1-8 as beats', () => {
    for (const key of [' ', '1', '4', '8']) expect(isBeatKey(key)).toBe(true);
  });

  it('does not count letters, 9, 0 or named keys', () => {
    for (const key of ['a', '9', '0', 'Enter', ',']) expect(isBeatKey(key)).toBe(false);
  });
});

describe('mascotTempo', () => {
  it('loops slowly at rest', () => {
    expect(mascotTempo(0)).toBe(1.5);
  });

  it('speeds up as typing speeds up', () => {
    expect(mascotTempo(60)).toBeLessThan(mascotTempo(20));
  });

  it('never goes faster than 0.3s a loop', () => {
    expect(mascotTempo(300)).toBe(0.3);
  });

  it('treats a negative speed as rest', () => {
    expect(mascotTempo(-5)).toBe(1.5);
  });
});
