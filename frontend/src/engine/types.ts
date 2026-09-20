/**
 * Pentatonic scales have no semitone clashes, so bad notes are nearly
 * impossible — that is why the first three genres use them. The seven-note
 * modes below reintroduce that risk and must be paired with heavier
 * chordTone weighting; see the Jazz and Classical presets.
 */
export type ScaleName = 'majorPentatonic' | 'minorPentatonic' | 'dorian' | 'major';

export type InstrumentId =
  | 'piano'
  | 'synthLead'
  | 'electricPiano'
  | 'bass'
  | 'eightBit';

export type GestureShape = 'flat' | 'rise' | 'fall' | 'arch';

export type ContourDirection = -1 | 0 | 1;

/** A chord as a root pitch class plus semitone offsets from that root. */
export interface Chord {
  root: number;
  intervals: number[];
}

export interface MusicalEvent {
  /** MIDI note number. */
  pitch: number;
  /** 0..1 */
  velocity: number;
  durationBeats: number;
  /** Grid this note should land on: 8 or 16. */
  subdivision: number;
}

/** Relative influence of each of the six scoring terms. */
export interface ScoringWeights {
  interval: number;
  chordTone: number;
  contour: number;
  register: number;
  repetition: number;
  tension: number;
}

/**
 * One bar of backing rhythm on a 16th-note grid. Each array holds the step
 * indices (0-15) where that voice fires. Empty arrays are legal and
 * meaningful: Classical has no drums at all, and a string quartet with a
 * kick drum would be absurd.
 */
export interface Groove {
  kick: number[];
  snare: number[];
  hat: number[];
  /** Steps where the bass restates the chord root. */
  bass: number[];
  /** 0 = straight, 0.5 = heavy swing. Delays odd-numbered 16ths. */
  swing: number;
}

/** A genre is data, not code. Adding one is authoring a parameter set. */
export interface GenrePreset {
  id: string;
  name: string;
  scale: ScaleName;
  /** Pitch class 0-11. */
  keyRoot: number;
  progression: Chord[];
  bpm: number;
  weights: ScoringWeights;
  /** Softmax temperature. Low = predictable, high = surprising. */
  temperature: number;
  /** MIDI pitch that register gravity pulls toward. */
  centerPitch: number;
  /** Semitones of comfortable range either side of centerPitch. */
  registerSpread: number;
  leadInstrument: InstrumentId;
  groove: Groove;
}

/** Everything the engine carries from one note to the next. */
export interface MusicalState {
  keyRoot: number;
  scale: ScaleName;
  progression: Chord[];
  chordIndex: number;
  /** MIDI note number of the last note emitted. */
  previousPitch: number;
  contourDirection: ContourDirection;
  /** Consecutive notes that moved in contourDirection. */
  contourMomentum: number;
  /** Absolute semitone size of the last melodic move. */
  lastIntervalSize: number;
  /** 0..1 through the current phrase. */
  phrasePosition: number;
  /** 0..1, driven by typing speed. */
  energy: number;
  /** 0..1 */
  tension: number;
  /** Most recent pitches, oldest first, for the repetition penalty. */
  recentPitches: number[];
  /** 0..1 within the current bar, for strong-beat detection. */
  beatPosition: number;
}

/** The mapper's output: musical intent, before a pitch has been chosen. */
export interface MappedParams {
  durationBeats: number;
  subdivision: number;
  velocity: number;
  /** Maximum comfortable melodic interval, in semitones. */
  leapAllowance: number;
  gestureShape: GestureShape;
  forceResolution: boolean;
  isRest: boolean;
  targetTension: number;
  advanceChord: boolean;
  /**
   * Erasing. Restricts candidates to pitches strictly below the previous one,
   * so deleting text walks the melody downward and can never repeat a note.
   * Replaced echoPrevious, which replayed the previous pitch verbatim and so
   * produced exactly the robotic repetition this project exists to avoid.
   */
  descendOnly: boolean;
}
