import { MusicEngine } from '../engine/engine';
import { DEFAULT_GENRE_ID, GENRES } from '../engine/presets';
import type { MusicalEvent } from '../engine/types';
import { TypingAnalyzer } from '../typing/analyzer';
import type { CompositionDetail, RecordedSession } from './types';

/** Converts the API's wire shape into the shape the engine consumes. */
export function sessionFromDetail(detail: CompositionDetail): RecordedSession {
  return {
    genreId: detail.genreId,
    seed: detail.seed,
    keystrokes: detail.keystrokes.map((k) => ({ key: k.key, timestamp: k.timestampMs })),
  };
}

/**
 * Renders a recorded session to notes, headlessly and with no audio. This is
 * both the replay path and the evaluation harness: rendering one saved session
 * through two engine versions is how engine changes get compared by ear.
 */
export function renderRecorded(session: RecordedSession): MusicalEvent[] {
  // A composition saved under a genre a later version dropped should still
  // open rather than throwing on an undefined preset.
  const preset = GENRES[session.genreId] ?? GENRES[DEFAULT_GENRE_ID];
  const analyzer = new TypingAnalyzer();
  const engine = new MusicEngine(preset, session.seed);

  const events: MusicalEvent[] = [];
  for (const keystroke of session.keystrokes) {
    const event = engine.step(analyzer.process(keystroke));
    if (event) events.push(event);
  }
  return events;
}
