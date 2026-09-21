import { describe, it, expect } from 'vitest';
import { Scheduler, nextGridTime, secondsPerBeat } from '../../src/audio/scheduler';
import type { MusicalEvent } from '../../src/engine/types';

function event(overrides: Partial<MusicalEvent> = {}): MusicalEvent {
  return {
    pitch: 69,
    velocity: 0.8,
    durationBeats: 0.5,
    subdivision: 8,
    articulation: 'slur',
    ...overrides,
  };
}

describe('secondsPerBeat', () => {
  it('converts BPM to seconds', () => {
    expect(secondsPerBeat(120)).toBeCloseTo(0.5);
    expect(secondsPerBeat(60)).toBeCloseTo(1);
  });
});

describe('nextGridTime', () => {
  it('snaps forward to the next slot', () => {
    expect(nextGridTime(1.1, 0.25, 0)).toBeCloseTo(1.25);
  });

  it('returns the slot itself when already exactly on the grid', () => {
    expect(nextGridTime(1.0, 0.25, 0)).toBeCloseTo(1.0);
  });

  it('respects a non-zero transport start time', () => {
    expect(nextGridTime(1.1, 0.25, 0.5)).toBeCloseTo(1.25);
  });

  it('never returns a time in the past', () => {
    for (const now of [0.01, 0.37, 1.99, 5.5]) {
      expect(nextGridTime(now, 0.25, 0)).toBeGreaterThanOrEqual(now);
    }
  });
});

describe('Scheduler', () => {
  it('places a note on a grid slot at or after now', () => {
    const scheduler = new Scheduler(120, 0);
    const scheduled = scheduler.schedule(event(), 1.1);
    expect(scheduled.time).toBeGreaterThanOrEqual(1.1);
  });

  it('uses a finer grid for a 16th-note subdivision than an 8th', () => {
    // Separate schedulers: one instance remembers its last slot, which would
    // push the second note forward and invalidate the comparison.
    const eighth = new Scheduler(120, 0).schedule(event({ subdivision: 8 }), 1.01);
    const sixteenth = new Scheduler(120, 0).schedule(event({ subdivision: 16 }), 1.01);
    expect(sixteenth.time - 1.01).toBeLessThan(eighth.time - 1.01);
  });

  it('converts beat duration to seconds using the tempo', () => {
    const scheduler = new Scheduler(120, 0);
    const scheduled = scheduler.schedule(event({ durationBeats: 2 }), 0);
    expect(scheduled.durationSeconds).toBeCloseTo(1);
  });

  it('carries pitch and velocity through unchanged', () => {
    const scheduler = new Scheduler(90, 0);
    const scheduled = scheduler.schedule(event({ pitch: 64, velocity: 0.42 }), 0);
    expect(scheduled.pitch).toBe(64);
    expect(scheduled.velocity).toBeCloseTo(0.42);
  });

  it('never schedules two notes into the same slot', () => {
    const scheduler = new Scheduler(120, 0);
    const a = scheduler.schedule(event(), 1.0);
    const b = scheduler.schedule(event(), 1.0);
    expect(b.time).toBeGreaterThan(a.time);
  });
});
