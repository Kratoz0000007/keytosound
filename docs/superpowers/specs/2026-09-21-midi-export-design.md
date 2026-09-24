# MIDI Export (Plan 3a) — Design

**Status:** approved in brainstorming, 2026-09-21
**Parent spec:** `2026-09-19-typing-to-music-design.md` §6 item 2 ("MIDI export via javax.sound.midi")
**Plan 3 split:** 3a MIDI export (this) → 3b accounts → 3c analytics. Presets-from-DB is deferred.

## 1. Goal

Download any saved composition as a standard multi-track `.mid` file that opens in a DAW as a full arrangement: lead, chord pad, bass and drums.

## 2. Decisions

| Question | Decision | Why |
|---|---|---|
| Where do the notes come from? | The browser renders a **score** from the saved keystrokes and POSTs it; Java writes the MIDI | The engine is TypeScript. Porting it to Java would duplicate ~1500 lines that must stay note-identical forever. Storing notes goes stale on every engine change. |
| What can be exported? | **Saved compositions only** | Every export is tied to a stored record. |
| Which tracks? | **Full band**: lead, pad (+ stabs), bass, drums | Opens as an arrangement, not just a melody line. |
| Glide | Not encoded; legato lengths are | MIDI has no simple, portable pitch slide. |

## 3. Prerequisite: the dev database must persist

The embedded PostgreSQL currently runs `initdb` into a fresh temp directory on every start, so saved compositions vanish on every backend restart. An export feature for saved compositions is useless without this fix.

- `EmbeddedPostgresConfig` reads `keytosound.db.data-dir`. Blank (the default) keeps today's throwaway database; set, it reuses that directory (`setDataDirectory(path)`, `setCleanDataDirectory(false)`).
- `application-dev.yml` sets `keytosound.db.data-dir: .pgdata`. The `spring-boot-maven-plugin` activates the `dev` profile for `spring-boot:run` only, so **tests keep an isolated, throwaway database** and never touch dev data.
- `backend/.pgdata/` is gitignored.

## 4. The score (frontend)

`frontend/src/session/score.ts`, pure (no Tone.js, no DOM):

```ts
interface ScoreNote { pitch: number; start: number; duration: number; velocity: number } // seconds, MIDI pitch, 0..1
interface DrumHit { voice: DrumVoice; start: number; velocity: number }
interface Score {
  bpm: number;
  leadInstrument: InstrumentId;
  lead: ScoreNote[];
  pad: ScoreNote[];   // one chord per bar, plus '8' stab hits
  bass: ScoreNote[];  // '7' bass hits on the chord root
  drums: DrumHit[];   // kick, snare, hat, openHat, clap, perc, fx
}
function renderScore(session: RecordedSession): Score
```

Rules, each mirroring what live playback does:

- **Lead timing:** each engine event is placed with the same `Scheduler` the audio engine uses, with `now = keystroke timestamp`. Transport time and keystroke time are the same clock.
- **Lead length:** legato, as `LegatoLead` plays it: `min(nextStart − start, written × LEGATO_HOLD)`.
- **Chords:** `harmonyAt(bar).chord` for every bar from 0 through the bar after the last note, voiced like the pad (`pitchClass + 48`), one bar long.
- **Drums, bass and stabs:** walk every 16th step. Before each step, apply every keystroke whose timestamp is at or before that step, so digit edits take effect exactly when they did live. Odd steps are delayed by the genre's swing.
- **Determinism:** the same session always gives the same score.

## 5. The MIDI writer (backend)

**Endpoint:** `POST /api/compositions/{id}/midi`, body = score JSON.
- 404 if the composition does not exist.
- 400 if the score is invalid: bpm outside 40–240, pitch outside 0–127, negative start, non-positive duration, velocity outside 0–1, unknown drum voice or instrument, or more than 20 000 events per track.
- 200 `audio/midi` with `Content-Disposition: attachment; filename="<slug-of-title>.mid"`.

**`MidiWriter`** (`com.keytosound.backend.midi`), `javax.sound.midi`, SMF type 1, 480 PPQ:

| Track | Channel | Program (GM, 0-based) | Content |
|---|---|---|---|
| 0 | — | — | Title (track name) and tempo |
| 1 | 0 | piano 0, electricPiano 4, synthLead 81, eightBit 80, bass 38 | Lead |
| 2 | 1 | 89 (warm pad) | Pad and stabs |
| 3 | 2 | 38 (synth bass 1) | Bass |
| 4 | 9 (GM drums) | — | kick 36, snare 38, hat 42, openHat 46, clap 39, perc 45, fx 49 |

Seconds convert to ticks as `round(seconds × bpm / 60 × 480)`; a note is always at least 1 tick long. Velocity 0..1 maps to MIDI 1..127.

**Filename:** title lower-cased, runs of non-alphanumerics become `-`, trimmed of leading and trailing `-`, at most 60 characters; `composition` if nothing is left.

## 6. UI

An **Export MIDI** button next to Replay on each saved composition: load it, `renderScore`, POST, download the returned file. No styling work (frontend polish is deferred).

## 7. Testing

- **Database:** start on a temp data dir, create a table and row, close, start again on the same dir, and the row is still there.
- **Score:** deterministic; lead notes start on the grid and never overlap; each lead note is no longer than its hold; one chord per bar matching `harmonyAt`; a digit pressed mid-session adds hits only from its step onward; odd steps carry swing.
- **MidiWriter:** read the file back with `MidiSystem.getSequence`: 5 tracks, tempo meta event equals bpm, note-on counts per track equal the input, drums on channel 9, a note at 1s at 120 bpm starts at tick 960, program changes as tabled.
- **Endpoint:** 200 with `audio/midi` and attachment filename; 404 for an unknown id; 400 for an invalid score.
- **Filename:** slug cases, including an empty or symbol-only title.

## 8. Out of scope

Glide and pitch bend in MIDI; exporting unsaved sessions; audio rendering (WAV/MP3); per-genre GM kits.
