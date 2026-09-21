# Sentence-as-Score + Digit Beat Editor — Design

**Status:** approved in brainstorming, 2026-09-21
**Supersedes:** the per-keystroke melody model of `2026-09-19-typing-to-music-design.md` (the determinism contract, persistence and replay from that spec are unchanged)

## 1. Problem

Users hear the current engine as "a random sound generator". Two measured causes:

1. **Key identity barely matters.** `MusicEngine.step` chooses every note independently by softmax over "what sounds good after the previous note". Which letter was typed has almost no influence, so nothing connects a word to a phrase and there is no sense of direction.
2. **Melody and band disagree about harmony.** The engine advances `chordIndex` once per completed word; `BackingBand` advances its own `index` once per bar. The two counters drift, so the lead is often scored against a chord the band is not playing.

## 2. Concept

Two ideas, combined:

- **The sentence is the score.** Words are melodic phrases, punctuation is harmony, paragraphs are key changes.
- **Digits write the beat.** Number keys edit the band's 16-step drum loop live; the loop is saved and replayed with the text.

### Hard rule: no key owns a note

No letter is mapped to a pitch, anywhere. A letter's pitch is a function of (a) the letters before it in the word, (b) the word's start note, chosen by the transition engine from context, and (c) the chord and key sounding at that moment. The same letter therefore produces many different pitches. **The only fixed key assignments are the digits 0-9.**

## 3. Melody: word motifs

### 3.1 Within a word — identity decides

Each letter emits one note. Its melodic *step* (in scale degrees, relative to the previous note of the same word) is derived from a hash of the **lower-cased word prefix typed so far**, including that letter:

```
step(prefix) = STEP_TABLE[fnv1a(prefix) mod STEP_TABLE.length]
STEP_TABLE   = [-2, -1, -1, +1, +1, +2, +3, -3]   // biased to small moves
```

Consequences, all intended:

- A given word always has the same **shape** (sequence of steps).
- Words sharing a prefix share their opening shape: `rain` / `rail` / `rainbow`.
- Repeating a word gives **the same shape on new notes** (different start note, chord, key) — a recognisable theme, never a fixed pitch sequence.

The step is applied in scale degrees of the current key, then passed through the existing clash check (`clashesWithChord`): if the landing note clashes with the sounding chord it moves one scale degree toward the chord's nearest tone. The register window (`REGISTER_LIMIT_FACTOR`) still applies; a step that would leave it is reflected (sign flipped).

### 3.2 Between words — the transition engine decides

The **first letter of a word** is the one note chosen by the existing six-term scoring + softmax (`selectNextPitch`), from the previous word's last note. This is where transitions live: the engine joins phrases smoothly and steers toward the cadence target (3.3). A new seventh scoring term, `target`, pulls candidates toward the current cadence target pitch class when one is set (weight per genre, 0 when no target).

### 3.3 Punctuation is harmony

| Key | Harmony effect | Melody effect |
|---|---|---|
| Space | none | short landing note: last note of the word lengthened to the next 8th |
| `,` | request **half cadence**: next bar plays V (dominant) | next word start pulled toward the 2nd or 5th degree |
| `.` | request **full cadence**: next bar plays I (tonic); progression restarts | pulled to the tonic; the phrase resolves |
| `?` | request **open ending**: next bar plays V, progression holds | pulled to 2nd/7th degree — left unresolved |
| `!` | none | next note accented (+velocity), register ceiling lifted one step |
| Enter | **modulate**: key moves to a related key (alternating up a 5th, then relative minor/major) | next word start re-centred in the new key |
| Backspace | none (harmony never goes backward) | existing falling "erase" gesture, unchanged |

Cadences are *requests*: they take effect at the **next bar boundary** so the band changes chord on the beat, not mid-bar.

## 4. Single harmony clock

A new pure module, `engine/harmony.ts`, becomes the only source of truth for key and chord. Both the melody engine and the backing band read from it.

- **Time base:** bar index = `floor((keystrokeTimestamp) / barMs(bpm))`, using the session-relative timestamps already stored with each keystroke. Harmony is therefore a pure function of the keystroke stream + preset, so the determinism contract holds and replay is exact.
- **Session clock:** keystroke timestamps are measured on a session clock that **excludes paused time** and restarts on a genre switch, exactly as the transport does. Otherwise a pause would shift every later bar boundary between the recording and the band. `SessionRecorder` gains `pause()`/`resume()` to accumulate the paused offset.
- **State:** `keyRoot`, `progressionIndex`, `pendingCadence: none | half | full | open`, `modulationCount`.
- **API:**
  - `advanceTo(timestampMs)` — rolls bars forward, applying a pending cadence at the first bar boundary crossed.
  - `requestCadence(kind)`
  - `modulate()`
  - `chordAt(barIndex)` — what the band plays; progression chords are transposed to the current key.
