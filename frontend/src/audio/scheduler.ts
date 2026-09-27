import type { MusicalEvent } from '../engine/types';

export interface ScheduledEvent {
  pitch: number;
  velocity: number;
  durationSeconds: number;
  /** Transport time, in seconds, at which this note should sound. */
  time: number;
}

export function secondsPerBeat(bpm: number): number {
  return 60 / bpm;
}

/** The first grid slot at or after `now`. Never returns a time in the past. */
export function nextGridTime(now: number, gridSeconds: number, startTime: number): number {
  const elapsed = now - startTime;
  const slot = Math.ceil(elapsed / gridSeconds - 1e-9);
  return startTime + slot * gridSeconds;
}

/**
 * Converts musical time into wall-clock time. This is the only place that
 * knows about seconds — the engine deals exclusively in beats.
 */
export class Scheduler {
  private lastScheduledTime = -Infinity;

  constructor(
    private readonly bpm: number,
    private readonly startTime: number,
  ) {}

  /**
   * Null when the note would sound too late to belong to its key. Typing
   * faster than the grid used to queue every note a slot behind the last, so
   * a fast sentence at 84 bpm finished playing four seconds after the typing
   * stopped. Now a note waits at most one slot (or a 16th, if longer).
   */
  schedule(event: MusicalEvent, now: number): ScheduledEvent | null {
    const beat = secondsPerBeat(this.bpm);
    const gridSeconds = (beat * 4) / event.subdivision;
    const thirtySecond = beat / 8;

    let time = nextGridTime(now, gridSeconds, this.startTime);
    // Two keystrokes can land in one slot. Stacking them would make an
    // accidental chord, so the second goes to the next 32nd after the first.
    if (time <= this.lastScheduledTime) {
      time = nextGridTime(this.lastScheduledTime + thirtySecond / 2, thirtySecond, this.startTime);
    }
    if (time - now > Math.max(gridSeconds, beat / 4) + 1e-9) return null;
    this.lastScheduledTime = time;

    return {
      pitch: event.pitch,
      velocity: event.velocity,
      durationSeconds: event.durationBeats * beat,
      time,
    };
  }
}
