# MIDI Export (Plan 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Download any saved composition as a standard multi-track `.mid` file (lead, pad, bass, drums) written by Java.

**Architecture:** The browser replays a saved composition's keystrokes headlessly through the deterministic engine and builds a *score* (notes in seconds). It POSTs the score to `POST /api/compositions/{id}/midi`; Spring validates it and `MidiWriter` encodes it with `javax.sound.midi`. A prerequisite task makes the dev database persist across restarts, so saved compositions still exist to export.

**Tech Stack:** Spring Boot 4.1.1 (Java 22, Jackson 3 `tools.jackson`), `javax.sound.midi` (JDK), Zonky embedded-postgres 2.0.7, JUnit 5 + MockMvc; React 19 + TypeScript strict, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-21-midi-export-design.md`

## Global Constraints

- Nothing in `frontend/src/engine/` or `frontend/src/typing/` may import React, Tone.js or the DOM (`tests/engine/purity.test.ts` enforces it). `frontend/src/session/score.ts` must be pure the same way.
- Determinism: `(keystrokes, genre, seed)` → identical output. No `Math.random`, `Date.now` or `performance.now` in score rendering.
- Spring Boot 4 uses Jackson 3: `tools.jackson.databind.*`, not `com.fasterxml.jackson.databind.*`. `@AutoConfigureMockMvc` lives in `org.springframework.boot.webmvc.test.autoconfigure`.
- Tests must never touch the dev database: persistence is enabled only by the `dev` profile, which only `spring-boot:run` activates.
- Git: every command needs `-c safe.directory=D:/projects/keytosound`. **The user commits and pushes.** Commit steps below are checkpoints: stop, tell the user the suggested message, and do not add Co-Authored-By trailers. `.claude/` is never tracked.
- Frontend commands run from `frontend/` (`npx vitest run`); backend commands from `backend/` (`./mvnw -B test`).

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/main/java/com/keytosound/backend/config/EmbeddedPostgresConfig.java` (modify) | Start embedded Postgres; reuse a data directory when `keytosound.db.data-dir` is set |
| `backend/src/main/resources/application-dev.yml` (create) | `dev` profile: persistent data dir `.pgdata` |
| `backend/pom.xml` (modify) | `spring-boot:run` activates the `dev` profile |
| `.gitignore` (modify) | ignore `.pgdata/` |
| `frontend/src/session/score.ts` (create) | `renderScore(session)`: keystrokes → score |
| `backend/src/main/java/com/keytosound/backend/midi/Score.java`, `ScoreNote.java`, `DrumHit.java` (create) | Validated score request records |
| `backend/src/main/java/com/keytosound/backend/midi/MidiWriter.java` (create) | Score → SMF type 1 bytes |
| `backend/src/main/java/com/keytosound/backend/midi/MidiFilenames.java` (create) | Title → safe file name |
| `backend/src/main/java/com/keytosound/backend/midi/MidiExportController.java` (create) | `POST /api/compositions/{id}/midi` |
| `backend/src/main/java/com/keytosound/backend/config/CorsConfig.java` (modify) | Expose `Content-Disposition` |
| `frontend/src/session/api.ts` (modify) | `exportMidi(id, score)` |
| `frontend/src/ui/download.ts` (create) | Save a Blob as a file |
| `frontend/src/ui/CompositionList.tsx`, `frontend/src/ui/TypingSurface.tsx` (modify) | Export MIDI button and handler |

---

### Task 1: Persistent dev database

**Files:**
- Modify: `backend/src/main/java/com/keytosound/backend/config/EmbeddedPostgresConfig.java`
- Create: `backend/src/main/resources/application-dev.yml`
- Modify: `backend/pom.xml` (the `spring-boot-maven-plugin` block, currently lines 95-97)
- Modify: `.gitignore`
- Test: `backend/src/test/java/com/keytosound/backend/config/EmbeddedPostgresConfigTest.java`

**Interfaces:**
- Produces: `static EmbeddedPostgres EmbeddedPostgresConfig.start(Path dataDir) throws IOException`. A `null` dataDir means throwaway.

- [ ] **Step 1: Write the failing test**

```java
package com.keytosound.backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class EmbeddedPostgresConfigTest {

    @Test
    void keepsDataAcrossRestartsWhenGivenADataDirectory(@TempDir Path dir) throws Exception {
        Path data = dir.resolve("pgdata");

        try (EmbeddedPostgres first = EmbeddedPostgresConfig.start(data);
                Connection c = first.getPostgresDatabase().getConnection();
                Statement s = c.createStatement()) {
            s.execute("CREATE TABLE survivor (x INT)");
            s.execute("INSERT INTO survivor VALUES (42)");
        }

        try (EmbeddedPostgres second = EmbeddedPostgresConfig.start(data);
                Connection c = second.getPostgresDatabase().getConnection();
                Statement s = c.createStatement();
                ResultSet rs = s.executeQuery("SELECT x FROM survivor")) {
            assertThat(rs.next()).isTrue();
            assertThat(rs.getInt(1)).isEqualTo(42);
        }
    }

    @Test
    void startsAThrowawayDatabaseWithoutADataDirectory() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgresConfig.start(null);
                Connection c = pg.getPostgresDatabase().getConnection();
                Statement s = c.createStatement();
                ResultSet rs = s.executeQuery("SELECT 1")) {
            assertThat(rs.next()).isTrue();
        }
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `backend/`): `./mvnw -B test -Dtest=EmbeddedPostgresConfigTest`
Expected: COMPILATION ERROR, `cannot find symbol: method start(java.nio.file.Path)`.

- [ ] **Step 3: Implement**

Replace the body of `EmbeddedPostgresConfig` (keep the class Javadoc, and append the paragraph below to it):

```java
package com.keytosound.backend.config;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * (existing Javadoc paragraphs unchanged)
 *
 * <p>By default the database lives in a temporary directory and is gone on
 * shutdown, which is what tests want. The {@code dev} profile sets
 * {@code keytosound.db.data-dir}, and the same directory is then reused, so
 * saved compositions survive a restart of {@code spring-boot:run}.
 */
