import type { GenrePreset, GestureShape, MappedParams, MusicalState } from './types';
import type { PunctuationClass, TypingFeatures } from '../typing/types';

/** Typing speed at which energy saturates. */
const SPEED_FOR_FULL_ENERGY = 80;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function durationFromInterval(interval: number): number {
  if (interval < 120) return 0.25;
  if (interval < 260) return 0.5;
  if (interval < 550) return 1;
  if (interval < 1200) return 1.5;
  return 2;
}

function shapeFromWord(wordLength: number, punctuation: PunctuationClass): GestureShape {
  if (punctuation === 'period') return 'fall';
  if (punctuation === 'question') return 'rise';
  if (wordLength === 0) return 'flat';
  if (wordLength <= 3) return 'rise';
  return 'arch';
}

export function mapFeatures(
  f: TypingFeatures,
  state: MusicalState,
  _preset: GenrePreset,
): MappedParams {
  const energy = clamp(f.speed / SPEED_FOR_FULL_ENERGY, 0, 1);

  let velocity = 0.4 + energy * 0.4;
  if (f.isCapital) velocity += 0.12;
  if (f.punctuation === 'exclamation') velocity += 0.18;
  velocity = clamp(velocity, 0.05, 1);

  const forceResolution = f.punctuation === 'period';
  const isRest = f.punctuation === 'comma';

  let targetTension: number;
  if (forceResolution) targetTension = 0;
  else if (f.punctuation === 'question') targetTension = 0.9;
  else targetTension = clamp(state.phrasePosition, 0, 1);

  // Short word, small excursion. Long word, a full arc with a registral peak.
  const leapAllowance = clamp(2 + Math.min(f.wordLength, 10), 2, 12);

  return {
    durationBeats: durationFromInterval(f.interval),
    subdivision: energy > 0.5 ? 16 : 8,
    velocity,
    leapAllowance,
    gestureShape: shapeFromWord(f.wordLength, f.punctuation),
    forceResolution,
    isRest,
    targetTension,
    advanceChord: f.wordLength > 0,
    echoPrevious: f.isBackspace,
  };
}
