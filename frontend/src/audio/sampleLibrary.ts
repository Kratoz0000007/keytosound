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
  /** dB, set by ear against the rest of the band. */
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

const SALAMANDER_NOTES = Object.fromEntries(
  ['A0', 'C1', 'D#1', 'F#1', 'A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4',
    'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6', 'C7', 'D#7', 'F#7', 'A7', 'C8']
    .map((note) => [note, `${note.replace('#', 's')}.mp3`]),
);

/** The seven notes the string samples were taken at (Task 1 manifest). */
const STRING_NOTES = {
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  E4: 'E4.mp3',
  G4: 'G4.mp3',
  B4: 'B4.mp3',
  D5: 'D5.mp3',
};

export const PITCHED: Partial<Record<InstrumentId, PitchedSamples>> = {
  grandPiano: { dir: 'grand-piano', notes: SALAMANDER_NOTES, volume: -4, release: 1.2 },
  strings: { dir: 'strings', notes: STRING_NOTES, volume: -16, release: 1 },
  stringsPizz: { dir: 'strings-pizz', notes: STRING_NOTES, volume: -10, release: 0.3 },
  contrabassArco: {
    dir: 'contrabass-arco',
    notes: { C1: 'C1.mp3', E1: 'E1.mp3', 'G#1': 'Gs1.mp3', 'C#2': 'Cs2.mp3' },
    volume: -10,
    release: 0.6,
  },
};

/** Recorded hits per genre id. A voice left out keeps its synth sound. */
export const KIT_SAMPLES: Record<string, Partial<Record<DrumVoice, HitSamples>>> = {
  classical: {
    kick: { dir: 'timpani', files: ['drum3-1.mp3', 'drum3-2.mp3'], volume: -4 },
    perc: { dir: 'timpani', files: ['drum1-1.mp3', 'drum1-2.mp3'], volume: -6 },
    snare: { dir: 'orchestral-snare', files: ['1.mp3', '2.mp3'], volume: -12 },
    hat: { dir: 'triangle', files: ['muted-1.mp3', 'muted-2.mp3'], volume: -14 },
    openHat: { dir: 'triangle', files: ['open-1.mp3', 'open-2.mp3'], volume: -14 },
    clap: { dir: 'cymbals', files: ['crash-1.mp3', 'crash-2.mp3'], volume: -16 },
    fx: { dir: 'cymbals', files: ['swell.mp3'], volume: -14 },
  },
};
