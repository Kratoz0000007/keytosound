import type { KeyEvent } from '../typing/types';
import type { RecordedSession } from './types';

/**
 * Captures the keystroke stream that produced a performance. Holds no musical
 * knowledge whatsoever — it records input, and the engine turns input into
 * music. Timestamps arrive already in session time (the transport's clock,
 * zero when the band starts) and are stored untouched: harmony depends on
 * which bar each keystroke fell in, so they must not be rebased.
 */
export class SessionRecorder {
  private keystrokes: KeyEvent[] = [];
  private genreId = '';
  private seed = 0;
  private recording = false;

  start(genreId: string, seed: number): void {
    this.keystrokes = [];
    this.genreId = genreId;
    this.seed = seed;
    this.recording = true;
  }

  record(event: KeyEvent): void {
    if (!this.recording) return;
    this.keystrokes.push({ key: event.key, timestamp: event.timestamp });
  }

  snapshot(): RecordedSession {
    return {
      genreId: this.genreId,
      seed: this.seed,
      // Copied, so a snapshot taken now is not mutated by later typing.
      keystrokes: this.keystrokes.map((k) => ({ ...k })),
    };
  }

  clear(): void {
    this.keystrokes = [];
    this.recording = false;
  }

  get count(): number {
    return this.keystrokes.length;
  }

  get isRecording(): boolean {
    return this.recording;
  }
}
