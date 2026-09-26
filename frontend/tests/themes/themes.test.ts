import { describe, it, expect } from 'vitest';
import { FALLBACK_THEME, themeFor } from '../../src/themes/themes';

describe('themeFor', () => {
  it('gives a themed genre its own theme', () => {
    expect(themeFor('synthwave')).toBe('synthwave');
  });

  it('falls back for a genre with no theme yet', () => {
    expect(themeFor('polka')).toBe(FALLBACK_THEME);
  });
});
