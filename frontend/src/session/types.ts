import type { KeyEvent } from '../typing/types';

/**
 * Everything needed to reproduce a performance. Deliberately the *input* to
 * the engine, not its output: because the engine is deterministic, this plus
 * the seed regenerates the identical note sequence, and it costs kilobytes
 * rather than megabytes of audio.
 */
export interface RecordedSession {
  genreId: string;
  seed: number;
  /** Session time in ms: the transport clock, zero when the band started. */
  keystrokes: KeyEvent[];
}

export interface CompositionSummary {
  id: string;
  title: string;
  genreId: string;
  keystrokeCount: number;
  createdAt: string;
}

export interface CompositionDetail {
  id: string;
  title: string;
  genreId: string;
  seed: number;
  settings: { genreId: string };
  keystrokes: { key: string; timestampMs: number }[];
  createdAt: string;
}
