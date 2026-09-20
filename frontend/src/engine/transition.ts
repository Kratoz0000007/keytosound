import {
  scoreChordTone,
  scoreContour,
  scoreInterval,
  scoreRegister,
  scoreRepetition,
  scoreTension,
} from './scoring';
import { isChordTone, maxScaleStep, scalePitchesInRange } from './theory';
import type { GenrePreset, MappedParams, MusicalState } from './types';

/** Candidates are drawn from one octave either side of the previous note. */
const CANDIDATE_RANGE = 12;
/** Absolute floor and ceiling, so a runaway melody cannot leave the keyboard. */
const MIN_PITCH = 36;
const MAX_PITCH = 96;
/**
 * The playable register is centerPitch +/- registerSpread * this. Enforced as a
 * hard window rather than left to scoreRegister, because a Gaussian has no
 * gradient in its tail: once the melody drifts far enough, every candidate in
 * reach scores ~0 and the term stops pulling at exactly the moment it matters.
 * A weight expresses a preference; only a constraint gives a guarantee.
 */
const REGISTER_LIMIT_FACTOR = 2;

export function generateCandidates(state: MusicalState, preset: GenrePreset): number[] {
  const registerFloor = preset.centerPitch - preset.registerSpread * REGISTER_LIMIT_FACTOR;
  const registerCeiling = preset.centerPitch + preset.registerSpread * REGISTER_LIMIT_FACTOR;

  const low = Math.max(MIN_PITCH, registerFloor, state.previousPitch - CANDIDATE_RANGE);
  const high = Math.min(MAX_PITCH, registerCeiling, state.previousPitch + CANDIDATE_RANGE);
  const candidates = scalePitchesInRange(state.keyRoot, state.scale, low, high);
  if (candidates.length > 0) return candidates;
  // Previous pitch was outside the playable range: fall back to the centre octave.
  return scalePitchesInRange(
    state.keyRoot,
    state.scale,
    preset.centerPitch - CANDIDATE_RANGE,
    preset.centerPitch + CANDIDATE_RANGE,
  );
}

/**
 * Score every candidate on the six weighted terms, then sample from a softmax
 * over those scores. Randomness exists, but only inside musical constraints.
 *
 * Returns null only when erasing has walked the melody to the bottom of the
 * register and there is nothing left below it — deletion then falls silent.
 */
export function selectNextPitch(
  state: MusicalState,
  params: MappedParams,
  preset: GenrePreset,
  rng: () => number,
): number | null {
  const chord = state.progression[state.chordIndex % state.progression.length];
  const tonicChord = state.progression[0];
  const onStrongBeat = state.beatPosition < 0.25;
  const maxStep = maxScaleStep(state.scale);
  const w = preset.weights;

  const all = generateCandidates(state, preset);

  // Erasing walks strictly downward. A hard filter, not a weight: it is what
  // guarantees backspace can never replay the same pitch twice in a row.
  if (params.descendOnly) {
    const below = all.filter((p) => p < state.previousPitch);
    if (below.length === 0) return null;
    return sampleSoftmax(
      below,
      below.map((p) => scoreCandidate(p)),
      preset.temperature,
      rng,
    );
  }

  // "Forced" resolution means forced. Scoring alone cannot guarantee it: a
  // conveniently adjacent non-tonic note can outweigh the tension term via
  // the interval term. Restricting the candidate set is what makes a phrase
  // ending on "." reliably land on the tonic chord.
  const candidates = params.forceResolution
    ? (() => {
        const resolved = all.filter((p) => isChordTone(p, tonicChord));
        return resolved.length > 0 ? resolved : all;
      })()
    : all;

  return sampleSoftmax(candidates, candidates.map(scoreCandidate), preset.temperature, rng);

  function scoreCandidate(candidate: number): number {
    return (
      w.interval * scoreInterval(candidate, state.previousPitch, params.leapAllowance) +
      w.chordTone * scoreChordTone(candidate, state.previousPitch, chord, onStrongBeat, maxStep) +
      w.contour *
        scoreContour(candidate, {
          previousPitch: state.previousPitch,
          direction: state.contourDirection,
          momentum: state.contourMomentum,
          lastIntervalSize: state.lastIntervalSize,
          shape: params.gestureShape,
          phrasePosition: state.phrasePosition,
        }) +
      w.register * scoreRegister(candidate, preset.centerPitch, preset.registerSpread) +
      w.repetition * scoreRepetition(candidate, state.recentPitches) +
      w.tension *
        scoreTension(candidate, chord, tonicChord, params.targetTension, params.forceResolution)
    );
  }
}

function sampleSoftmax(
  candidates: number[],
  scores: number[],
  temperature: number,
  rng: () => number,
): number {
  const t = Math.max(0.01, temperature);
  const max = Math.max(...scores);
  const weights = scores.map((s) => Math.exp((s - max) / t));
  const total = weights.reduce((a, b) => a + b, 0);

  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
