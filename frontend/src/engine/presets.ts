import type { Chord, GenrePreset, Groove } from './types';

const minor = (root: number): Chord => ({ root, intervals: [0, 3, 7] });
const major = (root: number): Chord => ({ root, intervals: [0, 4, 7] });
const minor7 = (root: number): Chord => ({ root, intervals: [0, 3, 7, 10] });
const major7 = (root: number): Chord => ({ root, intervals: [0, 4, 7, 11] });
const dominant7 = (root: number): Chord => ({ root, intervals: [0, 4, 7, 10] });

const EVERY_8TH = [0, 2, 4, 6, 8, 10, 12, 14];
const BACKBEAT = [4, 12];

/** No percussion at all — see the Classical preset. */
const NO_DRUMS: Groove = { kick: [], snare: [], hat: [], bass: [0, 8], swing: 0 };

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
      interval: 2.0,
      chordTone: 1.0,
      contour: 1.2,
      register: 0.8,
      repetition: 0.6,
      tension: 0.7,
    },
    temperature: 0.4,
    centerPitch: 69, // A4
    registerSpread: 9,
    leadInstrument: 'electricPiano',
    // Late kick on step 10 and heavy swing give the dragging feel.
    groove: { kick: [0, 10], snare: BACKBEAT, hat: EVERY_8TH, bass: [0, 8], swing: 0.35 },
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
      interval: 2.1,
      chordTone: 1.3,
      contour: 1.4,
      register: 1.0,
      repetition: 0.9,
      tension: 0.8,
    },
    temperature: 0.32,
    centerPitch: 72, // C5
    registerSpread: 11,
    leadInstrument: 'synthLead',
    // Four on the floor, offbeat hats, driving root-note bass.
    groove: {
      kick: [0, 4, 8, 12],
      snare: BACKBEAT,
      hat: [2, 6, 10, 14],
      bass: [0, 4, 8, 12],
      swing: 0,
    },
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
      interval: 2.2,
      chordTone: 1.5,
      contour: 1.5,
      register: 1.2,
      repetition: 1.1,
      tension: 0.9,
    },
    temperature: 0.24,
    centerPitch: 76, // E5
    registerSpread: 10,
    leadInstrument: 'eightBit',
    // Busy 16th hats, no swing: rigid and mechanical on purpose.
    groove: {
      kick: [0, 6],
      snare: BACKBEAT,
      hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      bass: [0, 4, 8, 12],
      swing: 0,
    },
  },

  jazz: {
    id: 'jazz',
    name: 'Jazz',
    scale: 'dorian',
    keyRoot: 2, // D dorian — the white notes, centred on D
    // Dm7 - G7 - Cmaj7 - Am7. Tonic slot is Dm7, so phrase endings settle
    // modally on D rather than resolving out to C.
    progression: [minor7(2), dominant7(7), major7(0), minor7(9)],
    bpm: 120,
    weights: {
      // A seven-note scale can produce genuine dissonance, unlike pentatonic.
      // chordTone carries far more weight here to compensate.
      interval: 2.0,
      chordTone: 2.4,
      contour: 1.2,
      register: 1.0,
      repetition: 0.8,
      tension: 1.1,
    },
    temperature: 0.3,
    centerPitch: 69, // A4
    registerSpread: 10,
    leadInstrument: 'electricPiano',
    // Swung ride pattern, sparse kick: the drummer comps rather than drives.
    groove: {
      kick: [0],
      snare: [4, 12],
      hat: [0, 3, 4, 7, 8, 11, 12, 15],
      bass: [0, 4, 8, 12],
      swing: 0.5,
    },
  },

  classical: {
    id: 'classical',
    name: 'Classical',
    scale: 'major',
    keyRoot: 0, // C major
    // I - IV - V - I
    progression: [major(0), major(5), major(7), major(0)],
    bpm: 96,
    weights: {
      // Chord-led first, stepwise second. A higher interval weight marches the
      // line through every diatonic degree, including the ones that clash with
      // the chord; letting it skip to a chord tone keeps it consonant.
      interval: 2.0,
      chordTone: 3.2,
      contour: 1.6,
      register: 1.2,
      repetition: 0.7,
      tension: 1.2,
    },
    temperature: 0.2,
    centerPitch: 72, // C5
    registerSpread: 12,
    leadInstrument: 'piano',
    // No percussion. A drum kit under a piano line would be absurd, and the
    // groove model supports opting out rather than needing a special case.
    groove: NO_DRUMS,
  },
};

export const DEFAULT_GENRE_ID = 'lofi';