- The engine's own `chordIndex` bookkeeping is removed; `MusicalState` reads the chord from `Harmony`.
- `BackingBand` no longer keeps `index`; at step 0 of each bar it asks `Harmony` for that bar's chord. During live play the band's bar index comes from the transport position since session start, which is the same clock the keystroke timestamps are measured against.

## 5. Beat: digits edit the loop

### 5.1 Voices

| Digit | Voice |
|---|---|
| 1 | kick |
| 2 | snare |
| 3 | closed hat |
| 4 | open hat |
| 5 | clap |
| 6 | percussion (tom / rim) |
| 7 | bass hit (current chord root) |
| 8 | chord stab (current chord) |
| 9 | riser / effect |
| 0 | reset loop to the genre's preset groove |

The `Groove` type grows from 4 voices to these 9. Existing presets fill the new voices with empty arrays; the loop starts as the preset groove (decided in brainstorming).

### 5.2 Editing

- A digit press at session time `t` targets step `round((t mod barMs) / sixteenthMs) mod 16` — the nearest 16th.
- If that voice already fires on that step, the hit is removed; otherwise it is added (toggle).
- The hit also sounds immediately, as feedback, whether or not it was added.
- Digits are **not** passed to the melody: `TypingAnalyzer` ignores them for word buffers, speed and features.
- New pure module `engine/beat.ts`: `BeatPattern` with `toggle(voice, step)`, `reset(groove)`, `stepsFor(voice)`. Deterministic from the keystroke stream, so replay rebuilds the user's beat with no schema change.

### 5.3 Per-genre kits

`audio/kits.ts` defines each genre's synth settings for the 9 voices, so `1` sounds like a chiptune thump in 8-bit and a dusty kick in Lo-Fi. Audio only; no engine change.

### 5.4 UI

A 16 x 9 step grid under the typing area shows the current loop, with a playhead on the current step. It is display-only in this phase; editing stays on the keyboard.

## 6. Compatibility and versioning

- **Storage:** no database change. Digits and Enter are already captured (`capture.ts`) and stored (`key_value VARCHAR(16)`).
- **Old compositions:** saved settings gain `engineVersion: 2`. A composition without it replays through the current (v1) engine, kept as `engine/legacy/`, so the determinism promise holds for everything already saved.
  - **Deferred (2026-09-21):** not built in the first cut. The embedded database is wiped on every backend restart, so no v1 saves exist yet. This becomes required as soon as the database persists across restarts.
- **Recorder timestamps:** no longer rebased to the first keystroke. They are transport time, which the harmony's bar clock depends on.

## 7. Module map

| Module | Change |
|---|---|
| `typing/analyzer.ts` | emit `wordPrefix`, `isEnter`, `digit`; digits excluded from word/speed features |
| `typing/types.ts` | extend `TypingFeatures` |
| `engine/motif.ts` (new) | `fnv1a`, `step(prefix)`, degree walk + clash nudge + register reflection |
| `engine/harmony.ts` (new) | single harmony clock, cadences, modulation |
| `engine/beat.ts` (new) | `BeatPattern` toggle/reset |
| `engine/scoring.ts` | seventh term `target` |
| `engine/engine.ts` | route: word start → `selectNextPitch`; mid-word → motif; digits → beat; read chord from harmony |
| `engine/types.ts` | 9-voice `Groove`, `ScoringWeights.target`, cadence types |
| `engine/presets.ts` | new voices (empty by default), `target` weight per genre |
| `engine/legacy/` | frozen copy of the v1 engine for old saves |
| `audio/backing.ts` | read chord from harmony and hits from `BeatPattern` each step |
| `audio/kits.ts` (new) | per-genre voices |
| `ui/BeatGrid.tsx` (new) | step grid display |
| `session/*` | write/read `engineVersion` |

`engine/` stays pure (no React, Tone.js or DOM); `purity.test.ts` covers the new files.

## 8. Testing

- **Motif:** same prefix gives the same step; `rain`/`rail` share their first three steps; the same word typed in two keys has equal step sequences but different pitches; no step leaves the register window; no landing note clashes with the chord.
- **No key owns a note:** across a corpus of prose, each letter maps to at least 5 distinct pitches.
- **Harmony:** `.` makes the next bar tonic; `,` and `?` make it V; a cadence never applies mid-bar; Enter changes key; backspace never moves harmony.
- **Single clock:** for a recorded session, the chord the engine scores against equals the chord `BackingBand` would play at every note.
- **Beat:** toggle is its own inverse; step quantisation rounds to the nearest 16th including the bar wrap; `0` restores the preset; digits never produce melody notes.
- **Determinism:** the same stream + seed gives identical notes *and* an identical beat pattern; v1 saves still replay identically through the legacy engine.

## 9. Out of scope

- Clicking the grid to edit (keyboard only in this phase).
- User-defined digit mappings.
- Motif shapes evolving on repetition (rejected in brainstorming: same shape, new notes).
- Plan 3 items (auth, MIDI export, analytics).
