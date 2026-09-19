# Typing-to-Music Engine Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, musically coherent typing-to-music engine and make it audible in the browser — type into a surface and hear an evolving melody over a backing band.

**Architecture:** A pure TypeScript engine (no DOM, no React, no Tone.js, no clock, no `Math.random`) converts `TypingFeatures` into `MusicalEvent`s via a six-term weighted scoring function over scale-constrained candidate pitches. Adapters around it handle keyboard capture on one side and Tone.js scheduling on the other. The engine's determinism is the foundation everything else in Plans 2 and 3 rests on.

**Tech Stack:** Vite, React 19, TypeScript (strict), Vitest, Tone.js, Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-09-19-typing-to-music-design.md`

## Global Constraints

These apply to every task. Copied verbatim from the spec.

- **Determinism contract:** `(keystroke stream, settings, seed) -> identical note sequence, always.` The engine uses a seeded PRNG. It never calls `Math.random()` and never reads the clock.
- **Engine purity:** Nothing under `src/engine/` or `src/typing/` may import React, Tone.js, or touch `window`, `document`, `performance`, or `Date`. These directories must run unmodified in Node.
- **Timing model:** Quantized. The engine emits durations in **beats**; only the scheduler converts to wall-clock time.
- **Scale safety:** All three shipping genres use pentatonic scales (`majorPentatonic` or `minorPentatonic`). Seven-note modes are out of scope for this plan.
- **Shipping scope:** 3 genres (Lo-Fi, Synthwave, 8-Bit), 5 instruments (`piano`, `synthLead`, `electricPiano`, `bass`, `eightBit`).
- **No WebSockets.** Not in this plan, not in any plan. Stretch goal only.
- **TypeScript strict mode on.** No `any` in committed code.

---

## File Structure

```
frontend/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  src/
    typing/                  # knows about keyboards, knows nothing about music
      types.ts               # KeyEvent, TypingFeatures, PunctuationClass
      analyzer.ts            # TypingAnalyzer: KeyEvent -> TypingFeatures
      capture.ts             # DOM adapter (only file here touching the DOM)
    engine/                  # knows about music, knows nothing about keyboards
      types.ts               # MusicalState, MusicalEvent, Chord, MappedParams
      prng.ts                # seeded PRNG
      theory.ts              # scales, pitch classes, chord tones
      presets.ts             # GenrePreset type + the 3 shipping genres
      mapper.ts              # TypingFeatures -> MappedParams
      scoring.ts             # the six scorers, each a pure function
      transition.ts          # candidate generation, softmax, sampling
      engine.ts              # MusicEngine facade; owns MusicalState
    audio/                   # Tone.js adapter; makes no musical decisions
      instruments.ts         # instrument factory
      scheduler.ts           # beat -> wall-clock grid placement
      backing.ts             # drums, bass, chord pad per genre
      audioEngine.ts         # composes the above; the only Tone.js entry point
    ui/
      App.tsx
      TypingSurface.tsx
    main.tsx
    index.css
  tests/
    typing/analyzer.test.ts
    engine/prng.test.ts
    engine/theory.test.ts
    engine/presets.test.ts
    engine/mapper.test.ts
    engine/scoring.test.ts
    engine/transition.test.ts
    engine/engine.test.ts
    engine/purity.test.ts
    audio/scheduler.test.ts
```

**Why this split:** the `typing/` and `engine/` boundary is the spec's critical seam. `audio/` depends on `engine/` but never the reverse. `scoring.ts` is separate from `transition.ts` so each of the six scorers can be rejected or tuned independently of the sampling logic.

---

### Task 1: Project scaffold and test harness

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/ui/App.tsx`, `frontend/src/index.css`, `.gitignore`
- Test: `frontend/tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` and `npm run dev` in `frontend/`

- [ ] **Step 1: Scaffold the Vite project**

```bash
cd D:/projects/keytosound
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install tone
npm install -D vitest @tailwindcss/vite
```

- [ ] **Step 2: Write the repository .gitignore**

Create `D:/projects/keytosound/.gitignore`:

```
node_modules/
dist/
target/
.env
*.local
.DS_Store
```

- [ ] **Step 3: Configure Vite for Tailwind and Vitest**

Replace `frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

Replace `frontend/src/index.css` with a single line:

```css
@import "tailwindcss";
```

- [ ] **Step 4: Add the test script**

In `frontend/package.json`, set the `scripts` block to:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Write a smoke test**

Create `frontend/tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the test to verify the harness works**

Run: `cd frontend && npm test`
Expected: PASS, 1 test.

- [ ] **Step 7: Verify the dev server starts**

Run: `cd frontend && npm run dev`
Expected: Vite prints a `localhost` URL and serves the default React page. Stop it with Ctrl-C.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TypeScript frontend with Vitest and Tailwind"
```

---

### Task 2: Deterministic primitives — seeded PRNG and music theory

**Files:**
- Create: `frontend/src/engine/types.ts`, `frontend/src/engine/prng.ts`, `frontend/src/engine/theory.ts`
- Test: `frontend/tests/engine/prng.test.ts`, `frontend/tests/engine/theory.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `createPrng(seed: number): () => number`
  - `SCALES: Record<ScaleName, number[]>`
  - `pitchClass(pitch: number): number`
  - `scalePitchesInRange(keyRoot: number, scale: ScaleName, low: number, high: number): number[]`
  - `isChordTone(pitch: number, chord: Chord): boolean`
  - Types: `ScaleName`, `Chord`, `InstrumentId`, `GestureShape`, `ContourDirection`

- [ ] **Step 1: Write the core type definitions**

Create `frontend/src/engine/types.ts`:

```ts
export type ScaleName = 'majorPentatonic' | 'minorPentatonic';

export type InstrumentId =
  | 'piano'
  | 'synthLead'
  | 'electricPiano'
  | 'bass'
  | 'eightBit';

export type GestureShape = 'flat' | 'rise' | 'fall' | 'arch';

export type ContourDirection = -1 | 0 | 1;

/** A chord as a root pitch class plus semitone offsets from that root. */
export interface Chord {
  root: number;
  intervals: number[];
}

export interface MusicalEvent {
  /** MIDI note number. */
  pitch: number;
  /** 0..1 */
  velocity: number;
  durationBeats: number;
  /** Grid this note should land on: 8 or 16. */
  subdivision: number;
}
```

- [ ] **Step 2: Write the failing PRNG test**

Create `frontend/tests/engine/prng.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createPrng } from '../../src/engine/prng';

describe('createPrng', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = createPrng(12345);
    const b = createPrng(12345);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createPrng(1);
    const b = createPrng(2);
    expect(a()).not.toBe(b());
  });

  it('stays within [0, 1)', () => {
    const rng = createPrng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd frontend && npm test -- prng`
Expected: FAIL — cannot resolve `../../src/engine/prng`.

- [ ] **Step 4: Implement the PRNG**

Create `frontend/src/engine/prng.ts`:

```ts
/**
 * Mulberry32. Small, fast, seedable, and good enough for musical choice.
 * The engine's determinism contract depends on this being the only source
 * of randomness in engine/.
 */
export function createPrng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 5: Run the PRNG test**

Run: `cd frontend && npm test -- prng`
Expected: PASS, 3 tests.

- [ ] **Step 6: Write the failing theory test**

Create `frontend/tests/engine/theory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pitchClass, scalePitchesInRange, isChordTone, SCALES } from '../../src/engine/theory';

describe('pitchClass', () => {
  it('wraps into 0..11', () => {
    expect(pitchClass(60)).toBe(0);
    expect(pitchClass(61)).toBe(1);
    expect(pitchClass(-1)).toBe(11);
  });
});

describe('scalePitchesInRange', () => {
  it('returns only pitches in the scale', () => {
    // C major pentatonic: C D E G A
    const pitches = scalePitchesInRange(0, 'majorPentatonic', 60, 72);
    expect(pitches).toEqual([60, 62, 64, 67, 69, 72]);
  });

  it('respects a non-zero key root', () => {
    // D major pentatonic starting at D4 (62): D E F# A B
    const pitches = scalePitchesInRange(2, 'majorPentatonic', 62, 74);
    expect(pitches).toEqual([62, 64, 66, 69, 71, 74]);
  });

  it('returns an empty array when the range is inverted', () => {
    expect(scalePitchesInRange(0, 'majorPentatonic', 72, 60)).toEqual([]);
  });
});

describe('isChordTone', () => {
  const cMajor = { root: 0, intervals: [0, 4, 7] };

  it('accepts chord tones in any octave', () => {
    expect(isChordTone(60, cMajor)).toBe(true); // C
    expect(isChordTone(64, cMajor)).toBe(true); // E
    expect(isChordTone(79, cMajor)).toBe(true); // G, octave up
  });

  it('rejects non-chord tones', () => {
    expect(isChordTone(62, cMajor)).toBe(false); // D
  });
});

describe('SCALES', () => {
  it('defines both pentatonic scales with five degrees', () => {
    expect(SCALES.majorPentatonic).toHaveLength(5);
    expect(SCALES.minorPentatonic).toHaveLength(5);
  });
});
```

- [ ] **Step 7: Run it to confirm it fails**

Run: `cd frontend && npm test -- theory`
Expected: FAIL — cannot resolve `../../src/engine/theory`.

- [ ] **Step 8: Implement the theory module**

Create `frontend/src/engine/theory.ts`:

```ts
import type { Chord, ScaleName } from './types';

/** Semitone offsets from the key root. Pentatonic only — see Global Constraints. */
export const SCALES: Record<ScaleName, number[]> = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
};

