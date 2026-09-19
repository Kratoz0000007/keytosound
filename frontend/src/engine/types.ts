export type ScaleName = 'majorPentatonic' | 'minorPentatonic';

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
  echoPrevious: boolean;
}
