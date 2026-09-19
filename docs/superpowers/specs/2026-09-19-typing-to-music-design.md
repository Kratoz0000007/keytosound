# Typing-to-Music — Design Specification

**Date:** 2026-09-19
**Status:** Approved, pre-implementation
**Project root:** `D:\projects\keytosound`

---

## 1. Purpose

A full-stack application that turns real-time typing into a continuously evolving musical
composition. Typing is the input language; music is the output language.

The project must read as *"the computer is composing music from the way I type"* rather than
*"every key makes a sound."* The component that produces that difference is the **transition
engine**, which selects each note from the previous musical state rather than from a fixed
key-to-note table.

This serves two audiences at once: an academic deliverable and a portfolio piece.

## 2. Locked decisions

These were settled during brainstorming and are not open questions during implementation.

| Area | Decision | Rationale |
|---|---|---|
| Purpose | Academic work and resume piece | Both weigh on scope choices |
| Hard requirement | Real database with genuine persistence | Course requirement |
| Language requirement | **Java must be included** | Explicit user requirement |
| Budget | ~15 working days; interim stretch target within 2 days | User-stated |
| Musical background | None formal | Theory must be encoded, not exposed as knobs |
| Timing model | **Quantized to a beat grid** | Irregular typing rhythm is the primary cause of generated music sounding amateur |
| Texture | **Backing band + typing plays lead** | Harmony underneath makes melodic choices legible; highest quality-per-hour available |
| Excellence priority | **Transition engine depth only** | Everything else is built to be adequate and honest |
| Persistence model | Keystroke stream + settings + seed | Deterministic replay; tiny payloads; powers the evaluation harness |
| Accounts | Email + password | User requirement, chosen over the cheaper share-link model |
| WebSockets | **Excluded from baseline** | No honest single-user need; listed as stretch (spectator mode) |

### Scope reductions accepted

To protect the engine budget: **6 genres reduced to 3**, **9 instruments reduced to 5**, and auth
trimmed to essentials (JWT; no refresh-token rotation, no email verification).

## 3. Architecture

```
+- BROWSER -------------------------------------------------+
|                                                           |
|  KeyboardCapture --> TypingAnalyzer --> FeatureExtractor   |
|   (raw events)        (rolling stats)   (TypingFeatures)   |
|                                              |            |
|                                              v            |
|                  +---- MusicEngine (pure TS) ----+        |
|                  |  MusicalMapper                |        |
|                  |  TransitionEngine  <-+        |        |
|                  |  MusicalState -------+        |        |
|                  +---------+---------------------+        |
|                            | MusicalEvent[]               |
|                  +---------v----------+                   |
|                  |  Scheduler (grid)  |                   |
|                  +----+----------+----+                   |
|                       v          v                        |
|                 AudioEngine   Visualizer                  |
|                  (Tone.js)     (Canvas)                   |
|                                                           |
|  SessionRecorder --> keystrokes + settings + seed         |
+----------------------------+------------------------------+
                             | REST (JSON)
+- SPRING BOOT --------------v------------------------------+
|  AuthController    CompositionController                  |
|  PresetController  MidiExportController   AnalyticsService|
|         +-------------- JPA / Flyway --------------+      |
+---------------------------------------------------+------+
                                              +-----v-----+
                                              | Postgres  |
                                              +-----------+
```

### Governing rule

**The engine is a pure TypeScript library with no dependency on React, the DOM, Tone.js, or the
network.** Typed events in, musical events out. Audio, UI, and transport are adapters around it.

### The critical seam

The boundary between `FeatureExtractor` and `MusicEngine`. Left of it, code understands typing and
knows nothing about music. Right of it, code understands music and knows nothing about keyboards.
The entire contract is one type, `TypingFeatures`.

This seam is what makes the engine unit-testable: synthetic feature streams can be fed to it in
Node with no browser present.

### Why the Scheduler is separate from the engine

The engine decides *what* note comes next and its length in **musical time** (beats). The scheduler
decides *when* that becomes audible in **wall-clock time**. Separating them keeps the engine
deterministic and time-independent, which is the precondition for bit-exact replay.

### Determinism contract

```
(keystroke stream, settings, seed) -> identical note sequence, always
```

The engine uses a seeded PRNG. It never calls `Math.random()` and never reads the clock. Enforced
by a test that replays a fixture session twice and asserts array equality.

Saved compositions, MIDI export, and the ability to evaluate engine changes by ear all depend on
this holding.

## 4. Module specifications

### 4.1 KeyboardCapture

