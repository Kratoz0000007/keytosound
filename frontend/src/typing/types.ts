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
  /**
   * Session time of this keystroke, in ms. Measured on the audio transport's
   * clock, so it skips paused time and lines up with the band's bars.
   */
  timestamp: number;
  /** Lower-cased current word including this key; '' once a word ends. */
  wordPrefix: string;
  /** Enter starts a new paragraph, which modulates. */
  isEnter: boolean;
  /** 0-9 when a digit was pressed. Digits edit the beat, never the melody. */
  digit: number | null;
}
