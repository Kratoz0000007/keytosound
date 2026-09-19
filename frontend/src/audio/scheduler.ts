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

  schedule(event: MusicalEvent, now: number): ScheduledEvent {
    const beat = secondsPerBeat(this.bpm);
    const gridSeconds = (beat * 4) / event.subdivision;

    let time = nextGridTime(now, gridSeconds, this.startTime);
    // Two keystrokes can land in one slot; push the second to the next one
    // rather than stacking notes and producing an accidental chord.
    if (time <= this.lastScheduledTime) {
      time = this.lastScheduledTime + gridSeconds;
    }
    this.lastScheduledTime = time;

    return {
      pitch: event.pitch,
      velocity: event.velocity,
      durationSeconds: event.durationBeats * beat,
      time,
    };
  }
}