@Configuration
@Profile("!external-db")
public class EmbeddedPostgresConfig {

    @Value("${keytosound.db.data-dir:}")
    private String dataDir;

    @Bean(destroyMethod = "close")
    public EmbeddedPostgres embeddedPostgres() throws IOException {
        return start(dataDir.isBlank() ? null : Path.of(dataDir));
    }

    @Bean
    public DataSource dataSource(EmbeddedPostgres postgres) {
        return postgres.getPostgresDatabase();
    }

    /**
     * Starts PostgreSQL, reusing {@code dataDir} when given. Zonky only runs
     * initdb when the directory holds no cluster yet, so a second start finds
     * the data the first one wrote.
     */
    static EmbeddedPostgres start(Path dataDir) throws IOException {
        EmbeddedPostgres.Builder builder = EmbeddedPostgres.builder();
        if (dataDir != null) {
            Files.createDirectories(dataDir);
            builder.setDataDirectory(dataDir).setCleanDataDirectory(false);
        }
        return builder.start();
    }
}
```

Create `backend/src/main/resources/application-dev.yml`:

```yaml
# Active only under spring-boot:run (see the spring-boot-maven-plugin block in
# pom.xml). Tests never load it, so they keep a throwaway database.
keytosound:
  db:
    # Relative to the backend/ directory spring-boot:run runs from.
    data-dir: .pgdata
```

In `backend/pom.xml`, replace

```xml
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>
```

with

```xml
				<artifactId>spring-boot-maven-plugin</artifactId>
				<configuration>
					<!-- Only the run goal: tests must never see the dev database. -->
					<profiles>
						<profile>dev</profile>
					</profiles>
				</configuration>
			</plugin>
```

Append to `.gitignore`:

```
# The dev database's files (backend/.pgdata), written by spring-boot:run.
.pgdata/
```

- [ ] **Step 4: Run the tests**

Run: `./mvnw -B test`
Expected: all tests pass, including the 2 new ones (25 total).

- [ ] **Step 5: Verify the dev profile by hand**

Run: `./mvnw -B spring-boot:run`. The log must contain `The following 1 profile is active: "dev"`, and `backend/.pgdata/postgresql.conf` must exist. Save a composition (`curl -X POST http://localhost:8080/api/compositions -H "Content-Type: application/json" -d "{\"title\":\"survivor\",\"genreId\":\"lofi\",\"seed\":1,\"settings\":{\"genreId\":\"lofi\"},\"keystrokes\":[{\"key\":\"a\",\"timestampMs\":0}]}"`), stop the server, start it again, and `curl http://localhost:8080/api/compositions` must still list `survivor`.
If the restart fails with `lock file "postmaster.pid" already exists` after a hard kill, delete `backend/.pgdata/postmaster.pid` and start again.

- [ ] **Step 6: Checkpoint (user commits)**

```bash
git add .gitignore backend/pom.xml backend/src/main/resources/application-dev.yml backend/src/main/java/com/keytosound/backend/config/EmbeddedPostgresConfig.java backend/src/test/java/com/keytosound/backend/config/EmbeddedPostgresConfigTest.java
git commit -m "fix: persist the dev database across backend restarts"
```

---

### Task 2: Render a score from a saved session

**Files:**
- Create: `frontend/src/session/score.ts`
- Test: `frontend/tests/session/score.test.ts`

**Interfaces:**
- Consumes: `MusicEngine` (`step`, `harmonyAt(bar)`, `beatHas(voice, step)`, `swing`) from `src/engine/engine.ts`; `TypingAnalyzer` from `src/typing/analyzer.ts`; `Scheduler` from `src/audio/scheduler.ts` (`new Scheduler(bpm, startTime).schedule(event, nowSeconds)` → `{ pitch, velocity, durationSeconds, time }`); `LEGATO_HOLD` from `src/audio/lead.ts`; `VOICES`, `Voice` from `src/engine/beat.ts`; `RecordedSession` from `src/session/types.ts`.
- Produces:

