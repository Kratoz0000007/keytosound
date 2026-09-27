import { describe, it, expect } from 'vitest';
import { classicalEffects } from '../../src/themes/fx/classical';
import { jazzEffects } from '../../src/themes/fx/jazz';
import { lofiEffects } from '../../src/themes/fx/lofi';

describe('lofiEffects', () => {
  it('glows on letters and digits', () => {
    expect(lofiEffects('k').glow).toBe(true);
    expect(lofiEffects('3').glow).toBe(true);
    expect(lofiEffects(',').glow).toBe(false);
  });

  it('fires the backlight on space and the beat keys 1-8 only', () => {
    expect(lofiEffects(' ').backlight).toBe(true);
    expect(lofiEffects('8').backlight).toBe(true);
    expect(lofiEffects('9').backlight).toBe(false);
    expect(lofiEffects('a').backlight).toBe(false);
  });
});

describe('jazzEffects', () => {
  it('throws sparks on letters and digits', () => {
    expect(jazzEffects('q').sparks).toBe(true);
    expect(jazzEffects(' ').sparks).toBe(false);
  });

  it('scratches the record on space and Enter', () => {
    expect(jazzEffects(' ').scratch).toBe(true);
    expect(jazzEffects('Enter').scratch).toBe(true);
    expect(jazzEffects('5').scratch).toBe(false);
  });
});

describe('classicalEffects', () => {
  it('floats a note on letters and digits', () => {
    expect(classicalEffects('m').note).toBe(true);
    expect(classicalEffects('.').note).toBe(false);
  });

  it('sweeps the border on space and Enter', () => {
    expect(classicalEffects(' ').sweep).toBe(true);
    expect(classicalEffects('Enter').sweep).toBe(true);
    expect(classicalEffects('Backspace').sweep).toBe(false);
  });
});
