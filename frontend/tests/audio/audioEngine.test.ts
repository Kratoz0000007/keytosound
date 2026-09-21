import { beforeEach, describe, expect, it, vi } from 'vitest';

// A hand-rolled transport: enough state to see whether the engine starts,
// pauses, stops and clears it, without a real AudioContext.
const transport = {
  state: 'stopped' as 'started' | 'stopped' | 'paused',
  seconds: 0,
  bpm: { value: 0 },
  scheduled: 0,
  start: vi.fn(() => {
    transport.state = 'started';
  }),
  pause: vi.fn(() => {
    transport.state = 'paused';
  }),
  stop: vi.fn(() => {
    transport.state = 'stopped';
  }),
  cancel: vi.fn(() => {
    transport.scheduled = 0;
  }),
  scheduleOnce: vi.fn<(callback: unknown, time: number) => number>(() => {
    transport.scheduled += 1;
    return transport.scheduled;
  }),
  clear: vi.fn(),
};

vi.mock('tone', () => ({
  start: vi.fn(async () => {}),
  getTransport: () => transport,
  Frequency: () => ({ toNote: () => 'C4' }),
}));

const bands: {
  start: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}[] = [];
vi.mock('../../src/audio/backing', () => ({
  BackingBand: vi.fn(function () {
    const band = { start: vi.fn(), dispose: vi.fn(), release: vi.fn() };
    bands.push(band);
    return band;
  }),
}));

vi.mock('../../src/audio/instruments', () => ({
  createLead: () => ({
    voice: {
      portamento: 0,
      triggerAttack: vi.fn(),
      setNote: vi.fn(),
      triggerRelease: vi.fn(),
      dispose: vi.fn(),
    },
    dispose: vi.fn(),
  }),
}));

const { AudioEngine } = await import('../../src/audio/audioEngine');
const { GENRES } = await import('../../src/engine/presets');

const NOTE = {
  pitch: 60,
  velocity: 0.8,
  durationBeats: 0.5,
  subdivision: 8,
  articulation: 'slur',
} as const;

describe('AudioEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bands.length = 0;
    transport.state = 'stopped';
    transport.scheduled = 0;
  });

  it('starts the transport and the band on start', async () => {
    const engine = new AudioEngine(GENRES.lofi);
    await engine.start();
    expect(transport.state).toBe('started');
    expect(bands).toHaveLength(1);
    expect(bands[0].start).toHaveBeenCalled();
  });

  it('keeps the beat running after a genre switch', async () => {
    const engine = new AudioEngine(GENRES.lofi);
    await engine.start();
    engine.setGenre(GENRES.synthwave);
    expect(bands[0].dispose).toHaveBeenCalled();
    expect(bands).toHaveLength(2);
    expect(bands[1].start).toHaveBeenCalled();
    expect(transport.state).toBe('started');
  });

  it('clears notes scheduled under the old genre when switching', async () => {
    const engine = new AudioEngine(GENRES.lofi);
    await engine.start();
    engine.play(NOTE);
    engine.play(NOTE);
    expect(transport.scheduled).toBe(2);
    engine.setGenre(GENRES.jazz);
    // Otherwise they fire again once the restarted transport reaches them.
    expect(transport.scheduled).toBe(0);
  });

  it('pauses and resumes the beat', async () => {
    const engine = new AudioEngine(GENRES.lofi);
    await engine.start();
    engine.pause();
    expect(transport.state).toBe('paused');
    expect(engine.isPaused).toBe(true);
    engine.resume();
    expect(transport.state).toBe('started');
    expect(engine.isPaused).toBe(false);
  });

  it('cuts notes that are still ringing when paused', async () => {
    const engine = new AudioEngine(GENRES.lofi);
    await engine.start();
    engine.pause();
    // Pausing the transport alone leaves a held pad chord sounding for seconds.
    expect(bands[0].release).toHaveBeenCalled();
  });

  it('drops lead notes while paused instead of queueing them', async () => {
    const engine = new AudioEngine(GENRES.lofi);
    await engine.start();
    engine.pause();
    engine.play(NOTE);
    expect(transport.scheduleOnce).not.toHaveBeenCalled();
  });

  it('stays paused across a genre switch', async () => {
    const engine = new AudioEngine(GENRES.lofi);
    await engine.start();
    engine.pause();
    engine.setGenre(GENRES.eightbit);
    expect(transport.state).not.toBe('started');
    engine.resume();
    expect(transport.state).toBe('started');
  });

  it('never schedules a note at a negative time when the transport reads slightly below zero', async () => {
    // Right after a restart Tone can report -3e-12s from float rounding; a
    // negative time makes scheduleOnce throw and the keystroke is lost.
    transport.seconds = -3.4e-12;
    const engine = new AudioEngine(GENRES.lofi);
    await engine.start();
    engine.play(NOTE);
    const time = transport.scheduleOnce.mock.calls[0][1] as unknown as number;
    expect(time).toBeGreaterThanOrEqual(0);
    transport.seconds = 0;
  });

  it('ignores pause and resume before audio has started', () => {
    const engine = new AudioEngine(GENRES.lofi);
    engine.pause();
    engine.resume();
    expect(transport.pause).not.toHaveBeenCalled();
    expect(transport.start).not.toHaveBeenCalled();
    expect(engine.isPaused).toBe(false);
  });
});
