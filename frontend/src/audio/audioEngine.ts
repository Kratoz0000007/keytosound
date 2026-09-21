import * as Tone from 'tone';
import { BackingBand, type BandSource } from './backing';
import { createLead, type LeadChain } from './instruments';
import { LegatoLead } from './lead';
import { Scheduler } from './scheduler';
import type { Voice } from '../engine/beat';
import type { GenrePreset, MusicalEvent } from '../engine/types';

/**
 * The transport's position, never below zero. Just after a restart Tone can
 * report a tiny negative value from float rounding (-3e-12s was observed),
 * and any time derived from it then makes scheduleOnce throw a RangeError.
 */
function transportSeconds(): number {
  return Math.max(0, Tone.getTransport().seconds);
}

/**
 * The only Tone.js entry point the UI touches. Makes no musical decisions:
 * it receives events the engine already chose and puts them on the grid.
 * It is also the sole owner of the transport, so start, pause and genre
 * switches cannot disagree about whether the beat should be running.
 */
export class AudioEngine {
  private chain: LeadChain | null = null;
  private lead: LegatoLead | null = null;
  private backing: BackingBand | null = null;
  private scheduler: Scheduler | null = null;
  private started = false;
  private paused = false;

  constructor(
    private preset: GenrePreset,
    /** A getter, since the engine behind it is replaced on genre switch and replay. */
    private readonly source: () => BandSource = () => {
      throw new Error('AudioEngine has no band source');
    },
  ) {}

  async start(): Promise<void> {
    if (this.started) return;
    // Browsers require a user gesture before audio can begin.
    await Tone.start();
    this.build();
    this.started = true;
  }

  private build(): void {
    this.chain = createLead(this.preset.leadInstrument);
    const transport = Tone.getTransport();
    this.lead = new LegatoLead(
      this.chain.voice,
      {
        scheduleOnce: (callback, at) => transport.scheduleOnce(callback, at),
        clear: (id) => transport.clear(id),
      },
      this.preset.glideSeconds,
    );
    this.backing = new BackingBand(this.preset, this.source);
    this.backing.start();
    // A paused engine stays paused across a genre switch; resume() starts it.
    if (!this.paused) transport.start();
    this.scheduler = new Scheduler(this.preset.bpm, transportSeconds());
  }

  setGenre(preset: GenrePreset): void {
    this.preset = preset;
    if (!this.started) return;
    this.teardown();
    this.build();
  }

  play(event: MusicalEvent): void {
    // Dropped rather than queued: a paused transport would otherwise burst
    // every note typed during the pause the moment it resumed.
    if (!this.lead || !this.scheduler || this.paused) return;
    const now = transportSeconds();
    const scheduled = this.scheduler.schedule(event, now);
    const note = Tone.Frequency(scheduled.pitch, 'midi').toNote();
    Tone.getTransport().scheduleOnce((time) => {
      this.lead?.play({
        note,
        time,
        at: scheduled.time,
        duration: scheduled.durationSeconds,
        velocity: scheduled.velocity,
        articulation: event.articulation,
      });
    }, scheduled.time);
  }

  /**
   * Session time in ms on the transport's clock. Keystrokes are stamped with
   * this, so it skips paused time and restarts on a genre switch exactly as
   * the band's bars do — the melody and the band share one timeline.
   */
  sessionMs(): number {
    return transportSeconds() * 1000;
  }

  /** Immediate feedback for a digit whose step has already gone by this bar. */
  hit(voice: Voice): void {
    if (this.paused) return;
    this.backing?.trigger(voice);
  }

  pause(): void {
    if (!this.started || this.paused) return;
    Tone.getTransport().pause();
    this.backing?.release();
    this.lead?.release();
    this.paused = true;
  }

  resume(): void {
    if (!this.started || !this.paused) return;
    Tone.getTransport().start();
    this.paused = false;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  stop(): void {
    this.teardown();
    this.started = false;
    this.paused = false;
  }

  private teardown(): void {
    const transport = Tone.getTransport();
    transport.stop();
    // Lead notes already queued for the old genre would otherwise replay
    // once the restarted transport's clock reaches their times again.
    transport.cancel(0);
    this.backing?.dispose();
    this.chain?.dispose();
    this.backing = null;
    this.chain = null;
    this.lead = null;
    this.scheduler = null;
  }
}