Captures key events from the typing surface. Emits `{ key, code, timestamp, isModifier }`. Owns
nothing else. Timestamps come from `performance.now()`.

### 4.2 TypingAnalyzer

Maintains rolling statistics across a sliding window: inter-key intervals, words per minute,
current word buffer, sentence position, pause duration since last keystroke.

### 4.3 FeatureExtractor

Reduces analyzer state to `TypingFeatures`, the engine's only input:

```
interval        ms since previous keystroke
speed           rolling WPM
wordLength      length of the word just completed (0 while mid-word)
sentencePos     index of the current word within the sentence
pauseDuration   ms of silence preceding this event
punctuation     none | period | comma | exclamation | question
isCapital       boolean
isBackspace     boolean
```

### 4.4 MusicalState

Carried between notes: key and scale, current chord (position in a looping progression), previous
pitch, contour direction and momentum, phrase position, energy, tension.

### 4.5 MusicalMapper

Translates `TypingFeatures` into musical parameters before note selection:

- **Inter-key interval** to note duration and grid subdivision
- **Rolling WPM** to energy, driving velocity, note density, octave spread, leap allowance
- **Word length** to the *shape* of a melodic gesture. Short word: small excursion. Long word: a
  full arc with a registral peak.
- **Space** advances the chord progression and marks a phrase boundary
- **Period** forces resolution and a longer note
- **Comma** gives a short rest and holds tension
- **Exclamation** gives a velocity accent plus an upward leap
- **Question mark** leaves the line on an unresolved 2nd or 7th with rising contour
- **Capital** gives a velocity accent
- **Backspace** echoes the previous note

### 4.6 TransitionEngine

The core of the project.

**Candidate generation:** every scale pitch within 12 semitones either side of the previous note.

**Scoring** — weighted sum of six terms, weights varying by genre:

1. **Interval preference.** Stepwise motion strongly favoured; score decays with leap size. Long
   words raise the leap allowance.
2. **Chord-tone affinity.** Chord tones score higher, dramatically so on strong beats. Non-chord
   tones are permitted only as passing notes — approached *and* left by step.
3. **Contour momentum.** After two or three rising notes, a mild bias to continue rising. After a
   large leap, a **strong bias to reverse direction by step.** This single rule is the largest
   contributor to melodies sounding intentional rather than generated.
4. **Register gravity.** A soft pull toward a comfortable centre octave, with penalty growing with
   distance. Prevents the classic random-walk failure where a melody wanders off the top of the
   keyboard.
5. **Repetition penalty.** Decaying penalty on recently used pitches, so the melody cannot stick.
6. **Tension curve.** Phrase position sets a tension target: stable chord tones early, 4ths and
   7ths mid-phrase, forced resolution to a tonic chord tone at phrase end.

**Selection:** softmax over scores with a genre-controlled temperature (8-Bit low = tight and
predictable; Lo-Fi high = loose and surprising), sampled with the seeded PRNG.

Randomness exists, but only inside musical constraints.

### 4.7 Scale safety

Because the user judges by ear rather than theory, defaults are **major and minor pentatonic** —
no semitone clashes, so genuinely bad notes are close to impossible. All three shipping genres use
pentatonic scales. Richer seven-note modes (Dorian, Mixolydian) are reserved for the future Jazz
and Classical presets, where they must be paired with heavy chord-tone weighting to compensate for
the added clash risk.

### 4.8 Phrase model

The **word** is the melodic gesture. The **sentence** is the phrase. Phrases align to a 4- or 8-bar
chord loop.

### 4.9 Scheduler

Holds the transport clock. Receives musical events with beat-relative timing and schedules them
onto the next available grid slot (8th or 16th note depending on energy). Uses lookahead
scheduling to stay sample-accurate.

### 4.10 AudioEngine

Tone.js adapter. Owns instrument instantiation, the backing band (drums, bass, chord pad), effects
per genre, and the master bus. Receives scheduled events; makes no musical decisions.

### 4.11 Visualizer

Canvas renderer driven by the same scheduled events as the audio. Displays the live note stream,
current and previous note, active scale and key, BPM, typing speed, genre and instrument.

### 4.12 SessionRecorder

Records keystroke events with timings, plus settings and seed. Produces the payload that is saved,
and replays it back through the engine on load.

## 5. Genre and instrument system

Genres are **data, not code** — a genre is a parameter set, so adding one is authoring, not
programming. Each genre supplies: scale set, chord progression, tempo range, scoring weights,
softmax temperature, grid subdivision, instrument defaults, and effects chain.

