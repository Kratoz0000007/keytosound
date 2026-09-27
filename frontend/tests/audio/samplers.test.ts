import { describe, expect, it, vi } from 'vitest';

const sources: FakeSource[] = [];
class FakeSource {
  onended: (() => void) | null = null;
  loop = false;
  start = vi.fn();
  stop = vi.fn();
  dispose = vi.fn();
  constructor() {
    sources.push(this);
  }
  connect() {
    return this;
  }
}

/** Loaded at once unless a test says otherwise; onload is kept to fire later. */
let loadedOnCreate = true;
const buffers: FakeBuffer[] = [];
class FakeBuffer {
  loaded = loadedOnCreate;
  dispose = vi.fn();
  readonly onload?: () => void;
  constructor(_url: string, onload?: () => void) {
    this.onload = onload;
    buffers.push(this);
  }
  finishLoading() {
    this.loaded = true;
    this.onload?.();
  }
}

class FakeVolume {
  dispose = vi.fn();
  toDestination() {
    return this;
  }
}

vi.mock('tone', () => ({
  ToneAudioBuffer: FakeBuffer,
  ToneBufferSource: FakeSource,
  Volume: FakeVolume,
}));

const { Ambience, createPlayers } = await import('../../src/audio/samplers');

describe('createPlayers', () => {
  it('plays every hit on its own source, so out-of-order times cannot collide', () => {
    // A digit's immediate hit at Tone.now() can land before a hit the
    // sequencer already scheduled ahead. One shared Tone.Player threw on that.
    const [hit] = createPlayers({ dir: 'cymbals', files: ['swell.mp3'], volume: -14 });

    expect(() => {
      hit.start(2);
      hit.start(1);
    }).not.toThrow();

    expect(sources).toHaveLength(2);
    expect(sources[0].start).toHaveBeenCalledWith(2);
    expect(sources[1].start).toHaveBeenCalledWith(1);
  });

  it('frees each source when it finishes', () => {
    const [hit] = createPlayers({ dir: 'cymbals', files: ['crash-1.mp3'], volume: -16 });
    hit.start(0);
    const source = sources.at(-1)!;

    source.onended?.();

    expect(source.dispose).toHaveBeenCalled();
  });

  it('makes one player per file', () => {
    expect(createPlayers({ dir: 'timpani', files: ['a.mp3', 'b.mp3'], volume: -4 })).toHaveLength(2);
  });
});

describe('Ambience', () => {
  const hiss = { dir: 'vinyl', file: 'hiss.mp3', volume: -24 };

  it('loops the bed once started, and stops and frees it on stop', () => {
    const bed = new Ambience(hiss);
    const before = sources.length;
    bed.start();
    const source = sources.at(-1)!;
    expect(sources).toHaveLength(before + 1);
    expect(source.loop).toBe(true);
    expect(source.start).toHaveBeenCalled();

    bed.stop();
    expect(source.stop).toHaveBeenCalled();
    expect(source.dispose).toHaveBeenCalled();
  });

  it('never plays two copies when started twice', () => {
    const bed = new Ambience(hiss);
    const before = sources.length;
    bed.start();
    bed.start();
    expect(sources).toHaveLength(before + 1);
    bed.dispose();
  });

  it('starts on load if asked while loading, but not if stopped since', () => {
    loadedOnCreate = false;
    const wanted = new Ambience(hiss);
    const unwanted = new Ambience(hiss);
    loadedOnCreate = true;
    const [wantedBuffer, unwantedBuffer] = buffers.slice(-2);
    const before = sources.length;

    wanted.start();
    unwanted.start();
    unwanted.stop();
    expect(sources).toHaveLength(before);

    wantedBuffer.finishLoading();
    unwantedBuffer.finishLoading();
    expect(sources).toHaveLength(before + 1);
  });
});
