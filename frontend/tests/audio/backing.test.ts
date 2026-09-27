import { describe, expect, it, vi } from 'vitest';

/** Stands in for every Tone.js synth, filter and effect the band builds. */
const nodes: FakeNode[] = [];
class FakeNode {
  volume = { value: 0 };
  constructor() {
    nodes.push(this);
  }
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

/** Never reports loaded, so the band must keep playing its synth voices. */
const samplers: FakeSampler[] = [];
class FakeSampler extends FakeNode {
  loaded = false;
  constructor() {
    super();
    samplers.push(this);
  }
}

/** One per recorded hit file; never loaded, like the samplers. */
const players: FakeBuffer[] = [];
class FakeBuffer extends FakeNode {
  loaded = false;
  constructor() {
    super();
    players.push(this);
  }
}

/** A fresh source per hit that actually plays a recording. */
const hitSources: FakeNode[] = [];
class FakeBufferSource extends FakeNode {
  loop = false;
  start = vi.fn();
  stop = vi.fn();
  constructor() {
    super();
    hitSources.push(this);
  }
}

const sequences: FakeSequence[] = [];

/**
 * Mimics Tone's Sequence near transport time zero: stop() computes a stop time
 * from the transport position, which just after a restart can be -4e-13s, and
 * Tone rejects it with a RangeError.
 */
class FakeSequence {
  readonly step: (time: number, step: number) => void;
  constructor(step: (time: number, step: number) => void) {
    this.step = step;
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
  Sampler: FakeSampler,
  ToneAudioBuffer: FakeBuffer,
  ToneBufferSource: FakeBufferSource,
  Volume: FakeNode,
  Sequence: FakeSequence,
  Time: () => ({ toSeconds: () => 0.125 }),
  // Notes come out as their MIDI number, so a test can read the octave.
  Frequency: (midi: number) => ({ toNote: () => `m${midi}` }),
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

  it('builds recorded voices for a sampled genre and disposes them', () => {
    const firstSampler = samplers.length;
    const firstPlayer = players.length;
    const engine = new MusicEngine(GENRES.classical, 1);
    const band = new BackingBand(GENRES.classical, () => engine);
    const built = [...samplers.slice(firstSampler), ...players.slice(firstPlayer)];
    // Pad, bass and stab samplers; two or one players per sampled drum voice.
    expect(samplers.slice(firstSampler)).toHaveLength(3);
    expect(players.slice(firstPlayer).length).toBeGreaterThanOrEqual(7);

    band.start();
    band.dispose();

    for (const node of built) expect(node.dispose).toHaveBeenCalled();
  });

  it('plays the synth hit while a recording is still loading', () => {
    const engine = new MusicEngine(GENRES.classical, 1);
    const band = new BackingBand(GENRES.classical, () => engine);
    band.trigger('kick', 1);
    // Fake buffers never report loaded, so every hit must go to the synth.
    expect(hitSources).toHaveLength(0);
    band.dispose();
  });

  it('builds no recorded voices for a synth genre', () => {
    const start = samplers.length;
    const engine = new MusicEngine(GENRES.synthwave, 1);
    new BackingBand(GENRES.synthwave, () => engine).dispose();
    expect(samplers).toHaveLength(start);
  });

  /** Every note any synth or sampler in the band was asked to play. */
  function played(): unknown[] {
    return nodes.flatMap((node) => node.triggerAttackRelease.mock.calls.map((call) => call[0]));
  }

  it("puts Classical's strings and bass in the octaves they really sound in", () => {
    nodes.length = 0;
    const engine = new MusicEngine(GENRES.classical, 1);
    const band = new BackingBand(GENRES.classical, () => engine);
    band.start();
    sequences.at(-1)!.step(0, 0);
    band.trigger('bass', 1);

    // C major from C4, and the bass's C2: what the band sounded like before
    // the octave-low sample names were corrected.
    expect(played()).toContainEqual(['m60', 'm64', 'm67']);
    expect(played()).toContain('m36');
    band.dispose();
  });

  it('keeps the default octaves for a genre that names none', () => {
    nodes.length = 0;
    const engine = new MusicEngine(GENRES.synthwave, 1);
    const band = new BackingBand(GENRES.synthwave, () => engine);
    band.start();
    sequences.at(-1)!.step(0, 0);
    band.trigger('bass', 1);

    // Fm, every chord tone in the octave from C3, and the bass's F1.
    expect(played()).toContainEqual(['m53', 'm56', 'm48']);
    expect(played()).toContain('m29');
    band.dispose();
  });

  it('drones Sa and Pa under every Sufi bar', () => {
    nodes.length = 0;
    const engine = new MusicEngine(GENRES.sufi, 1);
    const band = new BackingBand(GENRES.sufi, () => engine);
    band.start();
    sequences.at(-1)!.step(0, 0);

    expect(played()).toContainEqual(['m48', 'm55']);
    band.dispose();
  });

  it("builds Lo-Fi's vinyl bed and frees it with the band", () => {
    const start = players.length;
    const engine = new MusicEngine(GENRES.lofi, 1);
    const band = new BackingBand(GENRES.lofi, () => engine);
    band.startAmbience();
    band.release();
    band.dispose();
    const built = players.slice(start);
    expect(built.length).toBeGreaterThan(7);
    for (const buffer of built) expect(buffer.dispose).toHaveBeenCalled();
  });
});