```ts
export type DrumVoice = 'kick' | 'snare' | 'hat' | 'openHat' | 'clap' | 'perc' | 'fx';
export interface ScoreNote { pitch: number; start: number; duration: number; velocity: number }
export interface DrumHit { voice: DrumVoice; start: number; velocity: number }
export interface Score {
  bpm: number;
  leadInstrument: InstrumentId;
  lead: ScoreNote[];
  pad: ScoreNote[];
  bass: ScoreNote[];
  drums: DrumHit[];
}
export function renderScore(session: RecordedSession): Score;
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { GENRES } from '../../src/engine/presets';
import { renderScore } from '../../src/session/score';
import type { RecordedSession } from '../../src/session/types';

/** Types text on a steady, human-ish rhythm, as the recorder would store it. */
function session(text: string, genreId = 'lofi', startMs = 100): RecordedSession {
  let t = startMs;
  const keystrokes = [...text].map((ch, i) => {
    t += ' .,!?'.includes(ch) ? 220 : 120 + ((i * 37) % 160);
    return { key: ch === '\n' ? 'Enter' : ch, timestamp: t };
  });
  return { genreId, seed: 20260919, keystrokes };
}

const PROSE = 'rain falls softly on the harbour, the night is long.';

describe('renderScore', () => {
  it('is deterministic', () => {
    expect(renderScore(session(PROSE))).toEqual(renderScore(session(PROSE)));
  });

  it('carries the genre tempo and lead instrument', () => {
    const score = renderScore(session(PROSE, 'synthwave'));
    expect(score.bpm).toBe(GENRES.synthwave.bpm);
    expect(score.leadInstrument).toBe(GENRES.synthwave.leadInstrument);
  });

  it('places every lead note on the 16th-note grid', () => {
    const score = renderScore(session(PROSE));
    const sixteenth = 60 / GENRES.lofi.bpm / 4;
    expect(score.lead.length).toBeGreaterThan(20);
    for (const note of score.lead) {
      const steps = note.start / sixteenth;
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
    }
  });

  it('plays the lead legato: notes never overlap and never outlast their hold', () => {
    const { lead } = renderScore(session(PROSE));
    for (let i = 0; i < lead.length - 1; i++) {
      expect(lead[i].duration).toBeGreaterThan(0);
      expect(lead[i].start + lead[i].duration).toBeLessThanOrEqual(lead[i + 1].start + 1e-9);
    }
  });

  it('holds one pad chord per bar, through the bar after the last keystroke', () => {
    const s = session(PROSE);
    const score = renderScore(s);
    const barSec = (4 * 60) / GENRES.lofi.bpm;
    const chordStarts = new Set(
      score.pad.filter((n) => Math.abs(n.duration - barSec) < 1e-9).map((n) => n.start),
    );
    const lastKeySec = s.keystrokes[s.keystrokes.length - 1].timestamp / 1000;
    expect(chordStarts.size).toBe(Math.floor(lastKeySec / barSec) + 2);
  });

  it('resolves the pad to the home chord after a full stop', () => {
    const score = renderScore(session('the night is long.'));
    const barSec = (4 * 60) / GENRES.lofi.bpm;
    const lastBar = [...score.pad]
      .filter((n) => Math.abs(n.duration - barSec) < 1e-9)
      .reduce((max, n) => Math.max(max, n.start), 0);
    const finalChord = score.pad.filter((n) => n.start === lastBar && n.duration > 1);
    const home = GENRES.lofi.progression[0];
    const expected = home.intervals.map((i) => ((home.root + i) % 12) + 48).sort();
    expect(finalChord.map((n) => n.pitch).sort()).toEqual(expected);
  });

  it('applies a digit edit only from the moment it was pressed', () => {
    // Lo-Fi starts with no clap; '5' adds one mid-session.
    const s = session('rain falls softly on the harbour');
    const pressAt = s.keystrokes[10].timestamp + 1;
    s.keystrokes.splice(11, 0, { key: '5', timestamp: pressAt });
    const claps = renderScore(s).drums.filter((d) => d.voice === 'clap');
    expect(claps.length).toBeGreaterThan(0);
    for (const clap of claps) expect(clap.start).toBeGreaterThanOrEqual(pressAt / 1000);
  });

  it('delays odd 16ths by the genre swing', () => {
    // Jazz hats fire on step 3; swing is 0.5 of a 16th.
    const score = renderScore(session(PROSE, 'jazz'));
    const sixteenth = 60 / GENRES.jazz.bpm / 4;
    const expected = 3 * sixteenth + GENRES.jazz.groove.swing * sixteenth;
    expect(score.drums.some((d) => d.voice === 'hat' && Math.abs(d.start - expected) < 1e-9)).toBe(
      true,
    );
  });

  it('puts bass hits on the chord root, two octaves down', () => {
    const score = renderScore(session(PROSE));
    expect(score.bass.length).toBeGreaterThan(0);
    const firstRoot = GENRES.lofi.progression[0].root;
    expect(score.bass[0].pitch).toBe(firstRoot + 24);
  });

  it('renders an empty session as two bars of band and no lead', () => {
    const score = renderScore({ genreId: 'lofi', seed: 1, keystrokes: [] });
    expect(score.lead).toEqual([]);
    expect(score.drums.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run (from `frontend/`): `npx vitest run tests/session/score.test.ts`
Expected: FAIL, `Failed to resolve import "../../src/session/score"`.

- [ ] **Step 3: Implement `frontend/src/session/score.ts`**

```ts
import { LEGATO_HOLD } from '../audio/lead';
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
    written.push({
      pitch: placed.pitch,
      start: placed.time,
      length: placed.durationSeconds,
      velocity: placed.velocity,
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
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: all pass (294 existing + 10 new).

- [ ] **Step 5: Checkpoint (user commits)**

```bash
git add frontend/src/session/score.ts frontend/tests/session/score.test.ts
git commit -m "feat: render a saved session into a multi-track score"
```

---

### Task 3: MidiWriter and file names (Java)

**Files:**
- Create: `backend/src/main/java/com/keytosound/backend/midi/ScoreNote.java`
- Create: `backend/src/main/java/com/keytosound/backend/midi/DrumHit.java`
- Create: `backend/src/main/java/com/keytosound/backend/midi/Score.java`
- Create: `backend/src/main/java/com/keytosound/backend/midi/MidiWriter.java`
- Create: `backend/src/main/java/com/keytosound/backend/midi/MidiFilenames.java`
- Test: `backend/src/test/java/com/keytosound/backend/midi/MidiWriterTest.java`
- Test: `backend/src/test/java/com/keytosound/backend/midi/MidiFilenamesTest.java`

**Interfaces:**
- Consumes: the JSON shape of `Score` from Task 2.
- Produces: `record Score(int bpm, String leadInstrument, List<ScoreNote> lead, List<ScoreNote> pad, List<ScoreNote> bass, List<DrumHit> drums)`; `record ScoreNote(int pitch, double start, double duration, double velocity)`; `record DrumHit(String voice, double start, double velocity)`; `@Component MidiWriter` with `byte[] write(String title, Score score)`, and constants `PPQ = 480`, `DRUM_CHANNEL = 9`; `static String MidiFilenames.slug(String title)`.

- [ ] **Step 1: Write the failing tests**

`MidiFilenamesTest.java`:

```java
package com.keytosound.backend.midi;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MidiFilenamesTest {

    @Test
    void lowercasesAndHyphenatesATitle() {
        assertThat(MidiFilenames.slug("Rain at Night!")).isEqualTo("rain-at-night");
    }

    @Test
    void collapsesRunsOfSymbolsAndTrimsTheEnds() {
        assertThat(MidiFilenames.slug("  --hello,   world--  ")).isEqualTo("hello-world");
    }

    @Test
    void fallsBackWhenNothingUsableIsLeft() {
        assertThat(MidiFilenames.slug("!!!")).isEqualTo("composition");
        assertThat(MidiFilenames.slug("   ")).isEqualTo("composition");
        assertThat(MidiFilenames.slug(null)).isEqualTo("composition");
    }

    @Test
    void capsTheLengthWithoutEndingOnAHyphen() {
        String slug = MidiFilenames.slug("word ".repeat(30));
        assertThat(slug.length()).isLessThanOrEqualTo(60);
        assertThat(slug).doesNotEndWith("-");
    }
}
```

`MidiWriterTest.java`:

```java
package com.keytosound.backend.midi;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.util.List;
import javax.sound.midi.MetaMessage;
import javax.sound.midi.MidiEvent;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.Track;
import org.junit.jupiter.api.Test;

class MidiWriterTest {

    private final MidiWriter writer = new MidiWriter();

    private static Score score() {
        return new Score(
                120,
                "synthLead",
                List.of(new ScoreNote(69, 1.0, 0.5, 0.8), new ScoreNote(72, 1.5, 0.25, 0.6)),
                List.of(new ScoreNote(57, 0.0, 2.0, 0.5), new ScoreNote(60, 0.0, 2.0, 0.5)),
                List.of(new ScoreNote(33, 0.0, 0.25, 0.7)),
                List.of(new DrumHit("kick", 0.0, 0.8), new DrumHit("snare", 0.5, 0.8),
                        new DrumHit("fx", 1.0, 0.8)));
    }

    private static Sequence read(byte[] bytes) throws Exception {
        return MidiSystem.getSequence(new ByteArrayInputStream(bytes));
    }

    private static List<ShortMessage> noteOns(Track track) {
        List<ShortMessage> out = new java.util.ArrayList<>();
        for (int i = 0; i < track.size(); i++) {
            if (track.get(i).getMessage() instanceof ShortMessage m
                    && m.getCommand() == ShortMessage.NOTE_ON && m.getData2() > 0) {
                out.add(m);
            }
        }
        return out;
    }

    private static MidiEvent firstNoteOn(Track track) {
        for (int i = 0; i < track.size(); i++) {
            if (track.get(i).getMessage() instanceof ShortMessage m
                    && m.getCommand() == ShortMessage.NOTE_ON && m.getData2() > 0) {
                return track.get(i);
            }
        }
        throw new AssertionError("no note-on");
    }

    @Test
    void writesAConductorTrackPlusFourInstrumentTracks() throws Exception {
        Sequence seq = read(writer.write("rain", score()));
        assertThat(seq.getTracks()).hasSize(5);
        assertThat(seq.getDivisionType()).isEqualTo(Sequence.PPQ);
        assertThat(seq.getResolution()).isEqualTo(MidiWriter.PPQ);
    }

    @Test
    void storesTheTempo() throws Exception {
        Track conductor = read(writer.write("rain", score())).getTracks()[0];
        int microsPerQuarter = -1;
        for (int i = 0; i < conductor.size(); i++) {
            if (conductor.get(i).getMessage() instanceof MetaMessage m && m.getType() == 0x51) {
                byte[] d = m.getData();
                microsPerQuarter = ((d[0] & 0xff) << 16) | ((d[1] & 0xff) << 8) | (d[2] & 0xff);
            }
        }
        assertThat(microsPerQuarter).isEqualTo(500_000); // 120 bpm
    }

    @Test
    void writesEveryNoteToItsTrack() throws Exception {
        Track[] tracks = read(writer.write("rain", score())).getTracks();
        assertThat(noteOns(tracks[1])).hasSize(2); // lead
        assertThat(noteOns(tracks[2])).hasSize(2); // pad
        assertThat(noteOns(tracks[3])).hasSize(1); // bass
        assertThat(noteOns(tracks[4])).hasSize(3); // drums
    }

    @Test
    void convertsSecondsToTicks() throws Exception {
        Track lead = read(writer.write("rain", score())).getTracks()[1];
        // 1.0s at 120 bpm is 2 beats, and 2 x 480 = 960 ticks.
        assertThat(firstNoteOn(lead).getTick()).isEqualTo(960);
    }

    @Test
    void putsDrumsOnTheGeneralMidiDrumChannelWithStandardNotes() throws Exception {
        List<ShortMessage> drums = noteOns(read(writer.write("rain", score())).getTracks()[4]);
        assertThat(drums).allMatch(m -> m.getChannel() == MidiWriter.DRUM_CHANNEL);
        assertThat(drums).extracting(ShortMessage::getData1).containsExactly(36, 38, 49);
    }

    @Test
    void setsTheLeadProgramFromTheInstrument() throws Exception {
        Track lead = read(writer.write("rain", score())).getTracks()[1];
        int program = -1;
        for (int i = 0; i < lead.size(); i++) {
            if (lead.get(i).getMessage() instanceof ShortMessage m
                    && m.getCommand() == ShortMessage.PROGRAM_CHANGE) {
                program = m.getData1();
            }
        }
        assertThat(program).isEqualTo(81); // GM "Lead 2 (sawtooth)"
    }

    @Test
    void neverWritesAZeroLengthNote() throws Exception {
        Score tiny = new Score(120, "piano", List.of(new ScoreNote(60, 0.0, 0.0001, 0.5)),
                List.of(), List.of(), List.of());
        Track lead = read(writer.write("x", tiny)).getTracks()[1];
        long on = -1;
        long off = -1;
        for (int i = 0; i < lead.size(); i++) {
            if (lead.get(i).getMessage() instanceof ShortMessage m) {
                if (m.getCommand() == ShortMessage.NOTE_ON && m.getData2() > 0) on = lead.get(i).getTick();
                if (m.getCommand() == ShortMessage.NOTE_OFF) off = lead.get(i).getTick();
            }
        }
        assertThat(off).isGreaterThan(on);
    }

    @Test
    void mapsVelocityIntoTheMidiRange() {
        assertThat(MidiWriter.midiVelocity(0.0)).isEqualTo(1);
        assertThat(MidiWriter.midiVelocity(1.0)).isEqualTo(127);
        assertThat(MidiWriter.midiVelocity(0.5)).isEqualTo(64);
    }
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `./mvnw -B test -Dtest='MidiWriterTest,MidiFilenamesTest'`
Expected: COMPILATION ERROR, `cannot find symbol: class MidiWriter`.

- [ ] **Step 3: Implement**

`ScoreNote.java`:

```java
package com.keytosound.backend.midi;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/** One pitched note. Times in seconds from the session start; velocity 0..1. */
public record ScoreNote(
        @Min(0) @Max(127) int pitch,
        @PositiveOrZero double start,
        @Positive double duration,
        @DecimalMin("0.0") @DecimalMax("1.0") double velocity) {}
```

`DrumHit.java`:

```java
package com.keytosound.backend.midi;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

/** One drum hit; the voice names match the frontend's digit voices. */
public record DrumHit(
        @NotNull @Pattern(regexp = "kick|snare|hat|openHat|clap|perc|fx") String voice,
        @PositiveOrZero double start,
        @DecimalMin("0.0") @DecimalMax("1.0") double velocity) {}
```

`Score.java`:

```java
package com.keytosound.backend.midi;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * A composition rendered to notes by the browser's engine. Every musical
 * decision is already made; the server's job is the MIDI format. Capped per
 * track so a request cannot ask for an unbounded file.
 */
public record Score(
        @Min(40) @Max(240) int bpm,
        @NotNull @Pattern(regexp = "piano|electricPiano|synthLead|eightBit|bass") String leadInstrument,
        @NotNull @Size(max = 20000) List<@Valid ScoreNote> lead,
        @NotNull @Size(max = 20000) List<@Valid ScoreNote> pad,
        @NotNull @Size(max = 20000) List<@Valid ScoreNote> bass,
        @NotNull @Size(max = 20000) List<@Valid DrumHit> drums) {}
```

`MidiFilenames.java`:

```java
package com.keytosound.backend.midi;

import java.util.Locale;

/** Turns a free-text title into a file name that is safe on every OS. */
public final class MidiFilenames {

    private static final int MAX_LENGTH = 60;

    private MidiFilenames() {}

    public static String slug(String title) {
        String s = title == null ? "" : title.toLowerCase(Locale.ROOT);
        s = s.replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (s.length() > MAX_LENGTH) s = s.substring(0, MAX_LENGTH).replaceAll("-+$", "");
        return s.isEmpty() ? "composition" : s;
    }
}
```

`MidiWriter.java`:

```java
package com.keytosound.backend.midi;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import javax.sound.midi.InvalidMidiDataException;
import javax.sound.midi.MetaMessage;
import javax.sound.midi.MidiEvent;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.Track;
import org.springframework.stereotype.Component;

/**
 * Encodes a score as a Standard MIDI File, type 1: a conductor track (title
 * and tempo) and one track each for lead, pad, bass and drums, so a DAW opens
 * it as a full arrangement. General MIDI programs and drum notes, so it sounds
 * sensible on any synth without setup.
 */
@Component
public class MidiWriter {

    public static final int PPQ = 480;
    public static final int DRUM_CHANNEL = 9;

    private static final int LEAD_CHANNEL = 0;
    private static final int PAD_CHANNEL = 1;
    private static final int BASS_CHANNEL = 2;
    private static final int PAD_PROGRAM = 89; // Pad 2 (warm)
    private static final int BASS_PROGRAM = 38; // Synth Bass 1
    private static final long DRUM_TICKS = PPQ / 4; // a 16th

    private static final Map<String, Integer> LEAD_PROGRAMS = Map.of(
            "piano", 0, // Acoustic Grand Piano
            "electricPiano", 4, // Electric Piano 1
            "synthLead", 81, // Lead 2 (sawtooth)
            "eightBit", 80, // Lead 1 (square)
            "bass", 38); // Synth Bass 1

    private static final Map<String, Integer> DRUM_NOTES = Map.of(
            "kick", 36, "snare", 38, "hat", 42, "openHat", 46, "clap", 39, "perc", 45, "fx", 49);

    public byte[] write(String title, Score score) {
        try {
            Sequence sequence = new Sequence(Sequence.PPQ, PPQ);
            int bpm = score.bpm();

            Track conductor = sequence.createTrack();
            conductor.add(new MidiEvent(trackName(title), 0));
            conductor.add(new MidiEvent(tempo(bpm), 0));

            Track lead = sequence.createTrack();
            lead.add(new MidiEvent(trackName("Lead"), 0));
            lead.add(program(LEAD_CHANNEL, LEAD_PROGRAMS.get(score.leadInstrument())));
            addNotes(lead, LEAD_CHANNEL, score.lead(), bpm);

            Track pad = sequence.createTrack();
            pad.add(new MidiEvent(trackName("Pad"), 0));
            pad.add(program(PAD_CHANNEL, PAD_PROGRAM));
            addNotes(pad, PAD_CHANNEL, score.pad(), bpm);

            Track bass = sequence.createTrack();
            bass.add(new MidiEvent(trackName("Bass"), 0));
            bass.add(program(BASS_CHANNEL, BASS_PROGRAM));
            addNotes(bass, BASS_CHANNEL, score.bass(), bpm);

            Track drums = sequence.createTrack();
            drums.add(new MidiEvent(trackName("Drums"), 0));
            for (DrumHit hit : score.drums()) {
                long on = ticks(hit.start(), bpm);
                addNote(drums, DRUM_CHANNEL, DRUM_NOTES.get(hit.voice()), midiVelocity(hit.velocity()),
                        on, on + DRUM_TICKS);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MidiSystem.write(sequence, 1, out);
            return out.toByteArray();
        } catch (InvalidMidiDataException | IOException e) {
            // Inputs are validated before they get here, so this is a bug, not bad input.
            throw new IllegalStateException("Could not encode MIDI", e);
        }
    }

    static long ticks(double seconds, int bpm) {
        return Math.round(seconds * bpm / 60.0 * PPQ);
    }

    static int midiVelocity(double velocity) {
        return Math.max(1, Math.min(127, (int) Math.round(velocity * 127)));
    }

    private static void addNotes(Track track, int channel, List<ScoreNote> notes, int bpm)
            throws InvalidMidiDataException {
        for (ScoreNote note : notes) {
            long on = ticks(note.start(), bpm);
            // A note must last at least one tick, or some players drop it.
            long off = Math.max(on + 1, ticks(note.start() + note.duration(), bpm));
            addNote(track, channel, note.pitch(), midiVelocity(note.velocity()), on, off);
        }
    }

    private static void addNote(Track track, int channel, int pitch, int velocity, long on, long off)
            throws InvalidMidiDataException {
        track.add(new MidiEvent(new ShortMessage(ShortMessage.NOTE_ON, channel, pitch, velocity), on));
        track.add(new MidiEvent(new ShortMessage(ShortMessage.NOTE_OFF, channel, pitch, 0), off));
    }

    private static MidiEvent program(int channel, int program) throws InvalidMidiDataException {
        return new MidiEvent(new ShortMessage(ShortMessage.PROGRAM_CHANGE, channel, program, 0), 0);
    }

    private static MetaMessage tempo(int bpm) throws InvalidMidiDataException {
        int micros = 60_000_000 / bpm;
        byte[] data = {(byte) (micros >> 16), (byte) (micros >> 8), (byte) micros};
        return new MetaMessage(0x51, data, data.length);
    }

    private static MetaMessage trackName(String name) throws InvalidMidiDataException {
        byte[] data = (name == null ? "" : name).getBytes(StandardCharsets.UTF_8);
        return new MetaMessage(0x03, data, data.length);
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `./mvnw -B test -Dtest='MidiWriterTest,MidiFilenamesTest'`
Expected: 12 tests pass.

- [ ] **Step 5: Checkpoint (user commits)**

```bash
git add backend/src/main/java/com/keytosound/backend/midi backend/src/test/java/com/keytosound/backend/midi
git commit -m "feat: encode scores as multi-track MIDI with javax.sound.midi"
```

---

### Task 4: Export endpoint

**Files:**
- Create: `backend/src/main/java/com/keytosound/backend/midi/MidiExportController.java`
- Modify: `backend/src/main/java/com/keytosound/backend/config/CorsConfig.java`
- Test: `backend/src/test/java/com/keytosound/backend/midi/MidiExportControllerTest.java`

**Interfaces:**
- Consumes: `CompositionService.get(UUID)` → `CompositionDetail` (throws `NotFoundException` → 404 via `ApiExceptionHandler`); `MidiWriter.write(String, Score)`; `MidiFilenames.slug(String)`.
- Produces: `POST /api/compositions/{id}/midi` → 200 `audio/midi` with `Content-Disposition: attachment; filename="<slug>.mid"`; 404; 400.

- [ ] **Step 1: Write the failing test**

```java
package com.keytosound.backend.midi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
// Spring Boot 4 moved this out of boot.test.autoconfigure.web.servlet.
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class MidiExportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String COMPOSITION =
            "{\"title\":\"Rain at Night!\",\"genreId\":\"lofi\",\"seed\":1,"
                    + "\"settings\":{\"genreId\":\"lofi\"},"
                    + "\"keystrokes\":[{\"key\":\"a\",\"timestampMs\":0}]}";

    private static String score(int pitch, String voice) {
        return ("{\"bpm\":75,\"leadInstrument\":\"electricPiano\","
                        + "\"lead\":[{\"pitch\":%d,\"start\":0.4,\"duration\":0.3,\"velocity\":0.7}],"
                        + "\"pad\":[{\"pitch\":57,\"start\":0,\"duration\":3.2,\"velocity\":0.5}],"
                        + "\"bass\":[],"
                        + "\"drums\":[{\"voice\":\"%s\",\"start\":0,\"velocity\":0.8}]}")
                .formatted(pitch, voice);
    }

    private String saveComposition() throws Exception {
        String response = mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(COMPOSITION))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asString();
    }

    @Test
    void returnsAMidiFileNamedAfterTheTitle() throws Exception {
        String id = saveComposition();
        byte[] body = mockMvc.perform(post("/api/compositions/" + id + "/midi")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(score(69, "kick")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "audio/midi"))
                .andExpect(header().string("Content-Disposition",
                        containsString("filename=\"rain-at-night.mid\"")))
                .andReturn()
                .getResponse()
                .getContentAsByteArray();
        // Every Standard MIDI File starts with the "MThd" header chunk.
        assertThat(new String(body, 0, 4, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("MThd");
    }

    @Test
    void returns404ForAnUnknownComposition() throws Exception {
        mockMvc.perform(post("/api/compositions/" + UUID.randomUUID() + "/midi")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(score(69, "kick")))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsAPitchOutsideTheMidiRange() throws Exception {
        String id = saveComposition();
        mockMvc.perform(post("/api/compositions/" + id + "/midi")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(score(200, "kick")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAnUnknownDrumVoice() throws Exception {
        String id = saveComposition();
        mockMvc.perform(post("/api/compositions/" + id + "/midi")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(score(69, "cowbell")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void letsTheBrowserReadTheFileName() throws Exception {
        String id = saveComposition();
        mockMvc.perform(post("/api/compositions/" + id + "/midi")
                        .header("Origin", "http://localhost:5173")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(score(69, "kick")))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Expose-Headers",
                        containsString("Content-Disposition")));
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `./mvnw -B test -Dtest=MidiExportControllerTest`
Expected: FAIL. The endpoint does not exist, so the requests get 404 or 405 instead of 200 or 400.

- [ ] **Step 3: Implement**

`MidiExportController.java`:

```java
package com.keytosound.backend.midi;

import com.keytosound.backend.composition.CompositionService;
import com.keytosound.backend.composition.dto.CompositionDetail;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exports a saved composition as MIDI. The browser sends the rendered score,
 * because the engine that turns keystrokes into notes runs in the browser.
 *
 * <p>Deliberately no {@code produces = "audio/midi"}: it would make the 404
 * and 400 error bodies (JSON) unacceptable and turn them into 406s.
 */
@RestController
@RequestMapping("/api/compositions")
public class MidiExportController {

    private static final MediaType AUDIO_MIDI = MediaType.parseMediaType("audio/midi");

    private final CompositionService compositions;
    private final MidiWriter writer;

    public MidiExportController(CompositionService compositions, MidiWriter writer) {
        this.compositions = compositions;
        this.writer = writer;
    }

    @PostMapping("/{id}/midi")
    public ResponseEntity<byte[]> export(@PathVariable UUID id, @Valid @RequestBody Score score) {
        CompositionDetail composition = compositions.get(id);
        byte[] midi = writer.write(composition.title(), score);
        String filename = MidiFilenames.slug(composition.title()) + ".mid";
        return ResponseEntity.ok()
                .contentType(AUDIO_MIDI)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(midi);
    }
}
```

In `CorsConfig.addCorsMappings`, replace

```java
                .allowedHeaders("Content-Type");
```

with

```java
                .allowedHeaders("Content-Type")
                // Without this the browser hides the header, and the download
                // cannot learn the file name the server chose.
                .exposedHeaders("Content-Disposition");
```

- [ ] **Step 4: Run all backend tests**

Run: `./mvnw -B test`
Expected: all pass (25 from Task 1 + 12 from Task 3 + 5 new = 42).

- [ ] **Step 5: Checkpoint (user commits)**

```bash
git add backend/src/main/java/com/keytosound/backend/midi/MidiExportController.java backend/src/main/java/com/keytosound/backend/config/CorsConfig.java backend/src/test/java/com/keytosound/backend/midi/MidiExportControllerTest.java
git commit -m "feat: add POST /api/compositions/{id}/midi export endpoint"
```

---

### Task 5: Export MIDI button

**Files:**
- Modify: `frontend/src/session/api.ts`
- Create: `frontend/src/ui/download.ts`
- Modify: `frontend/src/ui/CompositionList.tsx`
- Modify: `frontend/src/ui/TypingSurface.tsx`
- Test: `frontend/tests/session/api.test.ts` (append)

**Interfaces:**
- Consumes: `renderScore` and `Score` (Task 2); `loadComposition`, `sessionFromDetail` (existing); the endpoint from Task 4.
- Produces: `exportMidi(id: string, score: Score): Promise<{ blob: Blob; filename: string }>`; `saveBlob(blob: Blob, filename: string): void`; a `CompositionList` prop `onExport: (id: string) => void`.

- [ ] **Step 1: Write the failing tests** (append to `frontend/tests/session/api.test.ts`, and add `exportMidi` to its import list from `'../../src/session/api'`)

```ts
describe('exportMidi', () => {
  const score = {
    bpm: 75,
    leadInstrument: 'electricPiano' as const,
    lead: [{ pitch: 69, start: 0.4, duration: 0.3, velocity: 0.7 }],
    pad: [],
    bass: [],
    drums: [],
  };

  function mockMidi(status: number, disposition: string | null) {
    const blob = new Blob(['MThd'], { type: 'audio/midi' });
    const spy = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => (name === 'Content-Disposition' ? disposition : null) },
      blob: async () => blob,
      json: async () => ({ message: 'nope' }),
    });
    vi.stubGlobal('fetch', spy);
    return { spy, blob };
  }

  it('posts the score to the composition export endpoint', async () => {
    const { spy } = mockMidi(200, 'attachment; filename="rain.mid"');
    await exportMidi('abc', score);
    const [url, init] = spy.mock.calls[0];
    expect(url).toMatch(/\/api\/compositions\/abc\/midi$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(score);
  });

  it('returns the file and the name the server chose', async () => {
    const { blob } = mockMidi(200, 'attachment; filename="rain-at-night.mid"');
    const result = await exportMidi('abc', score);
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe('rain-at-night.mid');
  });

  it('falls back to a default name when the header is missing', async () => {
    mockMidi(200, null);
    expect((await exportMidi('abc', score)).filename).toBe('composition.mid');
  });

  it('throws an ApiError with the status on failure', async () => {
    mockMidi(404, null);
    await expect(exportMidi('abc', score)).rejects.toMatchObject({ status: 404 });
    await expect(exportMidi('abc', score)).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/session/api.test.ts`
Expected: FAIL, `exportMidi is not a function` or a missing-export error.

- [ ] **Step 3: Implement**

Append to `frontend/src/session/api.ts` (and add `import type { Score } from './score';` at the top):

```ts
/**
 * Posts a rendered score and returns the MIDI file the server wrote. Not via
 * request(): the response is binary, and the file name comes from a header.
 */
export async function exportMidi(
  id: string,
  score: Score,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${BASE}/api/compositions/${id}/midi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(score),
  });
  if (!response.ok) throw new ApiError(`Export failed with ${response.status}`, response.status);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return { blob: await response.blob(), filename: match?.[1] ?? 'composition.mid' };
}
```

Create `frontend/src/ui/download.ts`:

```ts
/** Hands a file to the browser's download manager. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revoked on the next tick: revoking synchronously can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

In `frontend/src/ui/CompositionList.tsx`, change the props and add a button between Replay and Delete:

```tsx
interface Props {
  refreshKey: number;
  onPlay: (id: string) => void;
  onExport: (id: string) => void;
}

export function CompositionList({ refreshKey, onPlay, onExport }: Props) {
```

```tsx
            <button onClick={() => onPlay(item.id)} className="rounded border px-2 py-1 text-sm">
              Replay
            </button>
            <button onClick={() => onExport(item.id)} className="rounded border px-2 py-1 text-sm">
              Export MIDI
            </button>
```

In `frontend/src/ui/TypingSurface.tsx`, add the imports

```ts
import { exportMidi, loadComposition, saveComposition } from '../session/api';
import { renderScore } from '../session/score';
import { saveBlob } from './download';
```

(the first line replaces the existing `loadComposition, saveComposition` import). Add this handler next to `replay`:

```ts
  const exportComposition = async (id: string) => {
    setStatus('Exporting MIDI...');
    try {
      const session = sessionFromDetail(await loadComposition(id));
      const { blob, filename } = await exportMidi(id, renderScore(session));
      saveBlob(blob, filename);
      setStatus(`Exported ${filename}.`);
    } catch {
      setStatus('Export failed — is the backend running on :8080?');
    }
  };
```

and pass it to the list:

```tsx
      <CompositionList
        refreshKey={refreshKey}
        onPlay={(id) => void replay(id)}
        onExport={(id) => void exportComposition(id)}
      />
```

- [ ] **Step 4: Run the checks**

Run: `npx vitest run` (all pass), then `npx eslint src tests` (only the known `mapper.ts` `_preset` error), then `npx tsc -b 2>&1 | grep -v TS1294` (no output: TS1294 is the known `erasableSyntaxOnly` issue).

- [ ] **Step 5: Checkpoint (user commits)**

```bash
git add frontend/src/session/api.ts frontend/src/ui/download.ts frontend/src/ui/CompositionList.tsx frontend/src/ui/TypingSurface.tsx frontend/tests/session/api.test.ts
git commit -m "feat: add Export MIDI button to saved compositions"
```

---

### Task 6: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Start both servers.** Use `preview_start` with the `backend` and `frontend` entries in `.claude/launch.json`. The backend log must show profile `dev`.

- [ ] **Step 2: Record and save.** In the browser: Start audio, type `rain falls softly on the harbour, the night is long.`, press `5` once mid-sentence, then save as `Rain at Night`.

- [ ] **Step 3: Export.** Click **Export MIDI** on that row. The status must read `Exported rain-at-night.mid.` and the console must show no errors.

- [ ] **Step 4: Check the file with Java's own parser.** Fetch the same endpoint from the page (JavaScript: load the composition, `renderScore`, `exportMidi`, then read the blob's first 4 bytes). They must be `MThd`, and the file must be larger than 200 bytes.

- [ ] **Step 5: Restart survival.** Stop the backend, start it again, and reload the page. `Rain at Night` must still be listed, and exporting it again must succeed.

- [ ] **Step 6: Report** to the user: what was verified, the file name, the byte size, and anything that did not work.
