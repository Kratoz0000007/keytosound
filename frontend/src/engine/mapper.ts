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
  const erasing = f.isBackspace;

  let velocity = 0.4 + energy * 0.4;
  if (f.isCapital) velocity += 0.12;
  if (f.punctuation === 'exclamation') velocity += 0.18;
  // An erasure should read as undoing, not composing: half the weight.
  if (erasing) velocity *= 0.5;
  velocity = clamp(velocity, 0.05, 1);

  const forceResolution = !erasing && f.punctuation === 'period';
  const isRest = f.punctuation === 'comma';

  let targetTension: number;
  if (forceResolution) targetTension = 0;
  else if (f.punctuation === 'question') targetTension = 0.9;
  else targetTension = clamp(state.phrasePosition, 0, 1);

  // Short word, small excursion. Long word, a full arc with a registral peak.
  // The floor is 4, not 2: pentatonic degrees are 2-3 semitones apart, so an
  // allowance of 2 makes scoreInterval punish ordinary stepwise motion nearly
  // as hard as a leap. Combined with the repetition penalty that squeezes the
  // engine out of its neighbourhood entirely and it reaches for wild jumps.
  // The ceiling is 8, not 12: at 12 an octave jump scores 0.37 and stops being
  // exceptional. A long word should widen the *arc* — that is gestureShape's
  // job — rather than licence one enormous interval.
  // Erasing steps tightly rather than plunging down the register.
  const leapAllowance = erasing ? 3 : clamp(4 + Math.min(f.wordLength, 8) * 0.5, 4, 8);

  return {
    // Erasures are brief, so holding backspace does not stack long notes.
    durationBeats: erasing ? 0.25 : durationFromInterval(f.interval),
    subdivision: erasing || energy > 0.5 ? 16 : 8,
    velocity,
    leapAllowance,
    gestureShape: erasing ? 'fall' : shapeFromWord(f.wordLength, f.punctuation),
    forceResolution,
    isRest,
    targetTension,
    // Deleting must not drive the harmony forward.
    advanceChord: !erasing && f.wordLength > 0,
    descendOnly: erasing,
  };
}
