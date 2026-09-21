import type { Articulation } from '../engine/types';

/**
 * A note is held for this multiple of its written length, unless the next note
 * arrives first and takes over. That overlap is what removes the gaps between
 * letters: in ordinary typing the next key almost always lands inside the hold.
 */
export const LEGATO_HOLD = 1.5;

/** A word's first note re-attacks, but gently, so words stay distinct without a bump. */
export const PHRASE_VELOCITY = 0.75;

/** The parts of a Tone.js monophonic synth the lead drives. */
export interface LeadVoice {
  portamento: number;
  triggerAttack(note: string, time: number, velocity: number): unknown;
  /** Changes pitch without a new attack, sliding over `portamento` seconds. */
  setNote(note: string, time: number): unknown;
  triggerRelease(time?: number): unknown;
  dispose(): unknown;
}

/** The transport, narrowed to what the lead needs; injected so tests can drive it. */
export interface LeadClock {
  scheduleOnce(callback: (time: number) => void, transportSeconds: number): number;
  clear(id: number): unknown;
}

export interface LeadNote {
  note: string;
  /** Audio-context time to sound at. */
  time: number;
  /** The same moment in transport seconds, for scheduling the release. */
  at: number;
  /** Written length in seconds. */
  duration: number;
  velocity: number;
  articulation: Articulation;
}

/**
 * Plays the melody as one connected line rather than separate hits. A slurred
 * note slides into its pitch without re-attacking; a word start re-attacks
 * softly and still slides in; punctuation strikes cleanly with no slide.
 * Voices that cannot glide (glide 0, like a piano) re-strike every note and
 * connect by legato alone.
 */
export class LegatoLead {
  private sounding = false;
  private releaseId: number | null = null;

  constructor(
    private readonly voice: LeadVoice,
    private readonly clock: LeadClock,
    private readonly glideSeconds: number,
  ) {
    voice.portamento = glideSeconds;
  }

  play(n: LeadNote): void {
    // The previous note hands over to this one instead of stopping first.
    this.cancelRelease();

    const canGlide = this.glideSeconds > 0 && this.sounding;
    if (n.articulation === 'slur' && canGlide) {
      this.voice.setNote(n.note, n.time);
    } else if (n.articulation === 'strike') {
      this.voice.portamento = 0;
      this.voice.triggerAttack(n.note, n.time, n.velocity);
      this.voice.portamento = this.glideSeconds;
    } else {
      const velocity = n.articulation === 'phrase' ? n.velocity * PHRASE_VELOCITY : n.velocity;
      this.voice.triggerAttack(n.note, n.time, velocity);
    }
    this.sounding = true;

    this.releaseId = this.clock.scheduleOnce((time) => {
      this.voice.triggerRelease(time);
      this.sounding = false;
      this.releaseId = null;
    }, n.at + n.duration * LEGATO_HOLD);
  }

  /** Silences the line now, e.g. on pause. */
  release(): void {
    this.cancelRelease();
    this.voice.triggerRelease();
    this.sounding = false;
  }

  private cancelRelease(): void {
    if (this.releaseId !== null) {
      this.clock.clear(this.releaseId);
      this.releaseId = null;
    }
  }
}
