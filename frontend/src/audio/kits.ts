/**
 * How each genre's nine voices sound. Only timbre lives here: which steps
 * they play on comes from the beat pattern, so a digit means the same voice in
 * every genre but sounds native to each one.
 */
export interface Kit {
  kick: { note: string; pitchDecay: number; octaves: number; decay: number; oscillator: OscType };
  perc: { note: string; pitchDecay: number; octaves: number };
  /** Hat colour: white is bright, pink is dusty, brown is brushed. */
  hatNoise: NoiseType;
  stabOscillator: OscType;
  /** Centre of the clap's band-pass: lower sounds boxier. */
  clapHz: number;
}

type OscType = 'sine' | 'triangle' | 'square' | 'sawtooth';
type NoiseType = 'white' | 'pink' | 'brown';

export const KITS: Record<string, Kit> = {
  lofi: {
    kick: { note: 'C1', pitchDecay: 0.05, octaves: 6, decay: 0.4, oscillator: 'sine' },
    perc: { note: 'G2', pitchDecay: 0.03, octaves: 2 },
    hatNoise: 'pink',
    stabOscillator: 'triangle',
    clapHz: 1100,
  },
  synthwave: {
    kick: { note: 'C1', pitchDecay: 0.02, octaves: 8, decay: 0.35, oscillator: 'sine' },
    perc: { note: 'D2', pitchDecay: 0.05, octaves: 4 },
    hatNoise: 'white',
    stabOscillator: 'sawtooth',
    clapHz: 1600,
  },
  eightbit: {
    kick: { note: 'C2', pitchDecay: 0.08, octaves: 4, decay: 0.2, oscillator: 'square' },
    perc: { note: 'C3', pitchDecay: 0.02, octaves: 3 },
    hatNoise: 'white',
    stabOscillator: 'square',
    clapHz: 2200,
  },
  jazz: {
    kick: { note: 'D1', pitchDecay: 0.04, octaves: 4, decay: 0.3, oscillator: 'sine' },
    perc: { note: 'A2', pitchDecay: 0.02, octaves: 1.5 },
    hatNoise: 'brown',
    stabOscillator: 'triangle',
    clapHz: 900,
  },
  classical: {
    // Timpani rather than a kick: a slower pitch fall and a longer ring.
    kick: { note: 'C2', pitchDecay: 0.12, octaves: 2, decay: 0.9, oscillator: 'sine' },
    perc: { note: 'C2', pitchDecay: 0.1, octaves: 1.5 },
    hatNoise: 'pink',
    stabOscillator: 'sine',
    clapHz: 800,
  },
};

export const DEFAULT_KIT = KITS.lofi;
