import { describe, it, expect } from 'vitest';
import { MusicEngine, renderSession } from '../../src/engine/engine';
import { GENRES } from '../../src/engine/presets';
import { SCALES, clashesWithChord, isChordTone, pitchClass } from '../../src/engine/theory';
import { motifSteps } from '../../src/engine/motif';
import { TypingAnalyzer } from '../../src/typing/analyzer';
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
    timestamp: 0,
    wordPrefix: 'a',
    isEnter: false,
    digit: null,
    ...overrides,
  };
}

/**
 * Types text through the real analyzer with a deterministic, human-ish rhythm,
 * the way live typing and replay both feed the engine.
 */
function featuresFromText(text: string): TypingFeatures[] {
  const analyzer = new TypingAnalyzer();
  const out: TypingFeatures[] = [];
  let t = 0;
  let i = 0;
  for (const ch of text) {
    const key = ch === '\n' ? 'Enter' : ch;
    t += ' .,!?\n'.includes(ch) ? 220 : 120 + ((i * 37) % 160);
    i += 1;
    out.push(analyzer.process({ key, timestamp: t }));
  }
  return out;
}

/** A deterministic stand-in for someone typing a sentence. */
function sentenceFeatures(): TypingFeatures[] {
  return featuresFromText('rain falls softly on the quiet harbour tonight.');
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

  it('takes its chord from the bar clock, not from word count', () => {
    const engine = new MusicEngine(preset, 42);
    engine.step(features({ wordLength: 5 }));
    expect(engine.getState().chordIndex).toBe(0);
    engine.step(features({ timestamp: engine.barMs * 2 + 10 }));
    expect(engine.getState().chordIndex).toBe(2);
    expect(engine.getState().currentChord).toEqual(engine.harmonyAt(2).chord);
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
        const event = engine.step(ft);
        if (!event) continue;
        notes += 1;
        // The chord actually sounding when the note was chosen.
        const chord = engine.getState().currentChord;
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

describe('sentence as score', () => {
  const lofi = GENRES.lofi;

  /** Pitches a word produced, located by its position in the text. */
  function wordPitches(text: string, word: string, occurrence: number, seed = 7): number[] {
    const engine = new MusicEngine(lofi, seed);
    const feats = featuresFromText(text);
    let start = -1;
    let from = 0;
    for (let n = 0; n <= occurrence; n++) {
      start = text.indexOf(word, from);
      from = start + 1;
    }
    const out: number[] = [];
    feats.forEach((f, i) => {
      const event = engine.step(f);
      if (i >= start && i < start + word.length && event) out.push(event.pitch);
    });
    return out;
  }

  it('gives no letter a fixed note', () => {
    const engine = new MusicEngine(lofi, 11);
    const text = (PROSE + ' ').repeat(3);
    const pitchesByLetter = new Map<string, Set<number>>();
    featuresFromText(text).forEach((f, i) => {
      const event = engine.step(f);
      const ch = text[i];
      if (!event || !/[a-z]/.test(ch)) return;
      if (!pitchesByLetter.has(ch)) pitchesByLetter.set(ch, new Set());
      pitchesByLetter.get(ch)!.add(event.pitch);
    });
    for (const letter of ['e', 't', 'o', 'a', 's']) {
      expect(pitchesByLetter.get(letter)!.size).toBeGreaterThanOrEqual(5);
    }
  });

  it('plays a repeated word with the same shape', () => {
    const text = 'rain on the harbour. slow rain over the quiet town.';
    const shape = (p: number[]) => p.slice(1).map((x, i) => Math.sign(x - p[i]));
    const first = wordPitches(text, 'rain', 0);
    const second = wordPitches(text, 'rain', 1);
    expect(first).toHaveLength(4);
    expect(second).toHaveLength(4);
    // Direction of every move matches; the clash nudge may resize a step.
    expect(shape(second)).toEqual(shape(first));
  });

  it('shares an opening between words that share a prefix', () => {
    expect(motifSteps('rainbow').slice(0, 3)).toEqual(motifSteps('rain'));
  });

  it('never turns a digit into a melody note', () => {
    const engine = new MusicEngine(lofi, 3);
    for (const d of [1, 2, 5, 9, 0]) {
      expect(engine.step(features({ digit: d, timestamp: 400 }))).toBeNull();
    }
  });

  it('lets a digit edit the beat', () => {
    const engine = new MusicEngine(lofi, 3);
    const sixteenth = engine.barMs / 16;
    expect(engine.beatHas('clap', 4)).toBe(false);
    engine.step(features({ digit: 5, timestamp: sixteenth * 4 }));
    expect(engine.beatHas('clap', 4)).toBe(true);
    expect(engine.lastBeatEdit).toMatchObject({ voice: 'clap', added: true });
  });

  it('does not let digits disturb the word being typed', () => {
    const plain = renderSession(featuresFromText('rain falls.'), lofi, 5);
    const analyzer = new TypingAnalyzer();
    const mixed: TypingFeatures[] = [];
    let t = 0;
    let i = 0;
    for (const ch of 'ra1in fa5lls.') {
      if (/[0-9]/.test(ch)) {
        mixed.push(analyzer.process({ key: ch, timestamp: t + 5 }));
        continue;
      }
      t += ' .,!?'.includes(ch) ? 220 : 120 + ((i * 37) % 160);
      i += 1;
      mixed.push(analyzer.process({ key: ch, timestamp: t }));
    }
    expect(renderSession(mixed, lofi, 5)).toEqual(plain);
  });

  it('resolves the band to the tonic after a full stop', () => {
    const engine = new MusicEngine(lofi, 3);
    const feats = featuresFromText('the night is long.');
    feats.forEach((f) => engine.step(f));
    const stopBar = Math.floor(feats[feats.length - 1].timestamp / engine.barMs);
    const cadenceBar = [stopBar + 1, stopBar + 2].find(
      (b) => engine.harmonyAt(b).cadence === 'full',
    );
    expect(cadenceBar).toBeDefined();
    expect(engine.harmonyAt(cadenceBar!).chord).toEqual(lofi.progression[0]);
  });

  it('modulates on Enter', () => {
    const engine = new MusicEngine(lofi, 3);
    const feats = featuresFromText('first line\nsecond line of text here');
    feats.forEach((f) => engine.step(f));
    expect(engine.getState().keyRoot).not.toBe(lofi.keyRoot);
  });

  it('scores every note against the chord the band plays in that bar', () => {
    const engine = new MusicEngine(lofi, 3);
    for (const f of featuresFromText(PROSE)) {
      const event = engine.step(f);
      if (!event) continue;
      const bar = Math.floor(f.timestamp / engine.barMs);
      expect(engine.getState().currentChord).toEqual(engine.harmonyAt(bar).chord);
    }
  });
});

describe('articulation', () => {
  const lofi = GENRES.lofi;

  function articulations(text: string): { ch: string; articulation: string }[] {
    const engine = new MusicEngine(lofi, 9);
    const out: { ch: string; articulation: string }[] = [];
    featuresFromText(text).forEach((f, i) => {
      const event = engine.step(f);
      if (event) out.push({ ch: text[i], articulation: event.articulation });
    });
    return out;
  }

  it('slurs the letters inside a word into one line', () => {
    const notes = articulations('rain');
    expect(notes.map((n) => n.articulation)).toEqual(['phrase', 'slur', 'slur', 'slur']);
  });

  it('starts every word with a soft phrase attack', () => {
    const starts = articulations('rain falls on the harbour').filter((n) => n.articulation === 'phrase');
    expect(starts.map((n) => n.ch)).toEqual(['r', 'f', 'o', 't', 'h']);
  });

  it('strikes punctuation cleanly', () => {
    const period = articulations('rain falls.').find((n) => n.ch === '.');
    expect(period?.articulation).toBe('strike');
  });

  it('slurs the landing note and the erase gesture', () => {
    const engine = new MusicEngine(lofi, 9);
    const feats = featuresFromText('rain ');
    let landing = null;
    for (const f of feats) landing = engine.step(f) ?? landing;
    expect(landing?.articulation).toBe('slur');
    const erased = engine.step(features({ isBackspace: true, timestamp: 2000 }));
    expect(erased?.articulation).toBe('slur');
  });
});
