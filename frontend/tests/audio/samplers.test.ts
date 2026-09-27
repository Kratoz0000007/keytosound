import { describe, expect, it, vi } from 'vitest';

const sources: FakeSource[] = [];
class FakeSource {
  onended: (() => void) | null = null;
  start = vi.fn();
  dispose = vi.fn();
  constructor() {
    sources.push(this);
  }
  connect() {
    return this;
  }
}

class FakeBuffer {
  loaded = true;
  dispose = vi.fn();
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

const { createPlayers } = await import('../../src/audio/samplers');

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
