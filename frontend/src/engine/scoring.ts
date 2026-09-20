import { clashesWithChord, isChordTone } from './theory';
import type { Chord, ContourDirection, GestureShape } from './types';

/** A leap wider than this triggers the reverse-by-step rule. */
const LEAP_THRESHOLD = 4;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0.01, value));
}

/**
 * Term 1. Stepwise motion strongly favoured; Gaussian decay with leap size,
 * widened by the mapper's leapAllowance so long words permit bigger jumps.
 */
export function scoreInterval(
  candidate: number,
  previousPitch: number,
  leapAllowance: number,
): number {
  const distance = Math.abs(candidate - previousPitch);
  if (distance === 0) return 0.15;
  const width = Math.max(1, leapAllowance);
  return Math.exp(-((distance / width) ** 2)) + 1e-6;
}

/**
 * Term 2. Chord tones score higher, dramatically so on strong beats.
 * Non-chord tones are permitted only as passing notes — this enforces the
 * "approached by step" half of that rule. The "left by step" half is
 * enforced implicitly, because scoreInterval governs the following note.
 */
export function scoreChordTone(
  candidate: number,
  previousPitch: number,
  chord: Chord,
  onStrongBeat: boolean,
  /** One step in the active scale, from maxScaleStep. 3 for pentatonic, 2 for diatonic. */
  maxStep: number,
): number {
  if (isChordTone(candidate, chord)) return onStrongBeat ? 1 : 0.8;

  const approachedByStep = Math.abs(candidate - previousPitch) <= maxStep;
  if (!approachedByStep) return 0.05;

  // The approached-by-step allowance is nearly free on a seven-note scale,
  // where adjacent degrees are 1-2 semitones apart, so it lets minor seconds
  // against the chord straight through. Penalise that clash on its own terms.
  if (clashesWithChord(candidate, chord)) return onStrongBeat ? 0.03 : 0.12;

  return onStrongBeat ? 0.15 : 0.5;
}

/**
 * Term 4. A soft pull toward a comfortable centre octave. This is what stops
 * the classic random-walk failure where the melody wanders off the top of
 * the keyboard and never comes back.
 */
export function scoreRegister(candidate: number, centerPitch: number, spread: number): number {
  const distance = Math.abs(candidate - centerPitch);
  const width = Math.max(1, spread);
  return Math.exp(-((distance / width) ** 2)) + 1e-6;
}

export interface ContourContext {
  previousPitch: number;
  direction: ContourDirection;
  momentum: number;
  lastIntervalSize: number;
  shape: GestureShape;
  phrasePosition: number;
}

/**
 * Term 3. The single largest contributor to melodies sounding intentional
 * rather than generated: after a large leap, reverse direction by step.
 * Secondary effects are momentum and the mapper's gesture shape.
 */
export function scoreContour(candidate: number, ctx: ContourContext): number {
  const move = candidate - ctx.previousPitch;
  const dir = Math.sign(move);

  if (ctx.lastIntervalSize > LEAP_THRESHOLD && ctx.direction !== 0) {
    const reversing = dir !== 0 && dir === -ctx.direction;
    if (reversing && Math.abs(move) <= 3) return 1;
    if (reversing) return 0.55;
    if (dir === ctx.direction) return 0.12;
    return 0.35;
  }

  let score = 0.5;

  if (ctx.momentum >= 2) {
    score = dir === ctx.direction && dir !== 0 ? 0.75 : 0.45;
  }

  let wanted = 0;
  if (ctx.shape === 'rise') wanted = 1;
  else if (ctx.shape === 'fall') wanted = -1;
  else if (ctx.shape === 'arch') wanted = ctx.phrasePosition < 0.5 ? 1 : -1;

  if (wanted !== 0) {
    score += dir === wanted ? 0.25 : -0.12;
  }

  return clamp01(score);
}

/**
 * Term 5. A decaying penalty on recently used pitches, so the melody
 * cannot get stuck repeating itself.
 */
export function scoreRepetition(candidate: number, recentPitches: number[]): number {
  const index = recentPitches.lastIndexOf(candidate);
  if (index === -1) return 1;
  const recency = recentPitches.length - index; // 1 is the most recent
  return Math.min(1, 0.15 * recency);
}

/**
 * Term 6. Phrase position sets a tension target: stable chord tones early,
 * dissonance permitted mid-phrase, forced resolution to the tonic at the end.
 */
export function scoreTension(
  candidate: number,
  chord: Chord,
  tonicChord: Chord,
  targetTension: number,
  forceResolution: boolean,
): number {
  if (forceResolution) {
    return isChordTone(candidate, tonicChord) ? 1 : 0.05;
  }
  const noteTension = isChordTone(candidate, chord) ? 0 : 1;
  return clamp01(1 - Math.abs(noteTension - targetTension));
}
