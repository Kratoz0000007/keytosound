import type { KeyEvent } from '../typing/types';
import type { RecordedSession } from './types';

/**
 * Captures the keystroke stream that produced a performance. Holds no musical
 * knowledge whatsoever — it records input, and the engine turns input into
 * music. Timestamps are rebased to the first keystroke so a saved session does
 * not depend on when the page happened to load.
 */
export class SessionRecorder {
  private keystrokes: KeyEvent[] = [];
  private origin: number | null = null;
  private genreId = '';
  private seed = 0;
  private recording = false;

  start(genreId: string, seed: number): void {
    this.keystrokes = [];
    this.origin = null;
    this.genreId = genreId;
    this.seed = seed;
    this.recording = true;
  }

  record(event: KeyEvent): void {
    if (!this.recording) return;
    if (this.origin === null) this.origin = event.timestamp;
    this.keystrokes.push({ key: event.key, timestamp: event.timestamp - this.origin });
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
    this.origin = null;
    this.recording = false;
  }

  get count(): number {
    return this.keystrokes.length;
  }

  get isRecording(): boolean {
    return this.recording;
  }
}
