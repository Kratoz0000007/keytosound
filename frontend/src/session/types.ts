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

export interface User {
  id: string;
  email: string;
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

/** Server-computed typing stats for one composition; see AnalyticsController. */
export type PauseKind = 'word' | 'comma' | 'sentence' | 'hesitation';

export interface CompositionAnalytics {
  summary: {
    keyCount: number;
    durationMs: number;
    averageWpm: number;
    peakWpm: number | null;
    heldKeysIgnored: number;
  };
  rhythm: {
    bands: { fromMs: number; toMs: number; count: number }[];
    medianGapMs: number | null;
    steadiness: number | null;
  };
  sentences: { label: string; keyCount: number; wpm: number | null }[];
  pauses: {
    count: number;
    totalMs: number;
    longestMs: number;
    byKind: Record<PauseKind, number>;
    segments: { text: string; pauseAfterMs: number | null }[];
  };
  keys: {
    top: { key: string; count: number }[];
    backspaces: number;
    correctionRate: number;
    punctuation: Record<string, number>;
    enters: number;
    drums: number;
  };
}