export function pitchClass(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

/** Every MIDI pitch in [low, high] that belongs to the given key and scale. */
export function scalePitchesInRange(
  keyRoot: number,
  scale: ScaleName,
  low: number,
  high: number,
): number[] {
  const degrees = SCALES[scale];
  const out: number[] = [];
  for (let p = low; p <= high; p++) {
    if (degrees.includes(pitchClass(p - keyRoot))) out.push(p);
  }
  return out;
}

export function isChordTone(pitch: number, chord: Chord): boolean {
  const pc = pitchClass(pitch);
  return chord.intervals.some((i) => pitchClass(chord.root + i) === pc);
}
```

- [ ] **Step 9: Run the theory test**

Run: `cd frontend && npm test -- theory`
Expected: PASS, 6 tests.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/engine frontend/tests/engine
git commit -m "feat: add seeded PRNG and pentatonic music theory primitives"
```

---

### Task 3: Typing analyzer and feature extraction

**Files:**
- Create: `frontend/src/typing/types.ts`, `frontend/src/typing/analyzer.ts`
- Test: `frontend/tests/typing/analyzer.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface KeyEvent { key: string; timestamp: number }`
  - `type PunctuationClass = 'none' | 'period' | 'comma' | 'exclamation' | 'question'`
  - `interface TypingFeatures` (8 fields, exactly as in spec section 4.3)
  - `class TypingAnalyzer` with `process(event: KeyEvent): TypingFeatures` and `reset(): void`

- [ ] **Step 1: Write the typing types**

Create `frontend/src/typing/types.ts`:

```ts
export type PunctuationClass =
  | 'none'
  | 'period'
  | 'comma'
  | 'exclamation'
  | 'question';

export interface KeyEvent {
  key: string;
  /** Milliseconds, monotonic. Supplied by the caller — the analyzer never reads a clock. */
  timestamp: number;
}

/** The engine's only input. Nothing downstream of this knows about keyboards. */
export interface TypingFeatures {
  /** ms since the previous keystroke; 0 for the first. */
  interval: number;
  /** Rolling words per minute. */
  speed: number;
  /** Length of the word just completed; 0 while mid-word. */
  wordLength: number;
  /** Index of the current word within the sentence. */
  sentencePos: number;
  /** ms of silence preceding this event, counted only above PAUSE_THRESHOLD_MS. */
  pauseDuration: number;
  punctuation: PunctuationClass;
  isCapital: boolean;
  isBackspace: boolean;
}
```

- [ ] **Step 2: Write the failing analyzer test**

Create `frontend/tests/typing/analyzer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TypingAnalyzer } from '../../src/typing/analyzer';
import type { KeyEvent } from '../../src/typing/types';

function type(analyzer: TypingAnalyzer, text: string, intervalMs = 150) {
  const out = [];
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
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd frontend && npm test -- analyzer`
Expected: FAIL — cannot resolve `../../src/typing/analyzer`.

- [ ] **Step 4: Implement the analyzer**

Create `frontend/src/typing/analyzer.ts`:

```ts
import type { KeyEvent, PunctuationClass, TypingFeatures } from './types';

/** Silence shorter than this is ordinary typing rhythm, not a pause. */
const PAUSE_THRESHOLD_MS = 400;
/** How many intervals the rolling speed average considers. */
const SPEED_WINDOW = 16;
/** Conventional WPM definition: five characters make a word. */
const CHARS_PER_WORD = 5;

const PUNCTUATION: Record<string, PunctuationClass> = {
  '.': 'period',
  ',': 'comma',
  '!': 'exclamation',
  '?': 'question',
};

const WORD_TERMINATORS = new Set([' ', '.', ',', '!', '?']);
const SENTENCE_TERMINATORS = new Set(['.', '!', '?']);

export class TypingAnalyzer {
  private lastTimestamp: number | null = null;
  private intervals: number[] = [];
  private wordBuffer = '';
  private sentencePos = 0;

  reset(): void {
    this.lastTimestamp = null;
    this.intervals = [];
    this.wordBuffer = '';
    this.sentencePos = 0;
  }

  process(event: KeyEvent): TypingFeatures {
    const interval =
      this.lastTimestamp === null ? 0 : Math.max(0, event.timestamp - this.lastTimestamp);
    this.lastTimestamp = event.timestamp;

    if (interval > 0) {
      this.intervals.push(interval);
      if (this.intervals.length > SPEED_WINDOW) this.intervals.shift();
    }

    const punctuation = PUNCTUATION[event.key] ?? 'none';
    const isBackspace = event.key === 'Backspace';
    const isCapital = event.key.length === 1 && /[A-Z]/.test(event.key);

    let wordLength = 0;
    const sentencePosAtEvent = this.sentencePos;

    if (isBackspace) {
      this.wordBuffer = this.wordBuffer.slice(0, -1);
    } else if (WORD_TERMINATORS.has(event.key)) {
      wordLength = this.wordBuffer.length;
      this.wordBuffer = '';
      if (SENTENCE_TERMINATORS.has(event.key)) {
        this.sentencePos = 0;
      } else if (wordLength > 0) {
        this.sentencePos += 1;
      }
    } else if (event.key.length === 1) {
      this.wordBuffer += event.key;
    }

    return {
      interval,
      speed: this.currentSpeed(),
      wordLength,
      sentencePos: sentencePosAtEvent,
      pauseDuration: interval > PAUSE_THRESHOLD_MS ? interval : 0,
      punctuation,
      isCapital,
      isBackspace,
    };
  }

  private currentSpeed(): number {
    if (this.intervals.length === 0) return 0;
    const mean = this.intervals.reduce((a, b) => a + b, 0) / this.intervals.length;
    if (mean <= 0) return 0;
    return 60000 / (mean * CHARS_PER_WORD);
  }
}
```

- [ ] **Step 5: Run the analyzer test**

Run: `cd frontend && npm test -- analyzer`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/typing frontend/tests/typing
git commit -m "feat: add typing analyzer producing TypingFeatures"
```

---

### Task 4: Genre presets

**Files:**
- Create: `frontend/src/engine/presets.ts`
- Modify: `frontend/src/engine/types.ts` (append `ScoringWeights`, `GenrePreset`)
- Test: `frontend/tests/engine/presets.test.ts`

**Interfaces:**
- Consumes: `Chord`, `ScaleName`, `InstrumentId` from `engine/types.ts`
- Produces:
  - `interface ScoringWeights { interval; chordTone; contour; register; repetition; tension }` — all `number`
  - `interface GenrePreset` with fields `id`, `name`, `scale`, `keyRoot`, `progression`, `bpm`, `weights`, `temperature`, `centerPitch`, `registerSpread`, `leadInstrument`
  - `GENRES: Record<string, GenrePreset>` and `DEFAULT_GENRE_ID: string`

- [ ] **Step 1: Append the preset types**

Append to `frontend/src/engine/types.ts`:

```ts
/** Relative influence of each of the six scoring terms. */
export interface ScoringWeights {
  interval: number;
  chordTone: number;
  contour: number;
  register: number;
  repetition: number;
  tension: number;
}

/** A genre is data, not code. Adding one is authoring a parameter set. */
export interface GenrePreset {
  id: string;
  name: string;
  scale: ScaleName;
  /** Pitch class 0-11. */
  keyRoot: number;
  progression: Chord[];
  bpm: number;
  weights: ScoringWeights;
  /** Softmax temperature. Low = predictable, high = surprising. */
  temperature: number;
  /** MIDI pitch that register gravity pulls toward. */
  centerPitch: number;
  /** Semitones of comfortable range either side of centerPitch. */
  registerSpread: number;
  leadInstrument: InstrumentId;
}
```

- [ ] **Step 2: Write the failing preset test**

Create `frontend/tests/engine/presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GENRES, DEFAULT_GENRE_ID } from '../../src/engine/presets';
import { SCALES } from '../../src/engine/theory';

