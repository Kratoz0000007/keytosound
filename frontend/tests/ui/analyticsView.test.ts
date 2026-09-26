import { describe, it, expect } from 'vitest';
import { asPercent, barPercent, formatMs, keyLabel } from '../../src/ui/analyticsView';

describe('formatMs', () => {
  it('shows whole milliseconds under a second', () => {
    expect(formatMs(340)).toBe('340ms');
    expect(formatMs(12.4)).toBe('12ms');
  });

  it('shows seconds with one decimal from a second up', () => {
    expect(formatMs(1000)).toBe('1.0s');
    expect(formatMs(1234)).toBe('1.2s');
  });

  it('does not print 1000ms for values that round up to a second', () => {
    expect(formatMs(999.6)).toBe('1.0s');
  });
});

describe('barPercent', () => {
  it('scales against the largest value', () => {
    expect(barPercent(50, 200)).toBe(25);
    expect(barPercent(200, 200)).toBe(100);
  });

  it('is 0 when there is nothing to compare against', () => {
    expect(barPercent(0, 0)).toBe(0);
  });
});

describe('asPercent', () => {
  it('turns a share into a whole percentage', () => {
    expect(asPercent(0.72)).toBe('72%');
    expect(asPercent(0)).toBe('0%');
  });
});

describe('keyLabel', () => {
  it('names the space bar and leaves other keys alone', () => {
    expect(keyLabel(' ')).toBe('space');
    expect(keyLabel('e')).toBe('e');
  });
});
