export type PunctuationClass =
  | 'none'
  | 'period'
  | 'comma'
  | 'exclamation'
  | 'question';

export interface KeyEvent {
  key: string;
  /** Milliseconds, monotonic. Supplied by the caller — the analyzer never reads a clock. */
  timestamp: number;
}

/** The engine's only input. Nothing downstream of this knows about keyboards. */
export interface TypingFeatures {
  /** ms since the previous keystroke; 0 for the first. */
  interval: number;
  /** Rolling words per minute. */
  speed: number;
  /** Length of the word just completed; 0 while mid-word. */
  wordLength: number;
  /** Index of the current word within the sentence. */
  sentencePos: number;
  /** ms of silence preceding this event, counted only above PAUSE_THRESHOLD_MS. */
  pauseDuration: number;
  punctuation: PunctuationClass;
  isCapital: boolean;
  isBackspace: boolean;
}
