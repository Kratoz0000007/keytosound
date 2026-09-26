export interface VisualNote {
  pitch: number;
  /** Wall-clock ms when the note sounded. */
  at: number;
  durationBeats: number;
  velocity: number;
}

export interface LayoutOptions {
  width: number;
  height: number;
  /** How much history is visible, in milliseconds. */
  windowMs: number;
  now: number;
  minPitch: number;
  maxPitch: number;
}

export interface NoteBar {
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
}

export const BAR_HEIGHT = 6;
const MIN_BAR_WIDTH = 2;
/** Pixels per beat of note duration. */
const WIDTH_PER_BEAT = 28;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Pure geometry, kept apart from the canvas so it can be tested. Time runs
 * left to right with the present at the right edge, so the melody scrolls
 * away as it is played.
 */
export function layoutNotes(notes: VisualNote[], opts: LayoutOptions): NoteBar[] {
  const { width, height, windowMs, now, minPitch, maxPitch } = opts;
  const span = Math.max(1, maxPitch - minPitch);

  return notes
    .filter((note) => now - note.at <= windowMs && now - note.at >= 0)
    .map((note) => {
      const age = (now - note.at) / windowMs; // 0 = now, 1 = falling off the left
      const w = Math.max(MIN_BAR_WIDTH, note.durationBeats * WIDTH_PER_BEAT);
      const x = width - age * width - w;

      const normalised = clamp((note.pitch - minPitch) / span, 0, 1);
      // Canvas y grows downward, so invert: higher pitch, smaller y.
      const y = clamp((1 - normalised) * (height - BAR_HEIGHT), 0, height - BAR_HEIGHT);

      return { x, y, w, h: BAR_HEIGHT, alpha: clamp(0.25 + note.velocity * 0.75, 0, 1) };
    });
}

export interface MatrixOptions {
  columns: number;
  rows: number;
  now: number;
  minPitch: number;
  maxPitch: number;
  /** How long a note keeps its column lit, falling as it goes, in milliseconds. */
  decayMs: number;
}

/**
 * Levels for a dot-matrix equalizer, the other way a theme can draw notes.
 * Each note jumps the column for its pitch (and its neighbours, half as
 * high) to its velocity, then falls back over decayMs. Returns how many
 * rows are lit in each column, from 0 to rows.
 */
export function matrixLevels(notes: VisualNote[], opts: MatrixOptions): number[] {
  const { columns, rows, now, minPitch, maxPitch, decayMs } = opts;
  const span = Math.max(1, maxPitch - minPitch);
  const energy = new Array<number>(columns).fill(0);

  for (const note of notes) {
    const age = now - note.at;
    if (age < 0 || age >= decayMs) continue;
    const e = clamp(note.velocity, 0, 1) * (1 - age / decayMs);
    const col = Math.round(clamp((note.pitch - minPitch) / span, 0, 1) * (columns - 1));
    energy[col] = Math.max(energy[col], e);
    if (col > 0) energy[col - 1] = Math.max(energy[col - 1], e / 2);
    if (col < columns - 1) energy[col + 1] = Math.max(energy[col + 1], e / 2);
  }

  return energy.map((e) => Math.round(e * rows));
}

export interface ScopeOptions {
  /** How many points to sample across the width. */
  samples: number;
  now: number;
  minPitch: number;
  maxPitch: number;
  /** How long a note keeps ringing on the trace, in milliseconds. */
  decayMs: number;
}

/**
 * An oscilloscope trace, the third way a theme can draw notes. Each ringing
 * note adds a sine: higher pitches pack more cycles across the width, louder
 * and fresher notes swing wider, and the phase drifts so the wave travels.
 * The edges taper to zero, like a trace entering and leaving the screen.
 * Returns a displacement per sample, soft-clipped into (-1, 1).
 */
export function scopeWave(notes: VisualNote[], opts: ScopeOptions): number[] {
  const { samples, now, minPitch, maxPitch, decayMs } = opts;
  const span = Math.max(1, maxPitch - minPitch);
  const wave = new Array<number>(samples).fill(0);

  for (const note of notes) {
    const age = now - note.at;
    if (age < 0 || age >= decayMs) continue;
    const amp = clamp(note.velocity, 0, 1) * (1 - age / decayMs);
    const cycles = 1.5 + clamp((note.pitch - minPitch) / span, 0, 1) * 8;
    const phase = (age / 1000) * Math.PI * 1.8;
    for (let i = 0; i < samples; i++) {
      const x = i / (samples - 1);
      wave[i] += amp * Math.sin(Math.PI * x) * Math.sin(2 * Math.PI * cycles * x - phase);
    }
  }

  return wave.map(Math.tanh);
}
