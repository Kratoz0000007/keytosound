import * as Tone from 'tone';
import { sampleUrl, type HitSamples, type PitchedSamples } from './sampleLibrary';

/** One warning per failed folder, then the voice quietly stays on its synth. */
function warn(dir: string, error: unknown): void {
  console.warn(`Samples in public/samples/${dir} failed to load; using the synth sound.`, error);
}

/** Loads in the background; `loaded` turns true when every note is ready. */
export function createSampler(samples: PitchedSamples): Tone.Sampler {
  const sampler = new Tone.Sampler({
    urls: samples.notes,
    baseUrl: sampleUrl(samples.dir),
    release: samples.release,
    onerror: (error) => warn(samples.dir, error),
  });
  sampler.volume.value = samples.volume;
  return sampler;
}

export function createPlayers(samples: HitSamples): Tone.Player[] {
  return samples.files.map((file) => {
    const player = new Tone.Player({
      url: sampleUrl(samples.dir, file),
      onerror: (error) => warn(samples.dir, error),
    }).toDestination();
    player.volume.value = samples.volume;
    return player;
  });
}
