import { describe, it, expect } from 'vitest';
import { THEME } from '../../src/themes/themes';

describe('THEME', () => {
  it('is the synthwave theme', () => {
    expect(THEME).toBe('synthwave');
  });
});
