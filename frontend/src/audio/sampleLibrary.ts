import type { Voice } from '../engine/beat';
import type { InstrumentId } from '../engine/types';

/** The seven voices that are hits rather than notes. */
export type DrumVoice = Exclude<Voice, 'bass' | 'stab'>;

/** A pitched instrument recorded at some notes; the sampler repitches between them. */
export interface PitchedSamples {
  /** Folder under public/samples/. */
  dir: string;
  /** Note name to file. '#' is spelled 's' in file names: it is not URL-safe. */
  notes: Record<string, string>;
  /**
   * dB that makes this instrument, played as the melody, as loud as the synth
   * leads (measured by rendering a line offline, about -20 dB RMS). The band
   * plays its pad, stab and bass quieter than this (audio/backing.ts).
   */
  volume: number;
  /** Seconds a note takes to die away after release. */
  release: number;
}

/** One-shot hits, played in turn so repeats don't sound identical. */
export interface HitSamples {
  dir: string;
  files: string[];
  volume: number;
}

/** Where public/ is served: '/' in dev, the deploy path in production. */
export function sampleUrl(dir: string, file = ''): string {
  return `${import.meta.env.BASE_URL}samples/${dir}/${file}`;
}

/**
 * Note name to file, for files named after the pitch they really sound at.
 * VSCO and VCSL name theirs an octave low, so their files were renamed by
 * measured pitch (scripts/samples/manifest.json); the names here are true.
 */
function named(notes: string[]): Record<string, string> {
  return Object.fromEntries(notes.map((note) => [note, `${note.replace('#', 's')}.mp3`]));
}

const STRING_NOTES = named(['F#4', 'A4', 'C5', 'E5', 'G5', 'B5', 'D6']);

export const PITCHED: Partial<Record<InstrumentId, PitchedSamples>> = {
  grandPiano: {
    dir: 'grand-piano',
    notes: named(['A0', 'C1', 'D#1', 'F#1', 'A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3',
      'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6', 'C7',
      'D#7', 'F#7', 'A7', 'C8']),
    // The Salamander files are quiet (not normalised: copied as published).
    volume: 10,
    release: 1.2,
  },
  strings: { dir: 'strings', notes: STRING_NOTES, volume: 0, release: 1 },
  stringsPizz: { dir: 'strings-pizz', notes: STRING_NOTES, volume: -1, release: 0.3 },
  contrabassArco: {
    dir: 'contrabass-arco',
    notes: named(['C2', 'E2', 'G#2', 'C#3']),
    volume: -5,
    release: 0.6,
  },
  contrabassPizz: {
    dir: 'contrabass-pizz',
    notes: named(['E1', 'G1', 'A#1', 'C2', 'E2', 'G#2', 'C#3', 'E3']),
    volume: -6,
    release: 0.4,
  },
  tenorSax: {
    dir: 'tenor-sax',
    notes: named(['C4', 'D4', 'E4', 'F#4', 'A#4', 'C5', 'D5', 'E5', 'G5', 'A#5', 'C6', 'D6']),
    volume: -5,
    release: 0.25,
  },
  harmonium: {
    dir: 'harmonium',
    notes: named(['C2', 'D#2', 'G2', 'A#2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4',
      'C5', 'D5']),
    volume: 0,
    release: 0.4,
  },
  uprightPiano: {
    dir: 'upright-piano',
    notes: named(['C2', 'G2', 'C3', 'G3', 'C4', 'G4', 'C5', 'G5']),
    volume: 0,
    release: 1,
  },
};

const TABLA = 'tabla';

/**
 * Recorded hits per genre id. A voice left out keeps its synth sound. Every
 * file peaks at -1 dB (scripts/samples/fetch.mjs), so the volumes are the mix:
 * kick and snare up front, cymbals well back.
 */
