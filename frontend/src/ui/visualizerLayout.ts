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

const BAR_HEIGHT = 6;
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
