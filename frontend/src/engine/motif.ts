import { clashesWithChord, scalePitchesInRange } from './theory';
import type { Chord, ScaleName } from './types';

/**
 * Melodic steps, in scale degrees, that a word prefix can hash to. Biased to
 * small moves so words sound like phrases rather than arpeggios, and with no
 * 0 so a word never stalls on one pitch. No 3s: in a pentatonic scale three
 * degrees is a 7th, and a word full of them sounds like a jumble, not a tune.
 */
export const STEP_TABLE = [-2, -1, -1, -1, 1, 1, 1, 2] as const;

/** How many degrees a word may wander from its first note, either way. */
export const WORD_SPAN = 3;

/** 32-bit FNV-1a. Small, fast, and stable across platforms: good enough to give a word an identity. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The step a word takes when this prefix is typed. Depends on the whole
 * prefix, not the last letter, so no key owns a movement — and the step is in
 * degrees, not pitches, so no key owns a note either.
 */
export function motifStep(prefix: string): number {
  return STEP_TABLE[fnv1a(prefix) % STEP_TABLE.length];
}

/**
 * The shape of a whole word: one step per letter after the first. A step that
 * would carry the word more than WORD_SPAN degrees from its first note turns
 * back, so a long word stays a phrase around one place instead of wandering
 * off. Still a function of the letters alone.
 */
export function motifSteps(word: string): number[] {
  const steps: number[] = [];
  let offset = 0;
  for (let i = 2; i <= word.length; i++) {
    let step = motifStep(word.slice(0, i));
    if (Math.abs(offset + step) > WORD_SPAN) step = -step;
    offset += step;
    steps.push(step);
  }
  return steps;
}

export interface MotifContext {
  previousPitch: number;
  step: number;
  keyRoot: number;
  scale: ScaleName;
  chord: Chord;
  floor: number;
  ceiling: number;
}

function nearestIndex(pitches: number[], target: number): number {
  let best = 0;
  for (let i = 1; i < pitches.length; i++) {
    if (Math.abs(pitches[i] - target) < Math.abs(pitches[best] - target)) best = i;
  }
  return best;
}

/**
 * Walk `step` scale degrees from `previousPitch`. A walk that would leave the
 * register bounces off its edge, and a landing note a semitone from the chord
 * is nudged one degree along — continuing the word's direction first — so the
 * shape survives while the harmony stays clean.
 */
export function motifPitch(ctx: MotifContext): number {
  const pitches = scalePitchesInRange(ctx.keyRoot, ctx.scale, ctx.floor, ctx.ceiling);
  const from = nearestIndex(pitches, ctx.previousPitch);

  const last = pitches.length - 1;
  let index = from + ctx.step;
  // Bouncing, not mirroring the whole walk about its start: a long word's
  // walk is many steps, and mirroring it jumped the line by an octave.
  while (last > 0 && (index < 0 || index > last)) index = index < 0 ? -index : 2 * last - index;
  index = Math.min(last, Math.max(0, index));

  if (clashesWithChord(pitches[index], ctx.chord)) {
    const direction = Math.sign(ctx.step) || 1;
    for (const candidate of [index + direction, index - direction]) {
      if (
        candidate >= 0 &&
        candidate < pitches.length &&
        candidate !== from &&
        !clashesWithChord(pitches[candidate], ctx.chord)
      ) {
        return pitches[candidate];
      }
    }
  }
  return pitches[index];
}