describe('GENRES', () => {
  it('ships exactly three genres', () => {
    expect(Object.keys(GENRES)).toHaveLength(3);
  });

  it('has a valid default', () => {
    expect(GENRES[DEFAULT_GENRE_ID]).toBeDefined();
  });

  for (const [id, preset] of Object.entries(GENRES)) {
    describe(id, () => {
      it('uses a pentatonic scale', () => {
        expect(SCALES[preset.scale]).toBeDefined();
      });

      it('has a non-empty chord progression', () => {
        expect(preset.progression.length).toBeGreaterThan(0);
        for (const chord of preset.progression) {
          expect(chord.intervals.length).toBeGreaterThanOrEqual(3);
        }
      });

      it('has a plausible tempo', () => {
        expect(preset.bpm).toBeGreaterThanOrEqual(60);
        expect(preset.bpm).toBeLessThanOrEqual(180);
      });

      it('has a positive weight for every scoring term', () => {
        for (const value of Object.values(preset.weights)) {
          expect(value).toBeGreaterThan(0);
        }
      });

      it('has a positive temperature', () => {
        expect(preset.temperature).toBeGreaterThan(0);
      });

      it('has its id matching its key', () => {
        expect(preset.id).toBe(id);
      });
    });
  }
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd frontend && npm test -- presets`
Expected: FAIL — cannot resolve `../../src/engine/presets`.

- [ ] **Step 4: Implement the presets**

Create `frontend/src/engine/presets.ts`:

```ts
import type { Chord, GenrePreset } from './types';

const minor = (root: number): Chord => ({ root, intervals: [0, 3, 7] });
const major = (root: number): Chord => ({ root, intervals: [0, 4, 7] });
const minor7 = (root: number): Chord => ({ root, intervals: [0, 3, 7, 10] });

export const GENRES: Record<string, GenrePreset> = {
  lofi: {
    id: 'lofi',
    name: 'Lo-Fi',
    scale: 'minorPentatonic',
    keyRoot: 9, // A
    // Am7 - Dm7 - G - Cmaj: the classic loose loop
    progression: [minor7(9), minor7(2), major(7), major(0)],
    bpm: 75,
    weights: {
      interval: 1.4,
      chordTone: 1.0,
      contour: 1.2,
      register: 0.8,
      repetition: 0.6,
      tension: 0.7,
    },
    temperature: 0.55,
    centerPitch: 69, // A4
    registerSpread: 9,
    leadInstrument: 'electricPiano',
  },

  synthwave: {
    id: 'synthwave',
    name: 'Synthwave',
    scale: 'minorPentatonic',
    keyRoot: 5, // F
    // Fm - Db - Ab - Eb
    progression: [minor(5), major(1), major(8), major(3)],
    bpm: 118,
    weights: {
      interval: 1.0,
      chordTone: 1.3,
      contour: 1.4,
      register: 1.0,
      repetition: 0.9,
      tension: 0.8,
    },
    temperature: 0.4,
    centerPitch: 72, // C5
    registerSpread: 11,
    leadInstrument: 'synthLead',
  },

  eightbit: {
    id: 'eightbit',
    name: '8-Bit',
    scale: 'majorPentatonic',
    keyRoot: 0, // C
    // C - G - Am - F
    progression: [major(0), major(7), minor(9), major(5)],
    bpm: 140,
    weights: {
      interval: 0.9,
      chordTone: 1.5,
      contour: 1.5,
      register: 1.2,
      repetition: 1.1,
      tension: 0.9,
    },
    temperature: 0.3,
    centerPitch: 76, // E5
    registerSpread: 10,
    leadInstrument: 'eightBit',
  },
};

export const DEFAULT_GENRE_ID = 'lofi';
```

- [ ] **Step 5: Run the preset test**

Run: `cd frontend && npm test -- presets`
Expected: PASS, 20 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/engine frontend/tests/engine
git commit -m "feat: add Lo-Fi, Synthwave and 8-Bit genre presets"
```

---

### Task 5: Musical mapper

**Files:**
- Create: `frontend/src/engine/mapper.ts`
- Modify: `frontend/src/engine/types.ts` (append `MusicalState`, `MappedParams`)
- Test: `frontend/tests/engine/mapper.test.ts`

**Interfaces:**
- Consumes: `TypingFeatures`, `GenrePreset`, `GestureShape`, `ContourDirection`
- Produces:
  - `interface MusicalState` — full definition below
  - `interface MappedParams` — full definition below
  - `mapFeatures(f: TypingFeatures, state: MusicalState, preset: GenrePreset): MappedParams`

- [ ] **Step 1: Append the state and params types**

Append to `frontend/src/engine/types.ts`:

```ts
/** Everything the engine carries from one note to the next. */
export interface MusicalState {
  keyRoot: number;
  scale: ScaleName;
  progression: Chord[];
  chordIndex: number;
  /** MIDI note number of the last note emitted. */
  previousPitch: number;
  contourDirection: ContourDirection;
  /** Consecutive notes that moved in contourDirection. */
  contourMomentum: number;
  /** Absolute semitone size of the last melodic move. */
  lastIntervalSize: number;
  /** 0..1 through the current phrase. */
  phrasePosition: number;
  /** 0..1, driven by typing speed. */
  energy: number;
  /** 0..1 */
  tension: number;
  /** Most recent pitches, oldest first, for the repetition penalty. */
  recentPitches: number[];
  /** 0..1 within the current bar, for strong-beat detection. */
  beatPosition: number;
}

/** The mapper's output: musical intent, before a pitch has been chosen. */
export interface MappedParams {
  durationBeats: number;
  subdivision: number;
  velocity: number;
  /** Maximum comfortable melodic interval, in semitones. */
  leapAllowance: number;
  gestureShape: GestureShape;
  forceResolution: boolean;
  isRest: boolean;
  targetTension: number;
  advanceChord: boolean;
  echoPrevious: boolean;
}
```

- [ ] **Step 2: Write the failing mapper test**

Create `frontend/tests/engine/mapper.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapFeatures } from '../../src/engine/mapper';
import { GENRES } from '../../src/engine/presets';
import type { MusicalState } from '../../src/engine/types';
import type { TypingFeatures } from '../../src/typing/types';

const preset = GENRES.lofi;

function baseState(overrides: Partial<MusicalState> = {}): MusicalState {
  return {
    keyRoot: preset.keyRoot,
    scale: preset.scale,
    progression: preset.progression,
    chordIndex: 0,
    previousPitch: 69,
    contourDirection: 0,
    contourMomentum: 0,
    lastIntervalSize: 0,
    phrasePosition: 0.5,
    energy: 0.5,
    tension: 0.5,
    recentPitches: [],
    beatPosition: 0,
    ...overrides,
  };
}

function baseFeatures(overrides: Partial<TypingFeatures> = {}): TypingFeatures {
  return {
    interval: 200,
    speed: 40,
    wordLength: 0,
    sentencePos: 0,
    pauseDuration: 0,
    punctuation: 'none',
    isCapital: false,
    isBackspace: false,
    ...overrides,
  };
}

describe('mapFeatures', () => {
  it('gives fast typing shorter notes than slow typing', () => {
    const fast = mapFeatures(baseFeatures({ interval: 90 }), baseState(), preset);
    const slow = mapFeatures(baseFeatures({ interval: 700 }), baseState(), preset);
    expect(fast.durationBeats).toBeLessThan(slow.durationBeats);
  });

  it('uses a 16th grid at high energy and an 8th grid at low energy', () => {
    const fast = mapFeatures(baseFeatures({ speed: 90 }), baseState(), preset);
    const slow = mapFeatures(baseFeatures({ speed: 10 }), baseState(), preset);
    expect(fast.subdivision).toBe(16);
    expect(slow.subdivision).toBe(8);
  });

  it('raises velocity with typing speed', () => {
    const fast = mapFeatures(baseFeatures({ speed: 90 }), baseState(), preset);
    const slow = mapFeatures(baseFeatures({ speed: 10 }), baseState(), preset);
    expect(fast.velocity).toBeGreaterThan(slow.velocity);
  });

  it('accents capitals and exclamation marks', () => {
    const plain = mapFeatures(baseFeatures(), baseState(), preset);
    const capital = mapFeatures(baseFeatures({ isCapital: true }), baseState(), preset);
    const bang = mapFeatures(baseFeatures({ punctuation: 'exclamation' }), baseState(), preset);
    expect(capital.velocity).toBeGreaterThan(plain.velocity);
    expect(bang.velocity).toBeGreaterThan(plain.velocity);
  });

  it('keeps velocity within 0..1', () => {
    const loud = mapFeatures(
      baseFeatures({ speed: 200, isCapital: true, punctuation: 'exclamation' }),
      baseState(),
      preset,
    );
    expect(loud.velocity).toBeLessThanOrEqual(1);
    expect(loud.velocity).toBeGreaterThan(0);
  });

  it('gives long words a larger leap allowance than short words', () => {
    const short = mapFeatures(baseFeatures({ wordLength: 2 }), baseState(), preset);
    const long = mapFeatures(baseFeatures({ wordLength: 11 }), baseState(), preset);
    expect(long.leapAllowance).toBeGreaterThan(short.leapAllowance);
  });

  it('gives long words an arch gesture and short words a small rise', () => {
    const short = mapFeatures(baseFeatures({ wordLength: 2 }), baseState(), preset);
    const long = mapFeatures(baseFeatures({ wordLength: 9 }), baseState(), preset);
    expect(short.gestureShape).toBe('rise');
    expect(long.gestureShape).toBe('arch');
  });

  it('forces resolution on a period', () => {
    const p = mapFeatures(baseFeatures({ punctuation: 'period' }), baseState(), preset);
    expect(p.forceResolution).toBe(true);
    expect(p.targetTension).toBe(0);
    expect(p.gestureShape).toBe('fall');
  });

  it('rests on a comma', () => {
    const p = mapFeatures(baseFeatures({ punctuation: 'comma' }), baseState(), preset);
    expect(p.isRest).toBe(true);
  });

  it('leaves a question unresolved and rising', () => {
    const p = mapFeatures(baseFeatures({ punctuation: 'question' }), baseState(), preset);
    expect(p.targetTension).toBeGreaterThan(0.8);
    expect(p.gestureShape).toBe('rise');
    expect(p.forceResolution).toBe(false);
  });

  it('advances the chord on a completed word', () => {
    const mid = mapFeatures(baseFeatures({ wordLength: 0 }), baseState(), preset);
    const boundary = mapFeatures(baseFeatures({ wordLength: 4 }), baseState(), preset);
    expect(mid.advanceChord).toBe(false);
    expect(boundary.advanceChord).toBe(true);
  });

  it('echoes the previous note on backspace', () => {
    const p = mapFeatures(baseFeatures({ isBackspace: true }), baseState(), preset);
    expect(p.echoPrevious).toBe(true);
  });

  it('lengthens the note after a long pause', () => {
    const normal = mapFeatures(baseFeatures({ interval: 200 }), baseState(), preset);
    const paused = mapFeatures(
      baseFeatures({ interval: 1500, pauseDuration: 1500 }),
      baseState(),
      preset,
    );
    expect(paused.durationBeats).toBeGreaterThan(normal.durationBeats);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd frontend && npm test -- mapper`
Expected: FAIL — cannot resolve `../../src/engine/mapper`.

- [ ] **Step 4: Implement the mapper**

Create `frontend/src/engine/mapper.ts`:

```ts
import type { GenrePreset, GestureShape, MappedParams, MusicalState } from './types';
import type { TypingFeatures } from '../typing/types';

/** Typing speed at which energy saturates. */
const SPEED_FOR_FULL_ENERGY = 80;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function durationFromInterval(interval: number): number {
  if (interval < 120) return 0.25;
  if (interval < 260) return 0.5;
  if (interval < 550) return 1;
  if (interval < 1200) return 1.5;
  return 2;
}

function shapeFromWord(wordLength: number, punctuation: TypingFeatures['punctuation']): GestureShape {
  if (punctuation === 'period') return 'fall';
  if (punctuation === 'question') return 'rise';
  if (wordLength === 0) return 'flat';
  if (wordLength <= 3) return 'rise';
  return 'arch';
}

export function mapFeatures(
  f: TypingFeatures,
  state: MusicalState,
  preset: GenrePreset,
): MappedParams {
  const energy = clamp(f.speed / SPEED_FOR_FULL_ENERGY, 0, 1);

  let velocity = 0.4 + energy * 0.4;
  if (f.isCapital) velocity += 0.12;
  if (f.punctuation === 'exclamation') velocity += 0.18;
  velocity = clamp(velocity, 0.05, 1);

  const forceResolution = f.punctuation === 'period';
  const isRest = f.punctuation === 'comma';

  let targetTension: number;
  if (forceResolution) targetTension = 0;
  else if (f.punctuation === 'question') targetTension = 0.9;
  else targetTension = clamp(state.phrasePosition, 0, 1);

  // Short word, small excursion. Long word, a full arc with a registral peak.
  const leapAllowance = clamp(2 + Math.min(f.wordLength, 10), 2, 12);

  return {
    durationBeats: durationFromInterval(f.interval),
    subdivision: energy > 0.5 ? 16 : 8,
    velocity,
    leapAllowance,
    gestureShape: shapeFromWord(f.wordLength, f.punctuation),
    forceResolution,
    isRest,
    targetTension,
    advanceChord: f.wordLength > 0,
    echoPrevious: f.isBackspace,
  };
}
```

Note: `preset` is accepted for signature stability — Task 8 and later genre tuning read from it. TypeScript strict mode does not complain about an unused parameter unless `noUnusedParameters` is on; if the build errors, prefix it as `_preset` and update call sites in Task 8 accordingly.

- [ ] **Step 5: Run the mapper test**

Run: `cd frontend && npm test -- mapper`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/engine frontend/tests/engine
git commit -m "feat: map typing features to musical intent"
```

---

### Task 6: Placement scorers — interval, chord tone, register

**Files:**
- Create: `frontend/src/engine/scoring.ts`
- Test: `frontend/tests/engine/scoring.test.ts`

**Interfaces:**
- Consumes: `isChordTone` from `engine/theory.ts`, `Chord` from `engine/types.ts`
- Produces:
  - `scoreInterval(candidate: number, previousPitch: number, leapAllowance: number): number`
  - `scoreChordTone(candidate: number, previousPitch: number, chord: Chord, onStrongBeat: boolean): number`
  - `scoreRegister(candidate: number, centerPitch: number, spread: number): number`

  All return a value in `(0, 1]`.

- [ ] **Step 1: Write the failing test for the three placement scorers**

Create `frontend/tests/engine/scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scoreInterval, scoreChordTone, scoreRegister } from '../../src/engine/scoring';

const cMajor = { root: 0, intervals: [0, 4, 7] };

describe('scoreInterval', () => {
  it('prefers stepwise motion over leaps', () => {
    expect(scoreInterval(62, 60, 5)).toBeGreaterThan(scoreInterval(72, 60, 5));
  });

  it('decays monotonically with distance', () => {
    const scores = [61, 63, 65, 67, 69].map((p) => scoreInterval(p, 60, 5));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
  });

  it('a larger leap allowance makes big intervals more acceptable', () => {
    expect(scoreInterval(70, 60, 10)).toBeGreaterThan(scoreInterval(70, 60, 3));
  });

  it('penalises repeating the same pitch', () => {
    expect(scoreInterval(60, 60, 5)).toBeLessThan(scoreInterval(62, 60, 5));
  });

  it('always returns a positive score', () => {
    expect(scoreInterval(100, 60, 2)).toBeGreaterThan(0);
  });
});

describe('scoreChordTone', () => {
  it('prefers chord tones, especially on strong beats', () => {
    const strong = scoreChordTone(64, 62, cMajor, true);
    const weak = scoreChordTone(64, 62, cMajor, false);
    expect(strong).toBeGreaterThan(weak);
  });

  it('scores a chord tone above a non-chord tone', () => {
    expect(scoreChordTone(64, 62, cMajor, true)).toBeGreaterThan(
      scoreChordTone(62, 60, cMajor, true),
    );
  });

  it('allows a non-chord tone approached by step', () => {
    const byStep = scoreChordTone(62, 60, cMajor, false);
    const byLeap = scoreChordTone(62, 55, cMajor, false);
    expect(byStep).toBeGreaterThan(byLeap);
  });

  it('heavily penalises a non-chord tone reached by leap', () => {
    expect(scoreChordTone(62, 50, cMajor, true)).toBeLessThan(0.1);
  });
});

describe('scoreRegister', () => {
  it('peaks at the centre pitch', () => {
    expect(scoreRegister(69, 69, 9)).toBeGreaterThan(scoreRegister(60, 69, 9));
    expect(scoreRegister(69, 69, 9)).toBeGreaterThan(scoreRegister(80, 69, 9));
  });

  it('is symmetric about the centre', () => {
    expect(scoreRegister(64, 69, 9)).toBeCloseTo(scoreRegister(74, 69, 9), 10);
  });

  it('a wider spread tolerates more distance', () => {
    expect(scoreRegister(84, 69, 15)).toBeGreaterThan(scoreRegister(84, 69, 6));
  });

  it('always returns a positive score', () => {
    expect(scoreRegister(20, 69, 5)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend && npm test -- scoring`
Expected: FAIL — cannot resolve `../../src/engine/scoring`.

- [ ] **Step 3: Implement the three placement scorers**

Create `frontend/src/engine/scoring.ts`:

```ts
import { isChordTone } from './theory';
import type { Chord } from './types';

/**
 * In a pentatonic scale, adjacent degrees can be 2 or 3 semitones apart,
 * so "approached by step" means up to a minor third.
 */
const STEP_SEMITONES = 3;

/**
 * Term 1. Stepwise motion strongly favoured; Gaussian decay with leap size,
 * widened by the mapper's leapAllowance so long words permit bigger jumps.
 */
export function scoreInterval(
  candidate: number,
  previousPitch: number,
  leapAllowance: number,
): number {
  const distance = Math.abs(candidate - previousPitch);
  if (distance === 0) return 0.15;
  const width = Math.max(1, leapAllowance);
  return Math.exp(-((distance / width) ** 2)) + 1e-6;
}

/**
 * Term 2. Chord tones score higher, dramatically so on strong beats.
 * Non-chord tones are permitted only as passing notes — this enforces the
 * "approached by step" half of that rule. The "left by step" half is
 * enforced implicitly, because scoreInterval governs the following note.
 */
export function scoreChordTone(
  candidate: number,
  previousPitch: number,
  chord: Chord,
  onStrongBeat: boolean,
): number {
  if (isChordTone(candidate, chord)) return onStrongBeat ? 1 : 0.8;
  const approachedByStep = Math.abs(candidate - previousPitch) <= STEP_SEMITONES;
  if (!approachedByStep) return 0.05;
  return onStrongBeat ? 0.15 : 0.5;
}

/**
 * Term 4. A soft pull toward a comfortable centre octave. This is what stops
 * the classic random-walk failure where the melody wanders off the top of
 * the keyboard and never comes back.
 */
export function scoreRegister(candidate: number, centerPitch: number, spread: number): number {
  const distance = Math.abs(candidate - centerPitch);
  const width = Math.max(1, spread);
  return Math.exp(-((distance / width) ** 2)) + 1e-6;
}
```

- [ ] **Step 4: Run the scoring test**

Run: `cd frontend && npm test -- scoring`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/engine/scoring.ts frontend/tests/engine/scoring.test.ts
git commit -m "feat: add interval, chord-tone and register scorers"
```

---

### Task 7: History scorers — contour, repetition, tension

**Files:**
- Modify: `frontend/src/engine/scoring.ts` (append three functions)
- Modify: `frontend/tests/engine/scoring.test.ts` (append three describe blocks)

**Interfaces:**
- Consumes: `scoreInterval`/`scoreChordTone`/`scoreRegister` from Task 6; `GestureShape`, `ContourDirection`, `Chord`
- Produces:
  - `interface ContourContext { previousPitch; direction; momentum; lastIntervalSize; shape; phrasePosition }`
  - `scoreContour(candidate: number, ctx: ContourContext): number`
  - `scoreRepetition(candidate: number, recentPitches: number[]): number`
  - `scoreTension(candidate: number, chord: Chord, tonicChord: Chord, targetTension: number, forceResolution: boolean): number`

- [ ] **Step 1: Append the failing history-scorer tests**

Append to `frontend/tests/engine/scoring.test.ts`:

```ts
import { scoreContour, scoreRepetition, scoreTension } from '../../src/engine/scoring';
import type { ContourContext } from '../../src/engine/scoring';

function ctx(overrides: Partial<ContourContext> = {}): ContourContext {
  return {
    previousPitch: 69,
    direction: 0,
    momentum: 0,
    lastIntervalSize: 0,
    shape: 'flat',
    phrasePosition: 0.5,
    ...overrides,
  };
}

describe('scoreContour', () => {
  it('after a large upward leap, strongly prefers a downward step', () => {
    const afterLeapUp = ctx({ previousPitch: 76, direction: 1, lastIntervalSize: 7 });
    const stepDown = scoreContour(74, afterLeapUp);
    const leapFurtherUp = scoreContour(83, afterLeapUp);
    expect(stepDown).toBeGreaterThan(leapFurtherUp);
    expect(stepDown).toBeGreaterThan(0.9);
  });

  it('after a large downward leap, strongly prefers an upward step', () => {
    const afterLeapDown = ctx({ previousPitch: 62, direction: -1, lastIntervalSize: 7 });
    expect(scoreContour(64, afterLeapDown)).toBeGreaterThan(scoreContour(55, afterLeapDown));
  });

  it('mildly favours continuing an established direction', () => {
    const rising = ctx({ direction: 1, momentum: 3, lastIntervalSize: 2 });
    expect(scoreContour(71, rising)).toBeGreaterThan(scoreContour(67, rising));
  });

  it('biases upward for a rise gesture and downward for a fall gesture', () => {
    expect(scoreContour(71, ctx({ shape: 'rise' }))).toBeGreaterThan(
      scoreContour(67, ctx({ shape: 'rise' })),
    );
    expect(scoreContour(67, ctx({ shape: 'fall' }))).toBeGreaterThan(
      scoreContour(71, ctx({ shape: 'fall' })),
    );
  });

  it('an arch rises in the first half of a phrase and falls in the second', () => {
    const early = ctx({ shape: 'arch', phrasePosition: 0.2 });
    const late = ctx({ shape: 'arch', phrasePosition: 0.8 });
    expect(scoreContour(71, early)).toBeGreaterThan(scoreContour(67, early));
    expect(scoreContour(67, late)).toBeGreaterThan(scoreContour(71, late));
  });

  it('always returns a positive score', () => {
    expect(scoreContour(40, ctx({ shape: 'rise' }))).toBeGreaterThan(0);
  });
});

describe('scoreRepetition', () => {
  it('gives an unused pitch the full score', () => {
    expect(scoreRepetition(64, [60, 62, 67])).toBe(1);
  });

  it('penalises the most recent pitch hardest', () => {
    const recent = [60, 62, 67];
    expect(scoreRepetition(67, recent)).toBeLessThan(scoreRepetition(60, recent));
  });

  it('forgives a pitch as it recedes', () => {
    const recent = [64, 60, 62, 67, 69];
    expect(scoreRepetition(64, recent)).toBeGreaterThan(scoreRepetition(69, recent));
  });

  it('always returns a positive score', () => {
    expect(scoreRepetition(60, [60])).toBeGreaterThan(0);
  });
});

describe('scoreTension', () => {
  const cMajorTonic = { root: 0, intervals: [0, 4, 7] };
  const fMajor = { root: 5, intervals: [0, 4, 7] };

  it('under forced resolution, only tonic chord tones score well', () => {
    expect(scoreTension(60, fMajor, cMajorTonic, 0, true)).toBe(1);
    expect(scoreTension(62, fMajor, cMajorTonic, 0, true)).toBeLessThan(0.1);
  });

  it('at low target tension, prefers current chord tones', () => {
    expect(scoreTension(65, fMajor, cMajorTonic, 0, false)).toBeGreaterThan(
      scoreTension(62, fMajor, cMajorTonic, 0, false),
    );
  });

  it('at high target tension, prefers non-chord tones', () => {
    expect(scoreTension(62, fMajor, cMajorTonic, 1, false)).toBeGreaterThan(
      scoreTension(65, fMajor, cMajorTonic, 1, false),
    );
  });

  it('always returns a positive score', () => {
    expect(scoreTension(62, fMajor, cMajorTonic, 0, false)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend && npm test -- scoring`
Expected: FAIL — `scoreContour` is not exported.

- [ ] **Step 3: Append the three history scorers**

Append to `frontend/src/engine/scoring.ts`:

```ts
import type { ContourDirection, GestureShape } from './types';

export interface ContourContext {
  previousPitch: number;
  direction: ContourDirection;
  momentum: number;
  lastIntervalSize: number;
  shape: GestureShape;
  phrasePosition: number;
}

/** A leap wider than this triggers the reverse-by-step rule. */
const LEAP_THRESHOLD = 4;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0.01, value));
}

/**
 * Term 3. The single largest contributor to melodies sounding intentional
 * rather than generated: after a large leap, reverse direction by step.
 * Secondary effects are momentum and the mapper's gesture shape.
 */
export function scoreContour(candidate: number, ctx: ContourContext): number {
  const move = candidate - ctx.previousPitch;
  const dir = Math.sign(move);

  if (ctx.lastIntervalSize > LEAP_THRESHOLD && ctx.direction !== 0) {
    const reversing = dir !== 0 && dir === -ctx.direction;
    if (reversing && Math.abs(move) <= 3) return 1;
    if (reversing) return 0.55;
    if (dir === ctx.direction) return 0.12;
    return 0.35;
  }

  let score = 0.5;

  if (ctx.momentum >= 2) {
    score = dir === ctx.direction && dir !== 0 ? 0.75 : 0.45;
  }

  let wanted: number = 0;
  if (ctx.shape === 'rise') wanted = 1;
  else if (ctx.shape === 'fall') wanted = -1;
  else if (ctx.shape === 'arch') wanted = ctx.phrasePosition < 0.5 ? 1 : -1;

  if (wanted !== 0) {
    score += dir === wanted ? 0.25 : -0.12;
  }

  return clamp01(score);
}

/**
 * Term 5. A decaying penalty on recently used pitches, so the melody
 * cannot get stuck repeating itself.
 */
export function scoreRepetition(candidate: number, recentPitches: number[]): number {
  const index = recentPitches.lastIndexOf(candidate);
  if (index === -1) return 1;
  const recency = recentPitches.length - index; // 1 is the most recent
  return Math.min(1, 0.15 * recency);
}

/**
 * Term 6. Phrase position sets a tension target: stable chord tones early,
 * dissonance permitted mid-phrase, forced resolution to the tonic at the end.
 */
export function scoreTension(
  candidate: number,
  chord: Chord,
  tonicChord: Chord,
  targetTension: number,
  forceResolution: boolean,
): number {
  if (forceResolution) {
    return isChordTone(candidate, tonicChord) ? 1 : 0.05;
  }
  const noteTension = isChordTone(candidate, chord) ? 0 : 1;
  return clamp01(1 - Math.abs(noteTension - targetTension));
}
```

- [ ] **Step 4: Run the full scoring test**

Run: `cd frontend && npm test -- scoring`
Expected: PASS, 27 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/engine/scoring.ts frontend/tests/engine/scoring.test.ts
git commit -m "feat: add contour, repetition and tension scorers"
```

---

### Task 8: Transition engine — candidates, weighting, sampling

**Files:**
- Create: `frontend/src/engine/transition.ts`
- Test: `frontend/tests/engine/transition.test.ts`

**Interfaces:**
- Consumes: all six scorers from `engine/scoring.ts`; `scalePitchesInRange` from `engine/theory.ts`; `MusicalState`, `MappedParams`, `GenrePreset`
- Produces:
  - `generateCandidates(state: MusicalState, preset: GenrePreset): number[]`
  - `selectNextPitch(state: MusicalState, params: MappedParams, preset: GenrePreset, rng: () => number): number`

- [ ] **Step 1: Write the failing transition test**

Create `frontend/tests/engine/transition.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateCandidates, selectNextPitch } from '../../src/engine/transition';
import { GENRES } from '../../src/engine/presets';
import { createPrng } from '../../src/engine/prng';
import { SCALES, pitchClass } from '../../src/engine/theory';
import type { MappedParams, MusicalState } from '../../src/engine/types';

const preset = GENRES.lofi;

function state(overrides: Partial<MusicalState> = {}): MusicalState {
  return {
    keyRoot: preset.keyRoot,
    scale: preset.scale,
    progression: preset.progression,
    chordIndex: 0,
    previousPitch: preset.centerPitch,
    contourDirection: 0,
    contourMomentum: 0,
    lastIntervalSize: 0,
    phrasePosition: 0.4,
    energy: 0.5,
    tension: 0.4,
    recentPitches: [],
    beatPosition: 0,
    ...overrides,
  };
}

function params(overrides: Partial<MappedParams> = {}): MappedParams {
  return {
    durationBeats: 0.5,
    subdivision: 8,
    velocity: 0.7,
    leapAllowance: 5,
    gestureShape: 'flat',
    forceResolution: false,
    isRest: false,
    targetTension: 0.4,
    advanceChord: false,
    echoPrevious: false,
    ...overrides,
  };
}

describe('generateCandidates', () => {
  it('returns only pitches in the active scale', () => {
    const degrees = SCALES[preset.scale];
    for (const pitch of generateCandidates(state(), preset)) {
      expect(degrees).toContain(pitchClass(pitch - preset.keyRoot));
    }
  });

  it('stays within an octave either side of the previous pitch', () => {
    const s = state({ previousPitch: 69 });
    for (const pitch of generateCandidates(s, preset)) {
      expect(Math.abs(pitch - 69)).toBeLessThanOrEqual(12);
    }
  });

  it('never returns an empty candidate set', () => {
    expect(generateCandidates(state({ previousPitch: 20 }), preset).length).toBeGreaterThan(0);
    expect(generateCandidates(state({ previousPitch: 120 }), preset).length).toBeGreaterThan(0);
  });
});

describe('selectNextPitch', () => {
  it('is deterministic for a given seed', () => {
    const a = createPrng(7);
    const b = createPrng(7);
    expect(selectNextPitch(state(), params(), preset, a)).toBe(
      selectNextPitch(state(), params(), preset, b),
    );
  });

  it('always returns a pitch in the active scale', () => {
    const rng = createPrng(3);
    const degrees = SCALES[preset.scale];
    let s = state();
    for (let i = 0; i < 300; i++) {
      const pitch = selectNextPitch(s, params(), preset, rng);
      expect(degrees).toContain(pitchClass(pitch - preset.keyRoot));
      s = { ...s, previousPitch: pitch };
    }
  });

  it('keeps the melody inside sane register bounds over a long run', () => {
    const rng = createPrng(11);
    let s = state();
    for (let i = 0; i < 500; i++) {
      const pitch = selectNextPitch(s, params(), preset, rng);
      expect(pitch).toBeGreaterThan(preset.centerPitch - 30);
      expect(pitch).toBeLessThan(preset.centerPitch + 30);
      s = {
        ...s,
        previousPitch: pitch,
        recentPitches: [...s.recentPitches, pitch].slice(-8),
      };
    }
  });

  it('resolves to a tonic chord tone when resolution is forced', () => {
    const rng = createPrng(5);
    const tonic = preset.progression[0];
    for (let i = 0; i < 40; i++) {
      const pitch = selectNextPitch(
        state({ previousPitch: 71 + (i % 5) }),
        params({ forceResolution: true }),
        preset,
        rng,
      );
      const pc = pitchClass(pitch);
      const tonicPcs = tonic.intervals.map((iv) => pitchClass(tonic.root + iv));
      expect(tonicPcs).toContain(pc);
    }
  });

  it('follows a large leap with motion in the opposite direction', () => {
    const rng = createPrng(13);
    let reversals = 0;
    const trials = 60;
    for (let i = 0; i < trials; i++) {
      const s = state({
        previousPitch: 81,
        contourDirection: 1,
        lastIntervalSize: 9,
      });
      const pitch = selectNextPitch(s, params(), preset, rng);
      if (pitch < 81) reversals += 1;
    }
    expect(reversals / trials).toBeGreaterThan(0.8);
  });

  it('does not repeat one pitch indefinitely', () => {
    const rng = createPrng(17);
    let s = state();
    const emitted: number[] = [];
    for (let i = 0; i < 60; i++) {
      const pitch = selectNextPitch(s, params(), preset, rng);
      emitted.push(pitch);
      s = { ...s, previousPitch: pitch, recentPitches: emitted.slice(-8) };
    }
    expect(new Set(emitted).size).toBeGreaterThan(3);
  });

  it('a lower temperature produces less variety than a higher one', () => {
    const cold = { ...preset, temperature: 0.05 };
    const hot = { ...preset, temperature: 3 };
    const sample = (p: typeof preset) => {
      const rng = createPrng(23);
      const out = new Set<number>();
      for (let i = 0; i < 80; i++) out.add(selectNextPitch(state(), params(), p, rng));
      return out.size;
    };
    expect(sample(cold)).toBeLessThan(sample(hot));
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend && npm test -- transition`
Expected: FAIL — cannot resolve `../../src/engine/transition`.

- [ ] **Step 3: Implement the transition engine**

Create `frontend/src/engine/transition.ts`:

```ts
import {
  scoreChordTone,
  scoreContour,
  scoreInterval,
  scoreRegister,
  scoreRepetition,
  scoreTension,
} from './scoring';
import { isChordTone, scalePitchesInRange } from './theory';
import type { GenrePreset, MappedParams, MusicalState } from './types';

/** Candidates are drawn from one octave either side of the previous note. */
const CANDIDATE_RANGE = 12;
/** Absolute floor and ceiling, so a runaway melody cannot leave the keyboard. */
const MIN_PITCH = 36;
const MAX_PITCH = 96;

export function generateCandidates(state: MusicalState, preset: GenrePreset): number[] {
  const low = Math.max(MIN_PITCH, state.previousPitch - CANDIDATE_RANGE);
  const high = Math.min(MAX_PITCH, state.previousPitch + CANDIDATE_RANGE);
  const candidates = scalePitchesInRange(state.keyRoot, state.scale, low, high);
  if (candidates.length > 0) return candidates;
  // Previous pitch was outside the playable range: fall back to the centre octave.
  return scalePitchesInRange(
    state.keyRoot,
    state.scale,
    preset.centerPitch - CANDIDATE_RANGE,
    preset.centerPitch + CANDIDATE_RANGE,
  );
}

/**
 * Score every candidate on the six weighted terms, then sample from a softmax
 * over those scores. Randomness exists, but only inside musical constraints.
 */
export function selectNextPitch(
  state: MusicalState,
  params: MappedParams,
  preset: GenrePreset,
  rng: () => number,
): number {
  const chord = state.progression[state.chordIndex % state.progression.length];
  const tonicChord = state.progression[0];
  const onStrongBeat = state.beatPosition < 0.25;
  const w = preset.weights;

  const all = generateCandidates(state, preset);
  // "Forced" resolution means forced. Scoring alone cannot guarantee it: a
  // conveniently adjacent non-tonic note can outweigh the tension term via
  // the interval term. Restricting the candidate set is what makes a phrase
  // ending on "." reliably land on the tonic chord.
  const candidates = params.forceResolution
    ? (() => {
        const resolved = all.filter((p) => isChordTone(p, tonicChord));
        return resolved.length > 0 ? resolved : all;
      })()
    : all;

  const scores = candidates.map((candidate) => {
    return (
      w.interval * scoreInterval(candidate, state.previousPitch, params.leapAllowance) +
      w.chordTone * scoreChordTone(candidate, state.previousPitch, chord, onStrongBeat) +
      w.contour *
        scoreContour(candidate, {
          previousPitch: state.previousPitch,
          direction: state.contourDirection,
          momentum: state.contourMomentum,
          lastIntervalSize: state.lastIntervalSize,
          shape: params.gestureShape,
          phrasePosition: state.phrasePosition,
        }) +
      w.register * scoreRegister(candidate, preset.centerPitch, preset.registerSpread) +
      w.repetition * scoreRepetition(candidate, state.recentPitches) +
      w.tension *
        scoreTension(candidate, chord, tonicChord, params.targetTension, params.forceResolution)
    );
  });

  return sampleSoftmax(candidates, scores, preset.temperature, rng);
}

function sampleSoftmax(
  candidates: number[],
  scores: number[],
  temperature: number,
  rng: () => number,
): number {
  const t = Math.max(0.01, temperature);
  const max = Math.max(...scores);
  const weights = scores.map((s) => Math.exp((s - max) / t));
  const total = weights.reduce((a, b) => a + b, 0);

  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
```

- [ ] **Step 4: Run the transition test**

Run: `cd frontend && npm test -- transition`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/engine/transition.ts frontend/tests/engine/transition.test.ts
git commit -m "feat: add transition engine with six-term weighted note selection"
```

---

### Task 9: MusicEngine facade, state advance, and the determinism guarantee

**Files:**
- Create: `frontend/src/engine/engine.ts`
- Test: `frontend/tests/engine/engine.test.ts`, `frontend/tests/engine/purity.test.ts`

**Interfaces:**
- Consumes: `mapFeatures`, `selectNextPitch`, `createPrng`, `GENRES`
- Produces:
  - `class MusicEngine` with:
    - `constructor(preset: GenrePreset, seed: number)`
    - `step(features: TypingFeatures): MusicalEvent | null`
    - `getState(): Readonly<MusicalState>`
    - `reset(): void`
  - `renderSession(features: TypingFeatures[], preset: GenrePreset, seed: number): MusicalEvent[]`

- [ ] **Step 1: Write the failing engine test**

Create `frontend/tests/engine/engine.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend && npm test -- engine`
Expected: FAIL — cannot resolve `../../src/engine/engine`.

- [ ] **Step 3: Implement the engine facade**

Create `frontend/src/engine/engine.ts`:

```ts
import { mapFeatures } from './mapper';
import { createPrng } from './prng';
import { selectNextPitch } from './transition';
import type {
  ContourDirection,
  GenrePreset,
  MusicalEvent,
  MusicalState,
} from './types';
import type { TypingFeatures } from '../typing/types';

/** How many pitches the repetition penalty remembers. */
const RECENT_PITCH_MEMORY = 8;
/** Keystrokes per phrase, used to advance phrasePosition. */
const PHRASE_LENGTH_EVENTS = 32;

function initialState(preset: GenrePreset): MusicalState {
  return {
    keyRoot: preset.keyRoot,
    scale: preset.scale,
    progression: preset.progression,
    chordIndex: 0,
    previousPitch: preset.centerPitch,
    contourDirection: 0,
    contourMomentum: 0,
    lastIntervalSize: 0,
    phrasePosition: 0,
    energy: 0,
    tension: 0,
    recentPitches: [],
    beatPosition: 0,
  };
}

export class MusicEngine {
  private state: MusicalState;
  private rng: () => number;
  private eventCount = 0;

  constructor(
    private readonly preset: GenrePreset,
    private readonly seed: number,
  ) {
    this.state = initialState(preset);
    this.rng = createPrng(seed);
  }

  reset(): void {
    this.state = initialState(this.preset);
    this.rng = createPrng(this.seed);
    this.eventCount = 0;
  }

  getState(): Readonly<MusicalState> {
    return this.state;
  }

  step(features: TypingFeatures): MusicalEvent | null {
    const params = mapFeatures(features, this.state, this.preset);

    if (params.advanceChord) {
      this.state.chordIndex = (this.state.chordIndex + 1) % this.state.progression.length;
    }

    if (params.isRest) {
      this.advancePhrase();
      return null;
    }

    const pitch = params.echoPrevious
      ? this.state.previousPitch
      : selectNextPitch(this.state, params, this.preset, this.rng);

    this.updateContour(pitch);
    this.state.previousPitch = pitch;
    this.state.recentPitches = [...this.state.recentPitches, pitch].slice(-RECENT_PITCH_MEMORY);
    this.state.energy = Math.min(1, features.speed / 80);
    this.state.tension = params.targetTension;
    this.state.beatPosition = (this.state.beatPosition + params.durationBeats / 4) % 1;

    if (params.forceResolution) {
      this.state.phrasePosition = 0;
      this.eventCount = 0;
    } else {
      this.advancePhrase();
    }

    return {
      pitch,
      velocity: params.velocity,
      durationBeats: params.durationBeats,
      subdivision: params.subdivision,
    };
  }

  private advancePhrase(): void {
    this.eventCount += 1;
    this.state.phrasePosition = (this.eventCount % PHRASE_LENGTH_EVENTS) / PHRASE_LENGTH_EVENTS;
  }

  private updateContour(pitch: number): void {
    const move = pitch - this.state.previousPitch;
    const direction = Math.sign(move) as ContourDirection;
    this.state.lastIntervalSize = Math.abs(move);
    if (direction === this.state.contourDirection && direction !== 0) {
      this.state.contourMomentum += 1;
    } else {
      this.state.contourMomentum = direction === 0 ? 0 : 1;
    }
    this.state.contourDirection = direction;
  }
}

/**
 * Render a whole session headlessly. This is the function the ear-evaluation
 * harness and the future replay feature both call.
 */
export function renderSession(
  features: TypingFeatures[],
  preset: GenrePreset,
  seed: number,
): MusicalEvent[] {
  const engine = new MusicEngine(preset, seed);
  const events: MusicalEvent[] = [];
  for (const f of features) {
    const event = engine.step(f);
    if (event) events.push(event);
  }
  return events;
}
```

- [ ] **Step 4: Run the engine test**

Run: `cd frontend && npm test -- engine`
Expected: PASS, 11 tests.

- [ ] **Step 5: Write the purity test that guards the Global Constraints**

Create `frontend/tests/engine/purity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  'Math.random',
  'Date.now',
  'new Date',
  'performance.now',
  'window.',
  'document.',
  "from 'react'",
  "from 'tone'",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('engine purity', () => {
  const dirs = ['src/engine', 'src/typing'];

  for (const dir of dirs) {
    for (const file of sourceFiles(dir)) {
      // capture.ts is the declared DOM adapter and is exempt.
      if (file.endsWith('capture.ts')) continue;

      it(`${file} contains no impure references`, () => {
        const contents = readFileSync(file, 'utf8');
        for (const needle of FORBIDDEN) {
          expect(contents).not.toContain(needle);
        }
      });
    }
  }
});
```

- [ ] **Step 6: Run the purity test**

Run: `cd frontend && npm test -- purity`
Expected: PASS. If it fails, the named file violates the Global Constraints — fix the source, not the test.

- [ ] **Step 7: Run the whole suite**

Run: `cd frontend && npm test`
Expected: PASS, all tests.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/engine frontend/tests/engine
git commit -m "feat: add MusicEngine facade with enforced determinism and purity"
```

---

### Task 10: Scheduler — beats to wall-clock grid slots

**Files:**
- Create: `frontend/src/audio/scheduler.ts`
- Test: `frontend/tests/audio/scheduler.test.ts`

**Interfaces:**
- Consumes: `MusicalEvent`
- Produces:
  - `interface ScheduledEvent { pitch; velocity; durationSeconds; time }` — all `number`
  - `secondsPerBeat(bpm: number): number`
  - `nextGridTime(now: number, gridSeconds: number, startTime: number): number`
  - `class Scheduler` with `constructor(bpm: number, startTime: number)` and `schedule(event: MusicalEvent, now: number): ScheduledEvent`

- [ ] **Step 1: Write the failing scheduler test**

Create `frontend/tests/audio/scheduler.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Scheduler, nextGridTime, secondsPerBeat } from '../../src/audio/scheduler';
import type { MusicalEvent } from '../../src/engine/types';

function event(overrides: Partial<MusicalEvent> = {}): MusicalEvent {
  return { pitch: 69, velocity: 0.8, durationBeats: 0.5, subdivision: 8, ...overrides };
}

describe('secondsPerBeat', () => {
  it('converts BPM to seconds', () => {
    expect(secondsPerBeat(120)).toBeCloseTo(0.5);
    expect(secondsPerBeat(60)).toBeCloseTo(1);
  });
});

describe('nextGridTime', () => {
  it('snaps forward to the next slot', () => {
    expect(nextGridTime(1.1, 0.25, 0)).toBeCloseTo(1.25);
  });

  it('returns the slot itself when already exactly on the grid', () => {
    expect(nextGridTime(1.0, 0.25, 0)).toBeCloseTo(1.0);
  });

  it('respects a non-zero transport start time', () => {
    expect(nextGridTime(1.1, 0.25, 0.5)).toBeCloseTo(1.25);
  });

  it('never returns a time in the past', () => {
    for (const now of [0.01, 0.37, 1.99, 5.5]) {
      expect(nextGridTime(now, 0.25, 0)).toBeGreaterThanOrEqual(now);
    }
  });
});

describe('Scheduler', () => {
  it('places a note on a grid slot at or after now', () => {
    const scheduler = new Scheduler(120, 0);
    const scheduled = scheduler.schedule(event(), 1.1);
    expect(scheduled.time).toBeGreaterThanOrEqual(1.1);
  });

  it('uses a finer grid for a 16th-note subdivision than an 8th', () => {
    // Separate schedulers: one instance remembers its last slot, which would
    // push the second note forward and invalidate the comparison.
    const eighth = new Scheduler(120, 0).schedule(event({ subdivision: 8 }), 1.01);
    const sixteenth = new Scheduler(120, 0).schedule(event({ subdivision: 16 }), 1.01);
    expect(sixteenth.time - 1.01).toBeLessThan(eighth.time - 1.01);
  });

  it('converts beat duration to seconds using the tempo', () => {
    const scheduler = new Scheduler(120, 0);
    const scheduled = scheduler.schedule(event({ durationBeats: 2 }), 0);
    expect(scheduled.durationSeconds).toBeCloseTo(1);
  });

  it('carries pitch and velocity through unchanged', () => {
    const scheduler = new Scheduler(90, 0);
    const scheduled = scheduler.schedule(event({ pitch: 64, velocity: 0.42 }), 0);
    expect(scheduled.pitch).toBe(64);
    expect(scheduled.velocity).toBeCloseTo(0.42);
  });

  it('never schedules two notes into the same slot', () => {
    const scheduler = new Scheduler(120, 0);
    const a = scheduler.schedule(event(), 1.0);
    const b = scheduler.schedule(event(), 1.0);
    expect(b.time).toBeGreaterThan(a.time);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend && npm test -- scheduler`
Expected: FAIL — cannot resolve `../../src/audio/scheduler`.

- [ ] **Step 3: Implement the scheduler**

Create `frontend/src/audio/scheduler.ts`:

```ts
import type { MusicalEvent } from '../engine/types';

export interface ScheduledEvent {
  pitch: number;
  velocity: number;
  durationSeconds: number;
  /** Transport time, in seconds, at which this note should sound. */
  time: number;
}

export function secondsPerBeat(bpm: number): number {
  return 60 / bpm;
}

/** The first grid slot at or after `now`. Never returns a time in the past. */
export function nextGridTime(now: number, gridSeconds: number, startTime: number): number {
  const elapsed = now - startTime;
  const slot = Math.ceil(elapsed / gridSeconds - 1e-9);
  return startTime + slot * gridSeconds;
}

/**
 * Converts musical time into wall-clock time. This is the only place that
 * knows about seconds — the engine deals exclusively in beats.
 */
export class Scheduler {
  private lastScheduledTime = -Infinity;

  constructor(
    private readonly bpm: number,
    private readonly startTime: number,
  ) {}

  schedule(event: MusicalEvent, now: number): ScheduledEvent {
    const beat = secondsPerBeat(this.bpm);
    const gridSeconds = (beat * 4) / event.subdivision;

    let time = nextGridTime(now, gridSeconds, this.startTime);
    // Two keystrokes can land in one slot; push the second to the next one
    // rather than stacking notes and producing an accidental chord.
    if (time <= this.lastScheduledTime) {
      time = this.lastScheduledTime + gridSeconds;
    }
    this.lastScheduledTime = time;

    return {
      pitch: event.pitch,
      velocity: event.velocity,
      durationSeconds: event.durationBeats * beat,
      time,
    };
  }
}
```

- [ ] **Step 4: Run the scheduler test**

Run: `cd frontend && npm test -- scheduler`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/audio frontend/tests/audio
git commit -m "feat: add grid scheduler converting beats to transport time"
```

---

### Task 11: Instruments

**Files:**
- Create: `frontend/src/audio/instruments.ts`

**Interfaces:**
- Consumes: `InstrumentId` from `engine/types.ts`, Tone.js
- Produces: `createInstrument(id: InstrumentId): Tone.PolySynth | Tone.MonoSynth` connected to the destination

- [ ] **Step 1: Implement the instrument factory**

Tone.js instruments cannot be meaningfully unit-tested without an AudioContext, so this task is verified by ear in Task 13. Keep it small and declarative so there is little to get wrong.

Create `frontend/src/audio/instruments.ts`:

```ts
import * as Tone from 'tone';
import type { InstrumentId } from '../engine/types';

export type Instrument = Tone.PolySynth | Tone.MonoSynth;

/**
 * Each instrument is a Tone.js voice plus its characteristic envelope.
 * Adding one is authoring a case here; nothing in engine/ changes.
 */
export function createInstrument(id: InstrumentId): Instrument {
  switch (id) {
    case 'piano':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 1.2 },
      }).toDestination();

    case 'electricPiano':
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 6,
        envelope: { attack: 0.01, decay: 0.6, sustain: 0.2, release: 1.6 },
      }).toDestination();

    case 'synthLead':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.6 },
      }).toDestination();

    case 'eightBit':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0.25, release: 0.08 },
      }).toDestination();

    case 'bass':
      return new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { Q: 2, type: 'lowpass' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.4 },
        filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, baseFrequency: 120, octaves: 3 },
      }).toDestination();
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/audio/instruments.ts
git commit -m "feat: add Tone.js instrument factory for the five shipping instruments"
```

---

### Task 12: Backing band

**Files:**
- Create: `frontend/src/audio/backing.ts`

**Interfaces:**
- Consumes: `GenrePreset`, `Chord`, Tone.js
- Produces: `class BackingBand` with `constructor(preset: GenrePreset)`, `start(): void`, `stop(): void`, `dispose(): void`, `get chordIndex(): number`

- [ ] **Step 1: Implement the backing band**

Create `frontend/src/audio/backing.ts`:

```ts
import * as Tone from 'tone';
import { pitchClass } from '../engine/theory';
import type { Chord, GenrePreset } from '../engine/types';

const BAR_LENGTH = '1m';

function chordToNotes(chord: Chord, octave: number): string[] {
  return chord.intervals.map((interval) =>
    Tone.Frequency(pitchClass(chord.root + interval) + 12 * octave, 'midi').toNote(),
  );
}

/**
 * Drums, bass and a chord pad, one bar per chord. Deliberately sparse: the
 * lead has to stay audible over it. Makes no musical decisions of its own —
 * the progression comes from the genre preset.
 */
export class BackingBand {
  private readonly pad: Tone.PolySynth;
  private readonly bass: Tone.MonoSynth;
  private readonly kick: Tone.MembraneSynth;
  private readonly hat: Tone.NoiseSynth;
  private chordLoop: Tone.Loop | null = null;
  private drumLoop: Tone.Loop | null = null;
  private index = 0;

  constructor(private readonly preset: GenrePreset) {
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.6, decay: 1, sustain: 0.6, release: 2 },
    }).toDestination();
    this.pad.volume.value = -20;

    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.4 },
    }).toDestination();
    this.bass.volume.value = -14;

    this.kick = new Tone.MembraneSynth().toDestination();
    this.kick.volume.value = -10;

    this.hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    }).toDestination();
    this.hat.volume.value = -26;
  }

  get chordIndex(): number {
    return this.index;
  }

  start(): void {
    Tone.getTransport().bpm.value = this.preset.bpm;

    this.chordLoop = new Tone.Loop((time) => {
      const chord = this.preset.progression[this.index % this.preset.progression.length];
      this.pad.triggerAttackRelease(chordToNotes(chord, 4), '1m', time);
      this.bass.triggerAttackRelease(
        Tone.Frequency(pitchClass(chord.root) + 24, 'midi').toNote(),
        '2n',
        time,
      );
      this.index += 1;
    }, BAR_LENGTH).start(0);

    this.drumLoop = new Tone.Loop((time) => {
      this.kick.triggerAttackRelease('C1', '8n', time);
      this.hat.triggerAttackRelease('16n', time + Tone.Time('4n').toSeconds());
    }, '2n').start(0);

    Tone.getTransport().start();
  }

  stop(): void {
    Tone.getTransport().stop();
    this.chordLoop?.stop();
    this.drumLoop?.stop();
    this.index = 0;
  }

  dispose(): void {
    this.stop();
    this.chordLoop?.dispose();
    this.drumLoop?.dispose();
    this.pad.dispose();
    this.bass.dispose();
    this.kick.dispose();
    this.hat.dispose();
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/audio/backing.ts
git commit -m "feat: add per-genre backing band with drums, bass and chord pad"
```

---

### Task 13: Audio engine, keyboard capture, and the typing surface

**Files:**
- Create: `frontend/src/audio/audioEngine.ts`, `frontend/src/typing/capture.ts`, `frontend/src/ui/TypingSurface.tsx`
- Modify: `frontend/src/ui/App.tsx`, `frontend/src/main.tsx`

**Interfaces:**
- Consumes: everything built in Tasks 2-12
- Produces:
  - `class AudioEngine` with `start(): Promise<void>`, `play(event: MusicalEvent): void`, `stop(): void`, `setGenre(preset: GenrePreset): void`
  - `attachCapture(element: HTMLElement, onKey: (event: KeyEvent) => void): () => void`
  - `<TypingSurface />` React component

- [ ] **Step 1: Implement the audio engine**

Create `frontend/src/audio/audioEngine.ts`:

```ts
import * as Tone from 'tone';
import { BackingBand } from './backing';
import { createInstrument, type Instrument } from './instruments';
import { Scheduler } from './scheduler';
import type { GenrePreset, MusicalEvent } from '../engine/types';

/**
 * The only Tone.js entry point the UI touches. Makes no musical decisions:
 * it receives events the engine already chose and puts them on the grid.
 */
export class AudioEngine {
  private lead: Instrument | null = null;
  private backing: BackingBand | null = null;
  private scheduler: Scheduler | null = null;
  private started = false;

  constructor(private preset: GenrePreset) {}

  async start(): Promise<void> {
    if (this.started) return;
    // Browsers require a user gesture before audio can begin.
    await Tone.start();
    this.build();
    this.started = true;
  }

  private build(): void {
    this.lead = createInstrument(this.preset.leadInstrument);
    this.backing = new BackingBand(this.preset);
    this.backing.start();
    this.scheduler = new Scheduler(this.preset.bpm, Tone.getTransport().seconds);
  }

  setGenre(preset: GenrePreset): void {
    this.preset = preset;
    if (!this.started) return;
    this.teardown();
    this.build();
  }

  play(event: MusicalEvent): void {
    if (!this.lead || !this.scheduler) return;
    const now = Tone.getTransport().seconds;
    const scheduled = this.scheduler.schedule(event, now);
    const note = Tone.Frequency(scheduled.pitch, 'midi').toNote();
    Tone.getTransport().scheduleOnce((time) => {
      this.lead?.triggerAttackRelease(note, scheduled.durationSeconds, time, scheduled.velocity);
    }, scheduled.time);
  }

  stop(): void {
    this.teardown();
    this.started = false;
  }

  private teardown(): void {
    this.backing?.dispose();
    this.lead?.dispose();
    this.backing = null;
    this.lead = null;
    this.scheduler = null;
  }
}
```

- [ ] **Step 2: Implement keyboard capture**

Create `frontend/src/typing/capture.ts`:

```ts
import type { KeyEvent } from './types';

const IGNORED_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

/**
 * The only file in typing/ permitted to touch the DOM. Returns a detach
 * function so React can clean up on unmount.
 */
export function attachCapture(
  element: HTMLElement,
  onKey: (event: KeyEvent) => void,
): () => void {
  const handler = (e: KeyboardEvent) => {
    if (IGNORED_KEYS.has(e.key)) return;
    onKey({ key: e.key, timestamp: performance.now() });
  };
  element.addEventListener('keydown', handler);
  return () => element.removeEventListener('keydown', handler);
}
```

- [ ] **Step 3: Implement the typing surface**

Create `frontend/src/ui/TypingSurface.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { MusicEngine } from '../engine/engine';
import { GENRES, DEFAULT_GENRE_ID } from '../engine/presets';
import { TypingAnalyzer } from '../typing/analyzer';
import { attachCapture } from '../typing/capture';

const SEED = 20260919;

export function TypingSurface() {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const analyzerRef = useRef(new TypingAnalyzer());
  const [genreId, setGenreId] = useState(DEFAULT_GENRE_ID);
  const [running, setRunning] = useState(false);
  const [lastPitch, setLastPitch] = useState<number | null>(null);

  const musicRef = useRef(new MusicEngine(GENRES[DEFAULT_GENRE_ID], SEED));
  const audioRef = useRef(new AudioEngine(GENRES[DEFAULT_GENRE_ID]));

  const handleKey = useCallback((key: { key: string; timestamp: number }) => {
    const features = analyzerRef.current.process(key);
    const event = musicRef.current.step(features);
    if (!event) return;
    audioRef.current.play(event);
    setLastPitch(event.pitch);
  }, []);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    return attachCapture(el, handleKey);
  }, [handleKey]);

  const start = async () => {
    await audioRef.current.start();
    setRunning(true);
    areaRef.current?.focus();
  };

  const changeGenre = (id: string) => {
    setGenreId(id);
    musicRef.current = new MusicEngine(GENRES[id], SEED);
    analyzerRef.current.reset();
    audioRef.current.setGenre(GENRES[id]);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">keytosound</h1>

      <div className="flex items-center gap-3">
        {!running && (
          <button
            onClick={start}
            className="rounded bg-black px-4 py-2 text-white"
          >
            Start audio
          </button>
        )}
        <select
          value={genreId}
          onChange={(e) => changeGenre(e.target.value)}
          className="rounded border px-3 py-2"
        >
          {Object.values(GENRES).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">
          {lastPitch === null ? 'no note yet' : `pitch ${lastPitch}`}
        </span>
      </div>

      <textarea
        ref={areaRef}
        disabled={!running}
        placeholder={running ? 'Start typing...' : 'Press Start audio first'}
        className="h-64 w-full resize-none rounded border p-4 font-mono text-lg outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 4: Wire it into the app**

Replace `frontend/src/ui/App.tsx`:

```tsx
import { TypingSurface } from './TypingSurface';

export default function App() {
  return <TypingSurface />;
}
```

Replace `frontend/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Delete the Vite starter files that are now unused: `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/assets/`.

- [ ] **Step 5: Type-check and run the full suite**

Run: `cd frontend && npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 6: Verify by ear**

Run: `cd frontend && npm run dev`

Open the URL, click **Start audio**, and type a few sentences. Check each of these:

1. A drum pulse and chord pad start as soon as audio starts.
2. Typing produces melody notes over that backing, landing on the beat.
3. Typing faster produces shorter, denser, louder notes.
4. Ending a sentence with `.` lands on a note that sounds like a resting point.
5. The melody does not drift steadily upward or downward and never leaves a comfortable range.
6. The melody does not get stuck repeating one pitch.
7. Switching genre changes tempo, harmony and timbre audibly.

If any of 4-6 fail, the fix is in the scoring weights in `presets.ts`, not in new code. Raise `weights.register` for drift, `weights.repetition` for sticking, `weights.tension` for weak resolutions.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire typing capture through the engine to audible output"
```

---

## What this plan deliberately does not build

Carried to Plans 2 and 3, listed here so no one implements them early:

- Spring Boot, Postgres, Flyway, any REST endpoint
- `SessionRecorder` and composition save/load
- Authentication
- MIDI export
- The Canvas visualizer and the full musical-state readout
- Genres beyond the three shipping presets

## Self-review notes

**Spec coverage.** Spec sections 4.1-4.10 map to Tasks 3, 3, 3, 5, 5, 6-8, 2, 9, 10, 11-13. Sections 4.11 (Visualizer) and 4.12 (SessionRecorder) are Plan 2 by design, as is all of section 6 (backend). Section 7's determinism test and musical-invariant tests are Task 9 and Task 8 respectively; the ear-evaluation harness is `renderSession` in Task 9.

**Known approximation.** The spec's passing-note rule is "approached *and* left by step." `scoreChordTone` can only enforce the first half, since the following note has not been chosen. The second half is enforced implicitly by `scoreInterval` on the next note. This is documented in the source.

**Deferred from spec section 4.4.** `MusicalState.energy` and `.tension` are tracked but only lightly used in this plan; they become load-bearing when the visualizer reads them in Plan 2.

**Two defects found during self-review and fixed inline:**

1. *Forced resolution was not actually forced.* Weighting alone cannot guarantee a phrase ends on the tonic: with Lo-Fi's weights, a conveniently adjacent non-tonic note beats a tonic note five semitones away, because the interval term (1.4 x 0.59) outweighs the tension term (0.7 x 0.95). Task 8 now restricts the candidate set when `forceResolution` is set, rather than merely preferring resolution. Without this, Task 8's resolution test would have failed for a design reason, not an implementation one.
2. *A scheduler test contradicted the scheduler's own collision rule.* The 8th-versus-16th grid test reused one `Scheduler` instance, so the second call was pushed past the first by the same-slot guard and the comparison inverted. Now uses two instances.
