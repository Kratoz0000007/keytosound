import { LEGATO_HOLD, PHRASE_VELOCITY } from '../audio/lead';
import { Scheduler } from '../audio/scheduler';
import { VOICES, type Voice } from '../engine/beat';
import { MusicEngine } from '../engine/engine';
import { DEFAULT_GENRE_ID, GENRES } from '../engine/presets';
import { pitchClass } from '../engine/theory';
import type { Chord, InstrumentId } from '../engine/types';
import { TypingAnalyzer } from '../typing/analyzer';
import type { RecordedSession } from './types';

export type DrumVoice = Exclude<Voice, 'bass' | 'stab'>;

/** Times and lengths in seconds from the start of the session; pitch is MIDI. */
export interface ScoreNote {
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
}

export interface DrumHit {
  voice: DrumVoice;
  start: number;
  velocity: number;
}

/** Everything the MIDI writer needs, with every musical decision already made. */
export interface Score {
  bpm: number;
  leadInstrument: InstrumentId;
  lead: ScoreNote[];
  pad: ScoreNote[];
  bass: ScoreNote[];
  drums: DrumHit[];
}

const STEPS_PER_BAR = 16;
// The band has no velocities live (it mixes by volume), so these stand in.
const PAD_VELOCITY = 0.5;
const STAB_VELOCITY = 0.6;
const BASS_VELOCITY = 0.7;
const DRUM_VELOCITY = 0.8;

/** Same voicing as the live pad and stab: pitch class in the octave from MIDI 48. */
function chordPitches(chord: Chord): number[] {
  return chord.intervals.map((i) => pitchClass(chord.root + i) + 48);
}

/**
 * Replays a saved session headlessly into a score, reproducing what live
 * playback did: lead notes placed by the same Scheduler and held legato as
 * LegatoLead holds them, one pad chord per bar from the shared Harmony, and
 * the drum loop as it stood at each step, including digit edits made
 * mid-session. Deterministic: the same session always gives the same score.
 */
export function renderScore(session: RecordedSession): Score {
  const preset = GENRES[session.genreId] ?? GENRES[DEFAULT_GENRE_ID];
  const engine = new MusicEngine(preset, session.seed);
  const analyzer = new TypingAnalyzer();
  const scheduler = new Scheduler(preset.bpm, 0);

  const sixteenth = 60 / preset.bpm / 4;
  const barSec = sixteenth * STEPS_PER_BAR;
  const keys = session.keystrokes;
  const lastKeySec = keys.length > 0 ? keys[keys.length - 1].timestamp / 1000 : 0;
  // Through the bar after the last keystroke, so the final cadence is heard.
  const bars = Math.floor(lastKeySec / barSec) + 2;

  const written: { pitch: number; start: number; length: number; velocity: number }[] = [];
  const pad: ScoreNote[] = [];
  const bass: ScoreNote[] = [];
  const drums: DrumHit[] = [];

  let next = 0;
  const consume = () => {
    const key = keys[next++];
    const event = engine.step(analyzer.process(key));
    if (!event) return;
    const placed = scheduler.schedule(event, key.timestamp / 1000);
    // Mirror LegatoLead: a word's first note re-attacks softly, live and on
    // export alike. Slur notes can't be mirrored exactly either way — live
    // they inherit the previous attack via setNote rather than re-attacking —
    // but spec section 2 already excludes glide from the export.
    const velocity =
      event.articulation === 'phrase' ? placed.velocity * PHRASE_VELOCITY : placed.velocity;
    written.push({
      pitch: placed.pitch,
      start: placed.time,
      length: placed.durationSeconds,
      velocity,
    });
  };

  let chord = engine.harmonyAt(0).chord;
  for (let s = 0; s < bars * STEPS_PER_BAR; s++) {
    const stepSec = s * sixteenth;
    // Edits made at or before this step are already in effect, as they were live.
    while (next < keys.length && keys[next].timestamp / 1000 <= stepSec) consume();

    const step = s % STEPS_PER_BAR;
    if (step === 0) {
      chord = engine.harmonyAt(s / STEPS_PER_BAR).chord;
      for (const pitch of chordPitches(chord)) {
        pad.push({ pitch, start: stepSec, duration: barSec, velocity: PAD_VELOCITY });
      }
    }

    const at = step % 2 === 1 ? stepSec + sixteenth * engine.swing : stepSec;
    for (const voice of VOICES) {
      if (!engine.beatHas(voice, step)) continue;
      if (voice === 'bass') {
        bass.push({
          pitch: pitchClass(chord.root) + 24,
          start: at,
          duration: sixteenth * 2,
          velocity: BASS_VELOCITY,
        });
      } else if (voice === 'stab') {
        for (const pitch of chordPitches(chord)) {
          pad.push({ pitch, start: at, duration: sixteenth, velocity: STAB_VELOCITY });
        }
      } else {
        drums.push({ voice, start: at, velocity: DRUM_VELOCITY });
      }
    }
  }
  while (next < keys.length) consume();

  // Legato, as LegatoLead plays it: held until the next note takes over, but
  // never past the hold.
  const lead: ScoreNote[] = written.map((note, i) => {
    const hold = note.length * LEGATO_HOLD;
    const following = written[i + 1];
    return {
      pitch: note.pitch,
      start: note.start,
      duration: following ? Math.min(hold, following.start - note.start) : hold,
      velocity: note.velocity,
    };
  });

  return { bpm: preset.bpm, leadInstrument: preset.leadInstrument, lead, pad, bass, drums };
}
