import * as Tone from 'tone';
import type { InstrumentId } from '../engine/types';

/**
 * The structural contract the audio engine needs. Declared here rather than
 * as a union of Tone classes, because PolySynth and MonoSynth have different
 * generic parameters and a union of them is awkward to call.
 */
export interface Instrument {
  triggerAttackRelease(
    note: string,
    duration: number,
    time: number,
    velocity: number,
  ): unknown;
  dispose(): unknown;
}

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
        filterEnvelope: {
          attack: 0.01,
          decay: 0.2,
          sustain: 0.3,
          baseFrequency: 120,
          octaves: 3,
        },
      }).toDestination();
  }
}
