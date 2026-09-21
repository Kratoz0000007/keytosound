import * as Tone from 'tone';
import type { InstrumentId } from '../engine/types';
import type { LeadVoice } from './lead';

/**
 * A lead voice plus the effects it plays through. Monophonic on purpose: a
 * line that glides from note to note needs one voice to slide, not a new
 * voice per note.
 */
export interface LeadChain {
  voice: LeadVoice;
  dispose(): void;
}

function voiceFor(id: InstrumentId): Tone.Synth | Tone.FMSynth | Tone.MonoSynth {
  switch (id) {
    case 'piano':
      return new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.4, sustain: 0.25, release: 1.2 },
      });

    case 'electricPiano':
      return new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 6,
        envelope: { attack: 0.01, decay: 0.6, sustain: 0.35, release: 1.6 },
      });

    case 'synthLead':
      return new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.55, release: 0.6 },
      });

    case 'eightBit':
      return new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0.4, release: 0.08 },
      });

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
      });
  }
}

/**
 * Each instrument is a Tone.js voice plus its characteristic envelope, sent
 * through a short echo and a small room so consecutive notes blur into each
 * other. Adding one is authoring a case above; nothing in engine/ changes.
 */
export function createLead(id: InstrumentId): LeadChain {
  const voice = voiceFor(id);
  const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.22, wet: 0.14 });
  const reverb = new Tone.Reverb({ decay: 2.4, wet: 0.24 });
  voice.chain(delay, reverb, Tone.getDestination());
  return {
    voice,
    dispose() {
      voice.dispose();
      delay.dispose();
      reverb.dispose();
    },
  };
}
