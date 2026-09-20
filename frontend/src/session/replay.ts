import type { KeyEvent } from '../typing/types';
import type { RecordedSession } from './types';

/**
 * Injected so replay can be tested with a clock the test drives by hand
 * instead of waiting in real time.
 */
export interface ReplayClock {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(handle: number): void;
}

export const systemClock: ReplayClock = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle),
};

/**
 * Re-emits a recorded keystroke stream on its original timing. It feeds the
 * same pipeline live typing does, so replay is not a special case in the
 * engine — it is the ordinary path with a different source of keystrokes.
 */
export class ReplayPlayer {
  private handles: number[] = [];
  private playing = false;

  constructor(private readonly clock: ReplayClock = systemClock) {}

  play(session: RecordedSession, onKey: (event: KeyEvent) => void, onDone: () => void): void {
    this.stop();

    if (session.keystrokes.length === 0) {
      onDone();
      return;
    }

    this.playing = true;
    const last = session.keystrokes.length - 1;

    session.keystrokes.forEach((keystroke, index) => {
      const handle = this.clock.setTimeout(() => {
        if (!this.playing) return;
        onKey({ key: keystroke.key, timestamp: keystroke.timestamp });
        if (index === last) {
          this.playing = false;
          this.handles = [];
          onDone();
        }
      }, keystroke.timestamp);
      this.handles.push(handle);
    });
  }

  stop(): void {
    for (const handle of this.handles) this.clock.clearTimeout(handle);
    this.handles = [];
    this.playing = false;
  }

  get isPlaying(): boolean {
    return this.playing;
  }
}
