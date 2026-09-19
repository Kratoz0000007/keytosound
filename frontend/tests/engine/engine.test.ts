import { describe, it, expect } from 'vitest';
import { MusicEngine, renderSession } from '../../src/engine/engine';
import { GENRES } from '../../src/engine/presets';
import { SCALES, pitchClass } from '../../src/engine/theory';
import type { TypingFeatures } from '../../src/typing/types';

const preset = GENRES.lofi;

function features(overrides: Partial<TypingFeatures> = {}): TypingFeatures {
  return {
    interval: 180,
    speed: 45,
    wordLength: 0,
    sentencePos: 0,
    pauseDuration: 0,
    punctuation: 'none',
    isCapital: false,
    isBackspace: false,
    ...overrides,
  };
}

/** A deterministic stand-in for someone typing a sentence. */
function sentenceFeatures(): TypingFeatures[] {
  const out: TypingFeatures[] = [];
  const words = [4, 7, 3, 9, 5];
  for (let w = 0; w < words.length; w++) {
    for (let c = 0; c < words[w]; c++) {
      out.push(features({ interval: 120 + ((c * 37) % 180), sentencePos: w }));
    }
    const last = w === words.length - 1;
    out.push(
      features({
        wordLength: words[w],
        sentencePos: w,
        punctuation: last ? 'period' : 'none',
        interval: 200,
      }),
    );
  }
  return out;
}

describe('MusicEngine', () => {
  it('emits an event for an ordinary keystroke', () => {
    const engine = new MusicEngine(preset, 42);
    const event = engine.step(features());
    expect(event).not.toBeNull();
    expect(event!.pitch).toBeGreaterThan(0);
    expect(event!.velocity).toBeGreaterThan(0);
    expect(event!.durationBeats).toBeGreaterThan(0);
  });

  it('emits no event for a comma (a rest)', () => {
    const engine = new MusicEngine(preset, 42);
    expect(engine.step(features({ punctuation: 'comma' }))).toBeNull();
  });

  it('repeats the previous pitch on backspace', () => {
    const engine = new MusicEngine(preset, 42);
    const first = engine.step(features())!;
    const echo = engine.step(features({ isBackspace: true }))!;
    expect(echo.pitch).toBe(first.pitch);
  });

  it('advances the chord on a word boundary', () => {
    const engine = new MusicEngine(preset, 42);
    const before = engine.getState().chordIndex;
    engine.step(features({ wordLength: 5 }));
    expect(engine.getState().chordIndex).toBe(before + 1);
  });

  it('keeps every emitted pitch in the active scale', () => {
    const events = renderSession(sentenceFeatures(), preset, 99);
    const degrees = SCALES[preset.scale];
    for (const event of events) {
      expect(degrees).toContain(pitchClass(event.pitch - preset.keyRoot));
    }
  });

  it('tracks contour direction and momentum', () => {
    const engine = new MusicEngine(preset, 8);
    for (let i = 0; i < 10; i++) engine.step(features());
    const state = engine.getState();
    expect([-1, 0, 1]).toContain(state.contourDirection);
    expect(state.contourMomentum).toBeGreaterThanOrEqual(0);
  });

  it('bounds recentPitches so state cannot grow without limit', () => {
    const engine = new MusicEngine(preset, 8);
    for (let i = 0; i < 200; i++) engine.step(features());
    expect(engine.getState().recentPitches.length).toBeLessThanOrEqual(8);
  });

  it('returns to its initial state after reset()', () => {
    const engine = new MusicEngine(preset, 42);
    const first = engine.step(features())!;
    for (let i = 0; i < 20; i++) engine.step(features());
    engine.reset();
    expect(engine.step(features())!.pitch).toBe(first.pitch);
  });
});

describe('determinism contract', () => {
  it('produces an identical note sequence for identical input and seed', () => {
    const session = sentenceFeatures();
    const first = renderSession(session, preset, 1234);
    const second = renderSession(session, preset, 1234);
    expect(second).toEqual(first);
  });

  it('produces a different sequence for a different seed', () => {
    const session = sentenceFeatures();
    const a = renderSession(session, preset, 1);
    const b = renderSession(session, preset, 2);
    expect(b).not.toEqual(a);
  });

  it('produces a different sequence for a different genre', () => {
    const session = sentenceFeatures();
    const a = renderSession(session, GENRES.lofi, 1234);
    const b = renderSession(session, GENRES.eightbit, 1234);
    expect(b).not.toEqual(a);
  });
});