export const KIT_SAMPLES: Record<string, Partial<Record<DrumVoice, HitSamples>>> = {
  classical: {
    kick: { dir: 'timpani', files: ['drum3-1.mp3', 'drum3-2.mp3'], volume: -6 },
    perc: { dir: 'timpani', files: ['drum1-1.mp3', 'drum1-2.mp3'], volume: -10 },
    snare: { dir: 'orchestral-snare', files: ['1.mp3', '2.mp3'], volume: -12 },
    hat: { dir: 'triangle', files: ['muted-1.mp3', 'muted-2.mp3'], volume: -20 },
    openHat: { dir: 'triangle', files: ['open-1.mp3', 'open-2.mp3'], volume: -20 },
    clap: { dir: 'cymbals', files: ['crash-1.mp3', 'crash-2.mp3'], volume: -18 },
    fx: { dir: 'cymbals', files: ['swell.mp3'], volume: -18 },
  },
  // Tabla bols on the drum keys: ghe is the deep left hand, na and te/ke the
  // sharp right hand, tun the ringing open stroke.
  sufi: {
    kick: { dir: TABLA, files: ['ghe-1.mp3', 'ghe-2.mp3', 'ghe-3.mp3'], volume: -10 },
    snare: { dir: TABLA, files: ['na-1.mp3', 'na-2.mp3'], volume: -12 },
    hat: { dir: TABLA, files: ['te-1.mp3', 'ke-1.mp3', 'te-2.mp3', 'ke-2.mp3'], volume: -16 },
    openHat: { dir: TABLA, files: ['tun-1.mp3', 'tun-2.mp3'], volume: -14 },
    clap: { dir: 'claps', files: ['1.mp3', '2.mp3', '3.mp3', '4.mp3'], volume: -16 },
    perc: { dir: 'daf', files: ['low-1.mp3', 'high-1.mp3', 'low-2.mp3', 'high-2.mp3'], volume: -14 },
    fx: { dir: 'finger-cymbals', files: ['1.mp3'], volume: -24 },
  },
  // A brushed small-group kit: the hat voice is the ride, which carries the
  // swing, and the clap is the hi-hat's foot chick.
  jazz: {
    kick: { dir: 'jazz-kit', files: ['kick-1.mp3', 'kick-2.mp3'], volume: -10 },
    snare: { dir: 'jazz-kit', files: ['snare-1.mp3', 'snare-2.mp3'], volume: -10 },
    hat: { dir: 'jazz-kit', files: ['ride-1.mp3', 'ride-2.mp3'], volume: -14 },
    openHat: { dir: 'jazz-kit', files: ['open-hat-1.mp3', 'open-hat-2.mp3'], volume: -20 },
    clap: { dir: 'jazz-kit', files: ['chick-1.mp3', 'chick-2.mp3'], volume: -16 },
    perc: { dir: 'jazz-kit', files: ['tom.mp3'], volume: -12 },
    fx: { dir: 'cymbals', files: ['swell.mp3'], volume: -20 },
  },
  lofi: {
    kick: { dir: 'lofi-kit', files: ['kick-1.mp3', 'kick-2.mp3'], volume: -4 },
    snare: { dir: 'lofi-kit', files: ['snare-1.mp3', 'snare-2.mp3'], volume: -8 },
    hat: { dir: 'lofi-kit', files: ['hat-1.mp3', 'hat-2.mp3'], volume: -18 },
    openHat: { dir: 'jazz-kit', files: ['open-hat-1.mp3', 'open-hat-2.mp3'], volume: -22 },
    clap: { dir: 'claps', files: ['1.mp3', '2.mp3', '3.mp3', '4.mp3'], volume: -14 },
    perc: { dir: 'lofi-kit', files: ['tom.mp3'], volume: -12 },
    fx: { dir: 'vinyl', files: ['scratch.mp3'], volume: -16 },
  },
};

/** A quiet recording looped under a genre for as long as the beat runs. */
export interface AmbienceSamples {
  dir: string;
  file: string;
  volume: number;
}

export const AMBIENCE: Record<string, AmbienceSamples> = {
  lofi: { dir: 'vinyl', file: 'hiss.mp3', volume: -18 },
};
