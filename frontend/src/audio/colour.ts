import * as Tone from 'tone';

/**
 * A genre's colour on the master output, after every voice: Lo-Fi's worn
 * tape. Per genre, like kits: the engine never knows about it. Every genre's
 * chain ends in a limiter, so a loud band never clips the speakers.
 */
interface ColourSettings {
  /** Low-pass cutoff: the muffled top end of an old recording. */
  lowpassHz: number;
  /** Pitch wobble depth, 0..1: tape wow. */
  wow: number;
  /** Tape saturation, 0..1: warm, rounded peaks rather than digital grit. */
  drive: number;
}

export const COLOURS: Record<string, ColourSettings> = {
  lofi: { lowpassHz: 2600, wow: 0.08, drive: 0.12 },
};

/** Just under full scale, so the limiter has room to catch a peak. */
const LIMIT_DB = -1;

export interface Colour {
  dispose(): void;
}

/**
 * Routes everything through the genre's colour and the limiter until
 * disposed. Only one is ever applied: AudioEngine disposes the old genre's
 * before building the next.
 */
export function applyColour(genreId: string): Colour {
  const settings = COLOURS[genreId];
  const effects: Tone.ToneAudioNode[] = [];
  if (settings) {
    effects.push(
      new Tone.Filter({ frequency: settings.lowpassHz, type: 'lowpass', rolloff: -24 }),
      new Tone.Vibrato({ frequency: 0.5, depth: settings.wow }),
      new Tone.Distortion({ distortion: settings.drive, oversample: '2x' }),
    );
  }
  effects.push(new Tone.Limiter(LIMIT_DB));
  const destination = Tone.getDestination();
  destination.chain(...effects);

  return {
    dispose() {
      // chain() with no effects reconnects the output straight through.
      destination.chain();
      for (const node of effects) node.dispose();
    },
  };
}
