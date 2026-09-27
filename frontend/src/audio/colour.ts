import * as Tone from 'tone';

/**
 * A genre's colour on the master output, after every voice: Lo-Fi's worn
 * tape. Per genre, like kits: the engine never knows about it.
 */
interface ColourSettings {
  /** Low-pass cutoff: the muffled top end of an old recording. */
  lowpassHz: number;
  /** Pitch wobble depth, 0..1: tape wow. */
  wow: number;
  /** Bit depth of the crushed copy mixed in. */
  bits: number;
  /** How much of the crushed copy is heard, 0..1. */
  crush: number;
}

export const COLOURS: Record<string, ColourSettings> = {
  lofi: { lowpassHz: 3400, wow: 0.06, bits: 8, crush: 0.2 },
};

export interface Colour {
  dispose(): void;
}

/**
 * Routes everything through the genre's colour until disposed. A genre with
 * no colour gets null and a clean output. Only one colour is ever applied:
 * AudioEngine disposes the old genre's before building the next.
 */
export function applyColour(genreId: string): Colour | null {
  const settings = COLOURS[genreId];
  if (!settings) return null;

  const lowpass = new Tone.Filter(settings.lowpassHz, 'lowpass');
  const wow = new Tone.Vibrato({ frequency: 0.5, depth: settings.wow });
  const crusher = new Tone.BitCrusher(settings.bits);
  crusher.wet.value = settings.crush;
  const destination = Tone.getDestination();
  destination.chain(lowpass, wow, crusher);

  return {
    dispose() {
      // chain() with no effects reconnects the output straight through.
      destination.chain();
      for (const node of [lowpass, wow, crusher]) node.dispose();
    },
  };
}