**Shipping 3 genres** (Lo-Fi, Synthwave, 8-Bit) and **5 instruments** (Piano, Synth Lead, Electric
Piano, Bass, 8-Bit Synth). Classical, Jazz, and Ambient remain authorable later at no
architectural cost.

## 6. Backend responsibilities (Spring Boot)

Java is given work it is genuinely good at, rather than auth and CRUD alone:

1. **Musical model serving.** Scales, chord progressions, and transition weight tables live in
   Postgres and are served by Spring. The browser engine becomes a runtime; Spring is the authoring
   and versioning layer for the musical brain.
2. **MIDI export** via `javax.sound.midi` (JDK standard library). The strongest portfolio artifact
   in the project: download a `.mid` from a typing session and open it in any DAW.
3. **Session analytics.** Typing rhythm histograms, WPM distributions, and pause analysis computed
   server-side over stored keystroke streams.
4. **Auth and composition persistence.** Deliberately lean.

### Data model (initial)

```
users           id, email, password_hash, created_at
compositions    id, user_id, title, seed, settings_json, created_at
keystrokes      id, composition_id, ordinal, key, timestamp_ms
genre_presets   id, name, params_json, version
```

Schema managed with Flyway migrations.

### API surface (initial)

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/compositions
POST   /api/compositions
GET    /api/compositions/{id}
DELETE /api/compositions/{id}
GET    /api/compositions/{id}/midi
GET    /api/presets
GET    /api/compositions/{id}/analytics
```

## 7. Testing and evaluation

**Determinism test.** Replay a fixture session twice; assert identical note arrays. This is the
foundational test — several features are unsound without it.

**Engine unit tests** run headless in Node against synthetic `TypingFeatures` streams. Assertions
are musical invariants rather than exact outputs:

- every emitted pitch is in the active scale
- a leap greater than a fifth is followed by stepwise motion in the opposite direction
- a phrase ending on a period resolves to a tonic chord tone
- pitch stays within the configured register bounds over a long run
- no pitch repeats more than N times consecutively

**Ear evaluation harness.** Because the user has no formal theory background, engine quality is
judged by listening. Deterministic replay makes this rigorous: save a typing session once, then
replay that identical input through two engine versions and compare. Without determinism this
comparison is impossible.

## 8. Scope

**In scope:** typing capture and analysis; the transition engine; quantized scheduling; backing
band; 3 genres; 5 instruments; Postgres persistence of keystroke streams; email/password auth;
deterministic replay; MIDI export; live visualizer.

**Out of scope:** WebSockets; audio file rendering or storage; collaborative editing; mobile
layout; social features; more than 3 genres at launch.

**Stretch, in priority order:** live spectator mode over WebSocket; the remaining 3 genres;
session analytics dashboard; deployment.

## 9. Build order

Each step leaves something that runs.

| # | Block | Notes |
|---|---|---|
| 1 | Scaffold: Vite + React + TS, Spring Boot, Postgres via docker-compose | Unblocks everything |
| 2 | Typing capture to analyzer to `TypingFeatures` | Pure logic, immediately testable |
| 3 | **Engine: musical state + transition engine** | The risk. Headless tests, no audio needed |
| 4 | Scheduler + Tone.js + backing band | First point at which it can be heard |
| 5 | 2 genres, 3 instruments | Proves the preset abstraction |
| 6 | Spring: Composition entity, Flyway, save/load REST | Satisfies the database requirement |
| 7 | Recorder + replay round-trip | Closes the loop; proves determinism |
| 8 | Live state readout + visualizer | Makes it demoable |
| 9 | Auth | Deferred deliberately: produces nothing showable |
| 10 | MIDI export, third genre, analytics, polish | Remaining scope |

Natural stopping points: after step 4 (makes real music, no persistence) and after step 7
(complete vertical slice).

## 10. Risks

| Risk | Mitigation |
|---|---|
| Engine sounds mechanical despite the design | Contour momentum and register gravity are the two highest-value rules; implement and tune first. Pentatonic defaults bound the downside. |
| Quantization latency feels unresponsive | Grid subdivision scales with energy; fast typing gets 16th notes, cutting worst-case delay |
| Backing band overwhelms the melody | Lead sits in a higher register with dedicated mix headroom; backing is deliberately sparse |
| Auth consumes engine time | Sequenced last among core work; trimmed to JWT essentials |
| Two languages cause type drift | Engine types are the source of truth; backend stores `settings_json` opaquely rather than modelling it |
