import type { KeyEvent, PunctuationClass, TypingFeatures } from './types';

/** Silence shorter than this is ordinary typing rhythm, not a pause. */
const PAUSE_THRESHOLD_MS = 400;
/** How many intervals the rolling speed average considers. */
const SPEED_WINDOW = 16;
/** Conventional WPM definition: five characters make a word. */
const CHARS_PER_WORD = 5;
/**
 * Held-down keys auto-repeat at ~30ms, which computes to 400wpm and makes the
 * readout nonsense. Energy is clamped downstream anyway; this keeps the
 * reported figure in a range a human could actually produce.
 */
const MAX_SPEED_WPM = 300;

const PUNCTUATION: Record<string, PunctuationClass> = {
  '.': 'period',
  ',': 'comma',
  '!': 'exclamation',
  '?': 'question',
};

const WORD_TERMINATORS = new Set([' ', '.', ',', '!', '?']);
const SENTENCE_TERMINATORS = new Set(['.', '!', '?']);

export class TypingAnalyzer {
  private lastTimestamp: number | null = null;
  private intervals: number[] = [];
  private wordBuffer = '';
  private sentencePos = 0;

  reset(): void {
    this.lastTimestamp = null;
    this.intervals = [];
    this.wordBuffer = '';
    this.sentencePos = 0;
  }

  process(event: KeyEvent): TypingFeatures {
    const interval =
      this.lastTimestamp === null ? 0 : Math.max(0, event.timestamp - this.lastTimestamp);
    this.lastTimestamp = event.timestamp;

    if (interval > 0) {
      this.intervals.push(interval);
      if (this.intervals.length > SPEED_WINDOW) this.intervals.shift();
    }

    const punctuation = PUNCTUATION[event.key] ?? 'none';
    const isBackspace = event.key === 'Backspace';
    const isCapital = event.key.length === 1 && /[A-Z]/.test(event.key);

    let wordLength = 0;
    const sentencePosAtEvent = this.sentencePos;

    if (isBackspace) {
      this.wordBuffer = this.wordBuffer.slice(0, -1);
    } else if (WORD_TERMINATORS.has(event.key)) {
      wordLength = this.wordBuffer.length;
      this.wordBuffer = '';
      if (SENTENCE_TERMINATORS.has(event.key)) {
        this.sentencePos = 0;
      } else if (wordLength > 0) {
        this.sentencePos += 1;
      }
    } else if (event.key.length === 1) {
      this.wordBuffer += event.key;
    }

    return {
      interval,
      speed: this.currentSpeed(),
      wordLength,
      sentencePos: sentencePosAtEvent,
      pauseDuration: interval > PAUSE_THRESHOLD_MS ? interval : 0,
      punctuation,
      isCapital,
      isBackspace,
    };
  }

  private currentSpeed(): number {
    if (this.intervals.length === 0) return 0;
    const mean = this.intervals.reduce((a, b) => a + b, 0) / this.intervals.length;
    if (mean <= 0) return 0;
    return Math.min(MAX_SPEED_WPM, 60000 / (mean * CHARS_PER_WORD));
  }
}
