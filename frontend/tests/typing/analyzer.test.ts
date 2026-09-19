import { describe, it, expect } from 'vitest';
import { TypingAnalyzer } from '../../src/typing/analyzer';
import type { KeyEvent, TypingFeatures } from '../../src/typing/types';

function type(analyzer: TypingAnalyzer, text: string, intervalMs = 150): TypingFeatures[] {
  const out: TypingFeatures[] = [];
  let t = 0;
  for (const ch of text) {
    const ev: KeyEvent = { key: ch, timestamp: t };
    out.push(analyzer.process(ev));
    t += intervalMs;
  }
  return out;
}

describe('TypingAnalyzer', () => {
  it('reports zero interval on the first keystroke', () => {
    const a = new TypingAnalyzer();
    const f = a.process({ key: 'a', timestamp: 1000 });
    expect(f.interval).toBe(0);
  });

  it('measures the interval between keystrokes', () => {
    const a = new TypingAnalyzer();
    a.process({ key: 'a', timestamp: 1000 });
    const f = a.process({ key: 'b', timestamp: 1180 });
    expect(f.interval).toBe(180);
  });

  it('reports wordLength 0 while mid-word', () => {
    const a = new TypingAnalyzer();
    const results = type(a, 'cat');
    expect(results.map((r) => r.wordLength)).toEqual([0, 0, 0]);
  });

  it('reports wordLength on the space that completes a word', () => {
    const a = new TypingAnalyzer();
    const results = type(a, 'cat ');
    expect(results[3].wordLength).toBe(3);
  });

  it('advances sentencePos across words', () => {
    const a = new TypingAnalyzer();
    const results = type(a, 'ab cd ');
    expect(results[2].sentencePos).toBe(0);
    expect(results[5].sentencePos).toBe(1);
  });

  it('resets sentencePos after a period', () => {
    const a = new TypingAnalyzer();
    const results = type(a, 'ab cd. ef ');
    const afterPeriod = results[results.length - 1];
    expect(afterPeriod.sentencePos).toBe(0);
  });

  it('classifies punctuation', () => {
    const a = new TypingAnalyzer();
    expect(a.process({ key: '.', timestamp: 0 }).punctuation).toBe('period');
    expect(a.process({ key: ',', timestamp: 100 }).punctuation).toBe('comma');
    expect(a.process({ key: '!', timestamp: 200 }).punctuation).toBe('exclamation');
    expect(a.process({ key: '?', timestamp: 300 }).punctuation).toBe('question');
    expect(a.process({ key: 'x', timestamp: 400 }).punctuation).toBe('none');
  });

  it('detects capitals and backspace', () => {
    const a = new TypingAnalyzer();
    expect(a.process({ key: 'A', timestamp: 0 }).isCapital).toBe(true);
    expect(a.process({ key: 'a', timestamp: 100 }).isCapital).toBe(false);
    expect(a.process({ key: 'Backspace', timestamp: 200 }).isBackspace).toBe(true);
  });

  it('reports pauseDuration only above the threshold', () => {
    const a = new TypingAnalyzer();
    a.process({ key: 'a', timestamp: 0 });
    expect(a.process({ key: 'b', timestamp: 100 }).pauseDuration).toBe(0);
    expect(a.process({ key: 'c', timestamp: 1200 }).pauseDuration).toBe(1100);
  });

  it('computes higher WPM for faster typing', () => {
    const fast = new TypingAnalyzer();
    const slow = new TypingAnalyzer();
    const fastResults = type(fast, 'abcdefgh', 80);
    const slowResults = type(slow, 'abcdefgh', 400);
    const lastFast = fastResults[fastResults.length - 1].speed;
    const lastSlow = slowResults[slowResults.length - 1].speed;
    expect(lastFast).toBeGreaterThan(lastSlow);
  });

  it('is reset to its initial state by reset()', () => {
    const a = new TypingAnalyzer();
    type(a, 'hello world ');
    a.reset();
    const f = a.process({ key: 'x', timestamp: 99999 });
    expect(f.interval).toBe(0);
    expect(f.sentencePos).toBe(0);
  });
});
