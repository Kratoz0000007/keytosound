import * as Tone from 'tone';
import { sampleUrl, type HitSamples, type PitchedSamples } from './sampleLibrary';
import type { PlayerLike } from './sampledVoices';

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

/**
 * A recorded hit. Every trigger plays a fresh buffer source, as Tone.Sampler
 * does per note. One Tone.Player per file does not work: a Player keeps a
 * single timeline, so a digit's immediate hit at Tone.now() landing before a
 * hit the sequencer had already scheduled ahead threw "The time must be
 * greater than or equal to the last scheduled time", and a restart cut the
 * previous ring short.
 */
class OneShot implements PlayerLike {
  private readonly buffer: Tone.ToneAudioBuffer;
  private readonly output: Tone.Volume;

  constructor(url: string, volume: number, onError: (error: Error) => void) {
    this.output = new Tone.Volume(volume).toDestination();
    this.buffer = new Tone.ToneAudioBuffer(url, undefined, onError);
  }

  get loaded(): boolean {
    return this.buffer.loaded;
  }

  start(time?: number): void {
    const source = new Tone.ToneBufferSource(this.buffer).connect(this.output);
    source.onended = () => source.dispose();
    source.start(time);
  }

  dispose(): void {
    this.buffer.dispose();
    this.output.dispose();
  }
}

export function createPlayers(samples: HitSamples): PlayerLike[] {
  return samples.files.map(
    (file) =>
      new OneShot(sampleUrl(samples.dir, file), samples.volume, (error) =>
        warn(samples.dir, error),
      ),
  );
}
