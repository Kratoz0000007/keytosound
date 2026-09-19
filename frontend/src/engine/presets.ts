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
