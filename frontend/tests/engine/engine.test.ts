import { describe, it, expect } from 'vitest';
import { MusicEngine, renderSession } from '../../src/engine/engine';
import { GENRES } from '../../src/engine/presets';
import { SCALES, clashesWithChord, isChordTone, pitchClass } from '../../src/engine/theory';
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

  it('descends on backspace instead of repeating', () => {
    const engine = new MusicEngine(preset, 42);
    const typed = engine.step(features())!;
    const erased = engine.step(features({ isBackspace: true }))!;
    expect(erased.pitch).toBeLessThan(typed.pitch);
  });

  it('never repeats a pitch while holding backspace', () => {
    // The whole point of replacing echoPrevious: deleting a long passage used
    // to replay one note forever.
    const engine = new MusicEngine(preset, 42);
    for (let i = 0; i < 5; i++) engine.step(features());
    const erased: number[] = [];
    for (let i = 0; i < 30; i++) {
      const event = engine.step(features({ isBackspace: true }));
      if (event) erased.push(event.pitch);
    }
    expect(erased.length).toBeGreaterThan(0);
    for (let i = 1; i < erased.length; i++) {
      expect(erased[i]).toBeLessThan(erased[i - 1]);
    }
  });

  it('falls silent once erasing reaches the bottom of the register', () => {
    const engine = new MusicEngine(preset, 42);
    for (let i = 0; i < 200; i++) engine.step(features({ isBackspace: true }));
    expect(engine.step(features({ isBackspace: true }))).toBeNull();
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

/** Builds a feature stream from prose, the way the analyzer would. */
function featuresFromText(text: string): TypingFeatures[] {
  const out: TypingFeatures[] = [];
  let buf = '';
  for (const ch of text) {
    if (' .,!?'.includes(ch)) {
      const punctuation =
        ch === '.' ? 'period' : ch === ',' ? 'comma' : ch === '!' ? 'exclamation' : ch === '?' ? 'question' : 'none';
      out.push(features({ wordLength: buf.length, punctuation, interval: 200 }));
      buf = '';
    } else {
      buf += ch;
      out.push(features({ interval: 120 + ((buf.length * 37) % 160) }));
    }
  }
  return out;
}

const PROSE =
  'the quick brown fox jumps over the lazy dog. typing should sound like music, ' +
  'not like a soundboard. it evolves as you write! does it hold up over a longer passage?';

/**
 * These are the musical invariants that separate this from a soundboard, and
 * they are the first thing casual weight-tuning breaks. Thresholds are loose
 * enough to permit taste, tight enough to catch a regression: before the
 * interval weight and temperature were tuned, big leaps ran at 17%.
 */
describe('melodic quality', () => {
  for (const id of Object.keys(GENRES)) {
    describe(id, () => {
      const events = renderSession(featuresFromText(PROSE), GENRES[id], 4242);
      const pitches = events.map((e) => e.pitch);
      const intervals = pitches.slice(1).map((p, i) => Math.abs(p - pitches[i]));
      const share = (fn: (d: number) => boolean) =>
        intervals.filter(fn).length / intervals.length;

      it('moves mostly by step', () => {
        expect(share((d) => d >= 1 && d <= 3)).toBeGreaterThan(0.5);
      });

      it('leaps an octave only rarely', () => {
        expect(share((d) => d >= 8)).toBeLessThan(0.12);
      });

      it('still leaps sometimes rather than only running scales', () => {
        expect(share((d) => d >= 4)).toBeGreaterThan(0.05);
      });

      it('uses a decent spread of pitches', () => {
        expect(new Set(pitches).size).toBeGreaterThanOrEqual(8);
      });

      it('never hammers one pitch', () => {
        let longest = 1;
        let run = 1;
        for (let i = 1; i < pitches.length; i++) {
          run = pitches[i] === pitches[i - 1] ? run + 1 : 1;
          longest = Math.max(longest, run);
        }
        expect(longest).toBeLessThanOrEqual(4);
      });
    });
  }
});

/**
 * Harmonic quality is a separate axis from melodic shape, and the seven-note
 * scales Jazz and Classical use are where it can go wrong: adjacent diatonic
 * degrees are 1-2 semitones apart, so a careless weighting fills the melody
 * with minor seconds against the chord. Classical measured 21% before the
 * clash penalty existed; the pentatonic genres sit around 5-7%.
 */
describe('harmonic quality', () => {
  for (const id of Object.keys(GENRES)) {
    it(`${id} rarely clashes by a semitone with the current chord`, () => {
      const preset = GENRES[id];
      const engine = new MusicEngine(preset, 4242);
      let clashes = 0;
      let notes = 0;

      for (const ft of featuresFromText(PROSE)) {
        const chordIndex = engine.getState().chordIndex;
        const event = engine.step(ft);
        if (!event) continue;
        notes += 1;
        const chord = preset.progression[chordIndex % preset.progression.length];
        if (clashesWithChord(event.pitch, chord) && !isChordTone(event.pitch, chord)) {
          clashes += 1;
        }
      }

      expect(notes).toBeGreaterThan(50);
      expect(clashes / notes).toBeLessThan(0.12);
    });
  }
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
