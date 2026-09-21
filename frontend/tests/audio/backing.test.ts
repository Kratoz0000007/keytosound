import { describe, expect, it, vi } from 'vitest';

/** Stands in for every Tone.js synth, filter and effect the band builds. */
class FakeNode {
  volume = { value: 0 };
  toDestination() {
    return this;
  }
  connect() {
    return this;
  }
  triggerAttackRelease = vi.fn();
  releaseAll = vi.fn();
  triggerRelease = vi.fn();
  dispose = vi.fn();
}

const sequences: FakeSequence[] = [];

/**
 * Mimics Tone's Sequence near transport time zero: stop() computes a stop time
 * from the transport position, which just after a restart can be -4e-13s, and
 * Tone rejects it with a RangeError.
 */
class FakeSequence {
  constructor() {
    sequences.push(this);
  }
  start() {
    return this;
  }
  stop(): never {
    throw new RangeError('Value must be within [0, Infinity], got: -4.26e-13');
  }
  dispose = vi.fn();
}

vi.mock('tone', () => ({
  PolySynth: FakeNode,
  Synth: FakeNode,
  MonoSynth: FakeNode,
  MembraneSynth: FakeNode,
  NoiseSynth: FakeNode,
  Filter: FakeNode,
  Sequence: FakeSequence,
  Time: () => ({ toSeconds: () => 0.125 }),
  Frequency: () => ({ toNote: () => 'C4' }),
  now: () => 0,
  getTransport: () => ({ bpm: { value: 0 }, getSecondsAtTime: () => 0 }),
}));

const { BackingBand } = await import('../../src/audio/backing');
const { GENRES } = await import('../../src/engine/presets');
const { MusicEngine } = await import('../../src/engine/engine');

describe('BackingBand', () => {
  it('disposes cleanly right after the transport restarts', () => {
    // A genre switch moments after Start used to throw here, abort the switch
    // half-way, and leave the app with no lead instrument.
    const engine = new MusicEngine(GENRES.lofi, 1);
    const band = new BackingBand(GENRES.lofi, () => engine);
    band.start();
    expect(() => band.dispose()).not.toThrow();
    expect(sequences.at(-1)!.dispose).toHaveBeenCalled();
  });
});
