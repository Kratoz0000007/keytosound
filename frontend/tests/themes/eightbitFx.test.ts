import { describe, it, expect } from 'vitest';
import { eightbitEffects } from '../../src/themes/fx/eightbit';

describe('eightbitEffects', () => {
  it('bursts pixels on a letter, without a flash', () => {
    expect(eightbitEffects('a')).toEqual({ burst: true, flash: false });
    expect(eightbitEffects('Q')).toEqual({ burst: true, flash: false });
  });

  it('bursts and flashes on a digit, which is also a beat key', () => {
    expect(eightbitEffects('7')).toEqual({ burst: true, flash: true });
  });

  it('flashes on space and punctuation', () => {
    expect(eightbitEffects(' ')).toEqual({ burst: false, flash: true });
    expect(eightbitEffects(',')).toEqual({ burst: false, flash: true });
    expect(eightbitEffects('?')).toEqual({ burst: false, flash: true });
  });

  it('ignores named keys', () => {
    expect(eightbitEffects('Enter')).toEqual({ burst: false, flash: false });
    expect(eightbitEffects('Backspace')).toEqual({ burst: false, flash: false });
  });
});
