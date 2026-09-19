import * as Tone from 'tone';
import { BackingBand } from './backing';
import { createInstrument, type Instrument } from './instruments';
import { Scheduler } from './scheduler';
import type { GenrePreset, MusicalEvent } from '../engine/types';

/**
 * The only Tone.js entry point the UI touches. Makes no musical decisions:
 * it receives events the engine already chose and puts them on the grid.
 */
export class AudioEngine {
  private lead: Instrument | null = null;
  private backing: BackingBand | null = null;
  private scheduler: Scheduler | null = null;
  private started = false;

  constructor(private preset: GenrePreset) {}

  async start(): Promise<void> {
    if (this.started) return;
    // Browsers require a user gesture before audio can begin.
    await Tone.start();
    this.build();
    this.started = true;
  }

  private build(): void {
    this.lead = createInstrument(this.preset.leadInstrument);
    this.backing = new BackingBand(this.preset);
    this.backing.start();
    this.scheduler = new Scheduler(this.preset.bpm, Tone.getTransport().seconds);
  }

  setGenre(preset: GenrePreset): void {
    this.preset = preset;
    if (!this.started) return;
    this.teardown();
    this.build();
  }

  play(event: MusicalEvent): void {
    if (!this.lead || !this.scheduler) return;
    const now = Tone.getTransport().seconds;
    const scheduled = this.scheduler.schedule(event, now);
    const note = Tone.Frequency(scheduled.pitch, 'midi').toNote();
    Tone.getTransport().scheduleOnce((time) => {
      this.lead?.triggerAttackRelease(note, scheduled.durationSeconds, time, scheduled.velocity);
    }, scheduled.time);
  }

  stop(): void {
    this.teardown();
    this.started = false;
  }

  private teardown(): void {
    this.backing?.dispose();
    this.lead?.dispose();
    this.backing = null;
    this.lead = null;
    this.scheduler = null;
  }
}
