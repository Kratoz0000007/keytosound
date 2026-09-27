import type { LeadVoice } from './lead';

/**
 * The parts of Tone.Sampler used here. Structural, so the logic below can be
 * tested without Tone; audio/samplers.ts builds the real ones.
 */
export interface SamplerLike {
  readonly loaded: boolean;
  triggerAttack(notes: string | string[], time?: number, velocity?: number): unknown;
  triggerRelease(notes: string | string[], time?: number): unknown;
  triggerAttackRelease(
    notes: string | string[],
    duration: number | string,
    time?: number,
    velocity?: number,
  ): unknown;
  releaseAll(time?: number): unknown;
  dispose(): unknown;
}

/** The parts of Tone.Player used here. */
export interface PlayerLike {
  readonly loaded: boolean;
  start(time?: number): unknown;
  dispose(): unknown;
}

/** What the band needs from its pad, bass and stab, recorded or synth. */
export interface ChordVoice {
  play(notes: string[], duration: number | string, time: number): void;
  release(): void;
  dispose(): void;
}

/**
 * A recorded lead that plays its synth fallback until the samples load.
 * Monophonic like every lead: a new note releases the one sounding. A
 * recording cannot slide, so a glide re-strikes; sampled presets set
 * glideSeconds to 0 anyway, and LegatoLead then never asks for one.
 */
export class SampledLead implements LeadVoice {
  private note: string | null = null;
  private velocity = 0.8;
  private fallbackSounding = false;
  private readonly sampler: SamplerLike;
  private readonly fallback: LeadVoice;

  constructor(sampler: SamplerLike, fallback: LeadVoice) {
    this.sampler = sampler;
    this.fallback = fallback;
  }

  get portamento(): number {
    return this.fallback.portamento;
  }

  set portamento(seconds: number) {
    this.fallback.portamento = seconds;
  }

  triggerAttack(note: string, time: number, velocity: number): void {
    this.velocity = velocity;
    if (!this.sampler.loaded) {
      this.fallback.triggerAttack(note, time, velocity);
      this.fallbackSounding = true;
      return;
    }
    if (this.fallbackSounding) {
      this.fallback.triggerRelease(time);
      this.fallbackSounding = false;
    }
    if (this.note !== null) this.sampler.triggerRelease(this.note, time);
    this.sampler.triggerAttack(note, time, velocity);
    this.note = note;
  }

  setNote(note: string, time: number): void {
    if (!this.sampler.loaded) {
      this.fallback.setNote(note, time);
      return;
    }
    this.triggerAttack(note, time, this.velocity);
  }

  triggerRelease(time?: number): void {
    if (this.fallbackSounding) {
      this.fallback.triggerRelease(time);
      this.fallbackSounding = false;
    }
    if (this.note !== null) {
      this.sampler.triggerRelease(this.note, time);
      this.note = null;
    }
  }

  dispose(): void {
    this.sampler.dispose();
    this.fallback.dispose();
  }
}

/** A recorded pad, bass or stab that plays its synth until the samples load. */
export class SampledChords implements ChordVoice {
  private readonly sampler: SamplerLike;
  private readonly fallback: ChordVoice;

  constructor(sampler: SamplerLike, fallback: ChordVoice) {
    this.sampler = sampler;
    this.fallback = fallback;
  }

  play(notes: string[], duration: number | string, time: number): void {
    if (this.sampler.loaded) this.sampler.triggerAttackRelease(notes, duration, time);
    else this.fallback.play(notes, duration, time);
  }

  release(): void {
    this.sampler.releaseAll();
    this.fallback.release();
  }

  dispose(): void {
    this.sampler.dispose();
    this.fallback.dispose();
  }
}

/**
 * A drum voice that plays its recordings in turn, so repeated hits vary.
 * Until every one has loaded it plays the synth hit; a file that never loads
 * leaves the voice on its synth for good, which is the intended failure mode.
 */
export class SampledHit {
  private next = 0;
  private readonly players: PlayerLike[];
  private readonly fallback: (time: number) => void;

  constructor(players: PlayerLike[], fallback: (time: number) => void) {
    this.players = players;
    this.fallback = fallback;
  }

  trigger(time: number): void {
    if (this.players.length === 0 || !this.players.every((p) => p.loaded)) {
      this.fallback(time);
      return;
    }
    this.players[this.next].start(time);
    this.next = (this.next + 1) % this.players.length;
  }

  dispose(): void {
    for (const player of this.players) player.dispose();
  }
}
