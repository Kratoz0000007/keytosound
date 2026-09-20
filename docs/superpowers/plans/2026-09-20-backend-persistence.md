# Backend Persistence and Replay Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the vertical slice — type, save the composition to PostgreSQL through a Spring Boot API, reload it, and replay the identical music, while watching it on a Canvas visualizer.

**Architecture:** Compositions are stored as the *input* that produced them (keystroke stream + genre + seed), never as audio or notes. Because the engine is deterministic, replaying that input reproduces the music note for note. Spring Boot owns persistence; the browser owns all music generation, exactly as in Plan 1.

**Tech Stack:** Java 22, Spring Boot 3 (web, data-jpa, validation), PostgreSQL via Zonky embedded-postgres, Flyway, Maven 3.9.9, React 19, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-typing-to-music-design.md`

## Global Constraints

- **Determinism contract:** `(keystroke stream, settings, seed) -> identical note sequence, always.` This plan's entire value depends on it. The engine uses a seeded PRNG, never `Math.random()`, never reads the clock.
- **Engine purity:** Nothing under `frontend/src/engine/` or `frontend/src/typing/` may import React, Tone.js, or touch `window`, `document`, `performance`, or `Date`. Enforced by `frontend/tests/engine/purity.test.ts`. **New code goes in `frontend/src/session/`, which is not covered by that test but should still avoid clock reads outside the recorder.**
- **NOT in this plan:** authentication, user accounts, MIDI export, analytics, preset serving from the database. All are Plan 3. Do not build them, and do not add a `users` table.
- **Java 22, Node 24.** No Docker available on the target machine; do not write `docker` commands.
- **Git:** every git command needs `-c safe.directory=D:/projects/keytosound`. **Never add `Co-Authored-By` trailers, and never push** — the user handles pushing.
- **CORS:** the dev frontend runs on `http://localhost:5173`; the API on `http://localhost:8080`.

---

## File Structure

```
backend/
  pom.xml
  mvnw, mvnw.cmd, .mvn/
  src/main/java/com/keytosound/backend/
    BackendApplication.java
    config/
      CorsConfig.java                  # allows the Vite dev origin
      EmbeddedPostgresConfig.java      # starts real Postgres, no Docker
    composition/
      Composition.java                 # entity, owns the keystroke list
      Keystroke.java                   # entity, one row per keypress
      CompositionRepository.java
      CompositionService.java          # all transactional logic
      CompositionController.java       # HTTP only, no logic
      dto/
        KeystrokeDto.java
        SaveCompositionRequest.java
        CompositionSummary.java
        CompositionDetail.java
    error/
      NotFoundException.java
      ApiExceptionHandler.java
  src/main/resources/
    application.yml
    db/migration/V1__compositions.sql
  src/test/java/com/keytosound/backend/
    composition/CompositionServiceTest.java
    composition/CompositionControllerTest.java

frontend/src/session/
  types.ts        # RecordedSession and the wire types, shared with the API client
  recorder.ts     # SessionRecorder: captures keystrokes with relative timings
  render.ts       # renderRecorded: session -> MusicalEvent[], headless
  replay.ts       # ReplayPlayer: re-emits keystrokes on their original timing
  api.ts          # fetch client for /api/compositions
frontend/src/ui/
  visualizerLayout.ts  # pure note -> rectangle geometry (testable)
  Visualizer.tsx       # canvas element, draws what the layout returns
  CompositionList.tsx  # save / load / delete UI
frontend/tests/session/
  recorder.test.ts
  render.test.ts
  replay.test.ts
  api.test.ts
frontend/tests/ui/
  visualizerLayout.test.ts
```

**Why this split:** `session/` is the only new frontend area and it depends on `engine/` one way, never the reverse. `visualizerLayout.ts` is separated from `Visualizer.tsx` because canvas drawing cannot be meaningfully unit tested but rectangle geometry can — the pure part holds all the logic worth testing. In the backend, `CompositionController` does HTTP and nothing else; all behaviour lives in `CompositionService` so it can be tested without a web layer.

---

### Task 1: Spring Boot scaffold with a real PostgreSQL that needs no Docker

**Riskiest task in the plan, deliberately first.** If embedded Postgres will not start on this machine, everything downstream is blocked, so it is proven before any feature is built.

**Files:**
- Create: `backend/` (generated), `backend/src/main/java/com/keytosound/backend/config/EmbeddedPostgresConfig.java`, `backend/src/main/resources/application.yml`
- Modify: `.gitignore`
- Test: `backend/src/test/java/com/keytosound/backend/DatabaseSmokeTest.java`

**Interfaces:**
- Consumes: nothing
- Produces: a running Spring Boot app on port 8080 backed by PostgreSQL, and `mvnw test` as the backend test command

- [ ] **Step 1: Generate the project from Spring Initializr**

```bash
cd D:/projects/keytosound
curl -s https://start.spring.io/starter.zip \
  -d type=maven-project \
  -d language=java \
  -d javaVersion=22 \
  -d groupId=com.keytosound \
  -d artifactId=backend \
  -d name=backend \
  -d packageName=com.keytosound.backend \
  -d dependencies=web,data-jpa,postgresql,flyway,validation \
  -o backend.zip
unzip -q backend.zip -d backend && rm backend.zip
ls backend
```

Expected: `pom.xml`, `mvnw`, `mvnw.cmd`, `src/`.

- [ ] **Step 2: Add the embedded PostgreSQL dependency**

In `backend/pom.xml`, inside `<dependencies>`, add:

```xml
<dependency>
    <groupId>io.zonky.test</groupId>
    <artifactId>embedded-postgres</artifactId>
    <version>2.0.7</version>
</dependency>
```

This ships real PostgreSQL binaries and runs them as a child process. No Docker, no installation, no admin rights.

- [ ] **Step 3: Start Postgres as a Spring bean**

Create `backend/src/main/java/com/keytosound/backend/config/EmbeddedPostgresConfig.java`:

```java
package com.keytosound.backend.config;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Runs a real PostgreSQL server as a child process. The target machine has
 * neither Docker nor an installed PostgreSQL, and this needs no admin rights.
 *
 * To use an installed or hosted PostgreSQL instead, set
 * keytosound.embedded-postgres=false and supply spring.datasource.url.
 */
@Configuration
@ConditionalOnProperty(name = "keytosound.embedded-postgres", havingValue = "true", matchIfMissing = true)
public class EmbeddedPostgresConfig {

    @Bean(destroyMethod = "close")
    public EmbeddedPostgres embeddedPostgres() throws IOException {
        return EmbeddedPostgres.builder().start();
    }

    @Bean
    public DataSource dataSource(EmbeddedPostgres postgres) {
        return postgres.getPostgresDatabase();
    }
}
```

- [ ] **Step 4: Configure the application**

Replace `backend/src/main/resources/application.properties` with `backend/src/main/resources/application.yml` (delete the `.properties` file):

```yaml
server:
  port: 8080

spring:
  jpa:
    hibernate:
      ddl-auto: validate      # Flyway owns the schema; Hibernate only checks it
    open-in-view: false
    properties:
      hibernate:
        jdbc:
          batch_size: 100
        order_inserts: true
  flyway:
    enabled: true
    locations: classpath:db/migration

keytosound:
  embedded-postgres: true

logging:
  level:
    org.flywaydb: INFO
```

`ddl-auto: validate` matters: Flyway is the single source of truth for the schema, and Hibernate will fail loudly at startup if an entity and a migration disagree.

- [ ] **Step 5: Ignore build output**

Append to `D:/projects/keytosound/.gitignore`:

```
# Maven
backend/target/
```

- [ ] **Step 6: Write the smoke test that proves Postgres actually starts**

Create `backend/src/test/java/com/keytosound/backend/DatabaseSmokeTest.java`:

```java
package com.keytosound.backend;

import static org.assertj.core.api.Assertions.assertThat;

import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class DatabaseSmokeTest {

    @Autowired
    private DataSource dataSource;

    @Test
    void postgresStartsAndIsReallyPostgres() {
        String version = new JdbcTemplate(dataSource)
                .queryForObject("SELECT version()", String.class);
        assertThat(version).contains("PostgreSQL");
    }

    @Test
    void jsonbIsSupported() {
        // Proves this is genuine PostgreSQL rather than a compatibility mode:
        // settings are stored as jsonb in the schema.
        Integer count = new JdbcTemplate(dataSource)
                .queryForObject("SELECT jsonb_array_length('[1,2,3]'::jsonb)", Integer.class);
        assertThat(count).isEqualTo(3);
    }
}
```

- [ ] **Step 7: Run it**

Run: `cd D:/projects/keytosound/backend && ./mvnw -q test`
Expected: PASS, 2 tests. The first run downloads the PostgreSQL binaries and may take several minutes.

**If this fails**, stop and report rather than working around it. The fallback, in order of preference: (1) install PostgreSQL 16 natively and set `keytosound.embedded-postgres=false` with `spring.datasource.url=jdbc:postgresql://localhost:5432/keytosound`; (2) use a free hosted Postgres and set the same property. Do not silently switch to H2 — the schema uses `jsonb` and the spec requires PostgreSQL.

- [ ] **Step 8: Commit**

```bash
cd D:/projects/keytosound
git -c safe.directory=D:/projects/keytosound add -A
git -c safe.directory=D:/projects/keytosound commit -m "feat: scaffold Spring Boot backend with embedded PostgreSQL"
```

---

### Task 2: Schema and entities

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__compositions.sql`, `backend/src/main/java/com/keytosound/backend/composition/Composition.java`, `.../Keystroke.java`, `.../CompositionRepository.java`
- Test: `backend/src/test/java/com/keytosound/backend/composition/CompositionRepositoryTest.java`

**Interfaces:**
- Consumes: the DataSource from Task 1
- Produces:
  - `Composition` entity: `getId()`, `getTitle()`, `getGenreId()`, `getSeed()`, `getSettings()`, `getCreatedAt()`, `getKeystrokes()`, `addKeystroke(Keystroke)`
  - `Keystroke` entity: `getOrdinal()`, `getKeyValue()`, `getTimestampMs()`
  - `CompositionRepository extends JpaRepository<Composition, UUID>` with `List<Composition> findAllByOrderByCreatedAtDesc()`

- [ ] **Step 1: Write the migration**

Create `backend/src/main/resources/db/migration/V1__compositions.sql`:

```sql
CREATE TABLE compositions (
    id         UUID         PRIMARY KEY,
    -- Nullable until Plan 3 introduces accounts; adding the FK later is then
    -- a pure ALTER with no data migration.
    user_id    UUID,
    title      VARCHAR(120) NOT NULL,
    genre_id   VARCHAR(32)  NOT NULL,
    seed       BIGINT       NOT NULL,
    settings   JSONB        NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- A dedicated sequence rather than BIGSERIAL: Hibernate silently disables JDBC
-- batching for IDENTITY columns, and a composition can carry thousands of
-- keystrokes. allocationSize must match INCREMENT BY in the entity.
CREATE SEQUENCE keystroke_seq START WITH 1 INCREMENT BY 50;

CREATE TABLE keystrokes (
    id             BIGINT           PRIMARY KEY,
    composition_id UUID             NOT NULL REFERENCES compositions (id) ON DELETE CASCADE,
    ordinal        INTEGER          NOT NULL,
    -- "key" is reserved in SQL, hence key_value.
    key_value      VARCHAR(16)      NOT NULL,
    timestamp_ms   DOUBLE PRECISION NOT NULL,
    CONSTRAINT uq_keystroke_order UNIQUE (composition_id, ordinal)
);

CREATE INDEX idx_keystrokes_composition ON keystrokes (composition_id, ordinal);
CREATE INDEX idx_compositions_created ON compositions (created_at DESC);
```

- [ ] **Step 2: Write the Keystroke entity**

Create `backend/src/main/java/com/keytosound/backend/composition/Keystroke.java`:

```java
package com.keytosound.backend.composition;

import jakarta.persistence.*;

@Entity
@Table(name = "keystrokes")
public class Keystroke {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "keystroke_gen")
    @SequenceGenerator(name = "keystroke_gen", sequenceName = "keystroke_seq", allocationSize = 50)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "composition_id", nullable = false)
    private Composition composition;

    @Column(nullable = false)
    private int ordinal;

    @Column(name = "key_value", nullable = false, length = 16)
    private String keyValue;

    @Column(name = "timestamp_ms", nullable = false)
    private double timestampMs;

    protected Keystroke() {
        // required by JPA
    }

    public Keystroke(int ordinal, String keyValue, double timestampMs) {
        this.ordinal = ordinal;
        this.keyValue = keyValue;
        this.timestampMs = timestampMs;
    }

    void setComposition(Composition composition) {
        this.composition = composition;
    }

    public Long getId() {
        return id;
    }

    public int getOrdinal() {
        return ordinal;
    }

    public String getKeyValue() {
        return keyValue;
    }

    public double getTimestampMs() {
        return timestampMs;
    }
}
```

- [ ] **Step 3: Write the Composition entity**

Create `backend/src/main/java/com/keytosound/backend/composition/Composition.java`:

```java
package com.keytosound.backend.composition;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "compositions")
public class Composition {

    @Id
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "genre_id", nullable = false, length = 32)
    private String genreId;

    @Column(nullable = false)
    private long seed;

    /**
     * The engine's settings object, stored verbatim as jsonb. The backend
     * deliberately does not model its shape: the frontend engine types are the
     * source of truth, and mirroring them in Java would guarantee drift.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String settings;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @OneToMany(
            mappedBy = "composition",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY)
    @OrderBy("ordinal ASC")
    private List<Keystroke> keystrokes = new ArrayList<>();

    protected Composition() {
        // required by JPA
    }

    public Composition(String title, String genreId, long seed, String settings) {
        this.id = UUID.randomUUID();
        this.title = title;
        this.genreId = genreId;
        this.seed = seed;
        this.settings = settings;
        this.createdAt = Instant.now();
    }

    public void addKeystroke(Keystroke keystroke) {
        keystroke.setComposition(this);
        this.keystrokes.add(keystroke);
    }

    public UUID getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getGenreId() {
        return genreId;
    }

    public long getSeed() {
        return seed;
    }

    public String getSettings() {
        return settings;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<Keystroke> getKeystrokes() {
        return keystrokes;
    }
}
```

- [ ] **Step 4: Write the repository**

Create `backend/src/main/java/com/keytosound/backend/composition/CompositionRepository.java`:

```java
package com.keytosound.backend.composition;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CompositionRepository extends JpaRepository<Composition, UUID> {

    List<Composition> findAllByOrderByCreatedAtDesc();

    /**
     * Fetches the keystrokes in the same query. Without this, loading a
     * composition for replay issues a second query per composition, and the
     * list endpoint would trigger one per row.
     */
    @Query("SELECT c FROM Composition c LEFT JOIN FETCH c.keystrokes WHERE c.id = :id")
    Optional<Composition> findByIdWithKeystrokes(UUID id);
}
```

- [ ] **Step 5: Write the repository test**

Create `backend/src/test/java/com/keytosound/backend/composition/CompositionRepositoryTest.java`:

```java
package com.keytosound.backend.composition;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class CompositionRepositoryTest {

    @Autowired
    private CompositionRepository repository;

    private Composition sample(String title, int keystrokeCount) {
        Composition composition = new Composition(title, "lofi", 1234L, "{\"genreId\":\"lofi\"}");
        for (int i = 0; i < keystrokeCount; i++) {
            composition.addKeystroke(new Keystroke(i, String.valueOf((char) ('a' + i % 26)), i * 150.0));
        }
        return composition;
    }

    @Test
    void savesAndReloadsAcompositionWithItsKeystrokes() {
        Composition saved = repository.saveAndFlush(sample("first", 5));

        Composition found = repository.findByIdWithKeystrokes(saved.getId()).orElseThrow();

        assertThat(found.getTitle()).isEqualTo("first");
        assertThat(found.getGenreId()).isEqualTo("lofi");
        assertThat(found.getSeed()).isEqualTo(1234L);
        assertThat(found.getKeystrokes()).hasSize(5);
    }

    @Test
    void keepsKeystrokesInOrdinalOrder() {
        Composition saved = repository.saveAndFlush(sample("ordered", 20));

        Composition found = repository.findByIdWithKeystrokes(saved.getId()).orElseThrow();

        for (int i = 0; i < found.getKeystrokes().size(); i++) {
            assertThat(found.getKeystrokes().get(i).getOrdinal()).isEqualTo(i);
        }
    }

    @Test
    void listsNewestFirst() {
        repository.saveAndFlush(sample("older", 1));
        repository.saveAndFlush(sample("newer", 1));

        var titles = repository.findAllByOrderByCreatedAtDesc().stream().map(Composition::getTitle).toList();

        assertThat(titles).containsSubsequence("newer", "older");
    }

    @Test
    void deletingAcompositionRemovesItsKeystrokes() {
        Composition saved = repository.saveAndFlush(sample("doomed", 4));
        UUID id = saved.getId();

        repository.deleteById(id);
        repository.flush();

        assertThat(repository.findById(id)).isEmpty();
    }

    @Test
    void storesSettingsAsJsonb() {
        Composition saved = repository.saveAndFlush(
                new Composition("json", "jazz", 7L, "{\"tempo\":120,\"nested\":{\"ok\":true}}"));

        Composition found = repository.findById(saved.getId()).orElseThrow();

        assertThat(found.getSettings()).contains("\"tempo\":120");
    }
}
```

- [ ] **Step 6: Run the tests**

Run: `cd D:/projects/keytosound/backend && ./mvnw -q test`
Expected: PASS, 7 tests total.

Two failures are plausible here and both are worth recognising rather than guessing at:

- **`SchemaManagementException` at startup** means an entity and `V1__compositions.sql` disagree. Fix the entity, never the migration — migrations are append-only once applied, and editing one that has already run puts Flyway's checksum out of sync.
- **A type mismatch on `settings`** means Hibernate is not mapping the `String` field onto `jsonb`. Confirm both `@JdbcTypeCode(SqlTypes.JSON)` and `columnDefinition = "jsonb"` are present; they work together, and either alone is not enough.

- [ ] **Step 7: Commit**

```bash
cd D:/projects/keytosound
git -c safe.directory=D:/projects/keytosound add -A
git -c safe.directory=D:/projects/keytosound commit -m "feat: add composition and keystroke schema with JPA entities"
```

---

### Task 3: Composition service

**Files:**
- Create: `backend/src/main/java/com/keytosound/backend/composition/CompositionService.java`, `.../dto/KeystrokeDto.java`, `.../dto/SaveCompositionRequest.java`, `.../dto/CompositionSummary.java`, `.../dto/CompositionDetail.java`, `backend/src/main/java/com/keytosound/backend/error/NotFoundException.java`
- Test: `backend/src/test/java/com/keytosound/backend/composition/CompositionServiceTest.java`

**Interfaces:**
- Consumes: `CompositionRepository` from Task 2
- Produces:
  - `record KeystrokeDto(String key, double timestampMs)`
  - `record SaveCompositionRequest(String title, String genreId, long seed, JsonNode settings, List<KeystrokeDto> keystrokes)`
  - `record CompositionSummary(UUID id, String title, String genreId, int keystrokeCount, Instant createdAt)`
  - `record CompositionDetail(UUID id, String title, String genreId, long seed, JsonNode settings, List<KeystrokeDto> keystrokes, Instant createdAt)`
  - `CompositionService` with `CompositionDetail save(SaveCompositionRequest)`, `List<CompositionSummary> list()`, `CompositionDetail get(UUID)`, `void delete(UUID)`

- [ ] **Step 1: Write the DTOs**

Create `backend/src/main/java/com/keytosound/backend/composition/dto/KeystrokeDto.java`:

```java
package com.keytosound.backend.composition.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record KeystrokeDto(
        @NotBlank @Size(max = 16) String key,
        double timestampMs) {}
```

Create `backend/src/main/java/com/keytosound/backend/composition/dto/SaveCompositionRequest.java`:

```java
package com.keytosound.backend.composition.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public record SaveCompositionRequest(
        @NotBlank @Size(max = 120) String title,
        @NotBlank @Size(max = 32) String genreId,
        long seed,
        @NotNull JsonNode settings,
        // A cap is required, not optional: without it one request can insert
        // unbounded rows. 20000 keystrokes is roughly an hour of fast typing.
        @NotEmpty @Size(max = 20000) @Valid List<KeystrokeDto> keystrokes) {}
```

Create `backend/src/main/java/com/keytosound/backend/composition/dto/CompositionSummary.java`:

```java
package com.keytosound.backend.composition.dto;

import java.time.Instant;
import java.util.UUID;

public record CompositionSummary(
        UUID id, String title, String genreId, int keystrokeCount, Instant createdAt) {}
```

Create `backend/src/main/java/com/keytosound/backend/composition/dto/CompositionDetail.java`:

```java
package com.keytosound.backend.composition.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CompositionDetail(
        UUID id,
        String title,
        String genreId,
        long seed,
        JsonNode settings,
        List<KeystrokeDto> keystrokes,
        Instant createdAt) {}
```

- [ ] **Step 2: Write the not-found exception**

Create `backend/src/main/java/com/keytosound/backend/error/NotFoundException.java`:

```java
package com.keytosound.backend.error;

public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
```

- [ ] **Step 3: Write the failing service test**

Create `backend/src/test/java/com/keytosound/backend/composition/CompositionServiceTest.java`:

```java
package com.keytosound.backend.composition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.keytosound.backend.composition.dto.*;
import com.keytosound.backend.error.NotFoundException;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class CompositionServiceTest {

    @Autowired
    private CompositionService service;

    @Autowired
    private ObjectMapper objectMapper;

    private SaveCompositionRequest request(String title, int keystrokes) throws Exception {
        List<KeystrokeDto> keys = IntStream.range(0, keystrokes)
                .mapToObj(i -> new KeystrokeDto(String.valueOf((char) ('a' + i % 26)), i * 137.0))
                .toList();
        return new SaveCompositionRequest(
                title, "lofi", 4242L, objectMapper.readTree("{\"genreId\":\"lofi\"}"), keys);
    }

    @Test
    void savesAndReturnsTheStoredComposition() throws Exception {
        CompositionDetail saved = service.save(request("hello world", 12));

        assertThat(saved.id()).isNotNull();
        assertThat(saved.title()).isEqualTo("hello world");
        assertThat(saved.seed()).isEqualTo(4242L);
        assertThat(saved.keystrokes()).hasSize(12);
    }

    @Test
    void roundTripsTheKeystrokeStreamExactly() throws Exception {
        SaveCompositionRequest req = request("exact", 200);

        CompositionDetail loaded = service.get(service.save(req).id());

        // The determinism contract depends on this being byte-exact: a lost or
        // reordered keystroke produces different music on replay.
        assertThat(loaded.keystrokes()).isEqualTo(req.keystrokes());
    }

    @Test
    void preservesSettingsJsonVerbatim() throws Exception {
        var settings = objectMapper.readTree("{\"genreId\":\"jazz\",\"nested\":{\"a\":[1,2,3]}}");
        var req = new SaveCompositionRequest(
                "json", "jazz", 9L, settings, List.of(new KeystrokeDto("x", 0.0)));

        CompositionDetail loaded = service.get(service.save(req).id());

        assertThat(loaded.settings()).isEqualTo(settings);
    }

    @Test
    void listsSummariesWithKeystrokeCounts() throws Exception {
        service.save(request("counted", 7));

        List<CompositionSummary> all = service.list();

        assertThat(all).isNotEmpty();
        assertThat(all.get(0).keystrokeCount()).isPositive();
    }

    @Test
    void deletesAcomposition() throws Exception {
        UUID id = service.save(request("doomed", 3)).id();

        service.delete(id);

        assertThatThrownBy(() -> service.get(id)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void reportsMissingCompositions() {
        assertThatThrownBy(() -> service.get(UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void rejectsDeletingSomethingThatIsNotThere() {
        assertThatThrownBy(() -> service.delete(UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
    }
}
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `cd D:/projects/keytosound/backend && ./mvnw -q test -Dtest=CompositionServiceTest`
Expected: FAIL — `CompositionService` does not exist.

- [ ] **Step 5: Write the service**

Create `backend/src/main/java/com/keytosound/backend/composition/CompositionService.java`:

```java
package com.keytosound.backend.composition;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.keytosound.backend.composition.dto.*;
import com.keytosound.backend.error.NotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompositionService {

    private final CompositionRepository repository;
    private final ObjectMapper objectMapper;

    public CompositionService(CompositionRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public CompositionDetail save(SaveCompositionRequest request) {
        Composition composition = new Composition(
                request.title(), request.genreId(), request.seed(), writeJson(request.settings()));

        List<KeystrokeDto> keys = request.keystrokes();
        for (int i = 0; i < keys.size(); i++) {
            composition.addKeystroke(new Keystroke(i, keys.get(i).key(), keys.get(i).timestampMs()));
        }

        return toDetail(repository.save(composition));
    }

    @Transactional(readOnly = true)
    public List<CompositionSummary> list() {
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .map(c -> new CompositionSummary(
                        c.getId(), c.getTitle(), c.getGenreId(), c.getKeystrokes().size(), c.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public CompositionDetail get(UUID id) {
        return repository
                .findByIdWithKeystrokes(id)
                .map(this::toDetail)
                .orElseThrow(() -> new NotFoundException("No composition " + id));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new NotFoundException("No composition " + id);
        }
        repository.deleteById(id);
    }

    private CompositionDetail toDetail(Composition composition) {
        List<KeystrokeDto> keys = composition.getKeystrokes().stream()
                .map(k -> new KeystrokeDto(k.getKeyValue(), k.getTimestampMs()))
                .toList();
        return new CompositionDetail(
                composition.getId(),
                composition.getTitle(),
                composition.getGenreId(),
                composition.getSeed(),
                readJson(composition.getSettings()),
                keys,
                composition.getCreatedAt());
    }

    private String writeJson(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("settings is not serialisable JSON", e);
        }
    }

    private JsonNode readJson(String raw) {
        try {
            return objectMapper.readTree(raw);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("stored settings is not valid JSON", e);
        }
    }
}
```

- [ ] **Step 6: Run the tests**

Run: `cd D:/projects/keytosound/backend && ./mvnw -q test`
Expected: PASS, 14 tests total.

- [ ] **Step 7: Commit**

```bash
cd D:/projects/keytosound
git -c safe.directory=D:/projects/keytosound add -A
git -c safe.directory=D:/projects/keytosound commit -m "feat: add composition service with JSON settings round-trip"
```

---

### Task 4: REST API

**Files:**
- Create: `backend/src/main/java/com/keytosound/backend/composition/CompositionController.java`, `backend/src/main/java/com/keytosound/backend/error/ApiExceptionHandler.java`, `backend/src/main/java/com/keytosound/backend/config/CorsConfig.java`
- Test: `backend/src/test/java/com/keytosound/backend/composition/CompositionControllerTest.java`

**Interfaces:**
- Consumes: `CompositionService` from Task 3
- Produces: `POST /api/compositions` (201), `GET /api/compositions` (200), `GET /api/compositions/{id}` (200/404), `DELETE /api/compositions/{id}` (204/404)

- [ ] **Step 1: Write the failing controller test**

Create `backend/src/test/java/com/keytosound/backend/composition/CompositionControllerTest.java`:

```java
package com.keytosound.backend.composition;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class CompositionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String KEYS = """
            [{"key":"t","timestampMs":0},{"key":"h","timestampMs":142.5},{"key":"e","timestampMs":290}]
            """;

    /**
     * Built by formatting rather than by string-replacing a text block: a
     * replace has to match the block's exact indentation, which silently stops
     * matching the moment anyone reformats the file.
     */
    private static String body(String title, String keystrokesJson) {
        return """
                {"title":%s,"genreId":"lofi","seed":20260919,
                 "settings":{"genreId":"lofi"},"keystrokes":%s}
                """
                .formatted("\"" + title + "\"", keystrokesJson);
    }

    private static final String VALID = body("the quick brown fox", KEYS);

    private String saveAndReturnId() throws Exception {
        String body = mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body).get("id").asText();
    }

    @Test
    void savesAcompositionAndReturnsItsLocation() throws Exception {
        mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.keystrokes", hasSize(3)))
                .andExpect(jsonPath("$.keystrokes[1].timestampMs").value(142.5));
    }

    @Test
    void loadsAsavedComposition() throws Exception {
        String id = saveAndReturnId();

        mockMvc.perform(get("/api/compositions/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seed").value(20260919))
                .andExpect(jsonPath("$.settings.genreId").value("lofi"))
                .andExpect(jsonPath("$.keystrokes", hasSize(3)));
    }

    @Test
    void listsSavedCompositions() throws Exception {
        saveAndReturnId();

        mockMvc.perform(get("/api/compositions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].keystrokeCount").value(greaterThan(0)));
    }

    @Test
    void deletesAcomposition() throws Exception {
        String id = saveAndReturnId();

        mockMvc.perform(delete("/api/compositions/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/compositions/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void returns404ForAnUnknownComposition() throws Exception {
        mockMvc.perform(get("/api/compositions/" + UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsAcompositionWithNoKeystrokes() throws Exception {
        mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("empty", "[]")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAblankTitle() throws Exception {
        mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("", KEYS)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAkeystrokeWithNoKey() throws Exception {
        mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("blank key", "[{\"key\":\"\",\"timestampMs\":0}]")))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd D:/projects/keytosound/backend && ./mvnw -q test -Dtest=CompositionControllerTest`
Expected: FAIL — 404 on every route, because no controller exists.

- [ ] **Step 3: Write the controller**

Create `backend/src/main/java/com/keytosound/backend/composition/CompositionController.java`:

```java
package com.keytosound.backend.composition;

import com.keytosound.backend.composition.dto.*;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * HTTP only. All behaviour lives in CompositionService so it can be tested
 * without standing up a web layer.
 */
@RestController
@RequestMapping("/api/compositions")
public class CompositionController {

    private final CompositionService service;

    public CompositionController(CompositionService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<CompositionDetail> save(@Valid @RequestBody SaveCompositionRequest request) {
        CompositionDetail saved = service.save(request);
        return ResponseEntity.created(URI.create("/api/compositions/" + saved.id())).body(saved);
    }

    @GetMapping
    public List<CompositionSummary> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public CompositionDetail get(@PathVariable UUID id) {
        return service.get(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 4: Write the exception handler**

Create `backend/src/main/java/com/keytosound/backend/error/ApiExceptionHandler.java`:

```java
package com.keytosound.backend.error;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "not_found", "message", e.getMessage(), "at", Instant.now().toString()));
    }
}
```

- [ ] **Step 5: Allow the Vite dev origin**

Create `backend/src/main/java/com/keytosound/backend/config/CorsConfig.java`:

```java
package com.keytosound.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * The frontend is served by Vite on 5173 while the API runs on 8080, so the
 * browser treats every call as cross-origin. Scoped to localhost only.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:5173", "http://127.0.0.1:5173")
                .allowedMethods("GET", "POST", "DELETE")
                .allowedHeaders("Content-Type");
    }
}
```

- [ ] **Step 6: Run the tests**

Run: `cd D:/projects/keytosound/backend && ./mvnw -q test`
Expected: PASS, 21 tests total.

- [ ] **Step 7: Verify the API by hand**

Run in one terminal: `cd D:/projects/keytosound/backend && ./mvnw spring-boot:run`

Then in another:

```bash
curl -s -X POST http://localhost:8080/api/compositions \
  -H "Content-Type: application/json" \
  -d '{"title":"manual check","genreId":"lofi","seed":1,"settings":{"genreId":"lofi"},"keystrokes":[{"key":"a","timestampMs":0},{"key":"b","timestampMs":120}]}'
curl -s http://localhost:8080/api/compositions
```

Expected: the first prints a JSON body with an `id`; the second lists it with `keystrokeCount: 2`. Stop the server with Ctrl-C.

- [ ] **Step 8: Commit**

```bash
cd D:/projects/keytosound
git -c safe.directory=D:/projects/keytosound add -A
git -c safe.directory=D:/projects/keytosound commit -m "feat: add composition REST API with validation and CORS"
```

---

### Task 5: Session recorder

**Files:**
- Create: `frontend/src/session/types.ts`, `frontend/src/session/recorder.ts`
- Test: `frontend/tests/session/recorder.test.ts`

**Interfaces:**
- Consumes: `KeyEvent` from `frontend/src/typing/types.ts`
- Produces:
  - `interface RecordedSession { genreId: string; seed: number; keystrokes: KeyEvent[] }`
  - `class SessionRecorder` with `start(genreId: string, seed: number): void`, `record(event: KeyEvent): void`, `snapshot(): RecordedSession`, `clear(): void`, `get count(): number`, `get isRecording(): boolean`

- [ ] **Step 1: Write the session types**

Create `frontend/src/session/types.ts`:

```ts
import type { KeyEvent } from '../typing/types';

/**
 * Everything needed to reproduce a performance. Deliberately the *input* to
 * the engine, not its output: because the engine is deterministic, this plus
 * the seed regenerates the identical note sequence, and it costs kilobytes
 * rather than megabytes of audio.
 */
export interface RecordedSession {
  genreId: string;
  seed: number;
  /** Timestamps are relative to the first keystroke, so replay is portable. */
  keystrokes: KeyEvent[];
}

export interface CompositionSummary {
  id: string;
  title: string;
  genreId: string;
  keystrokeCount: number;
  createdAt: string;
}

export interface CompositionDetail {
  id: string;
  title: string;
  genreId: string;
  seed: number;
  settings: { genreId: string };
  keystrokes: { key: string; timestampMs: number }[];
  createdAt: string;
}
```

- [ ] **Step 2: Write the failing recorder test**

Create `frontend/tests/session/recorder.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SessionRecorder } from '../../src/session/recorder';

describe('SessionRecorder', () => {
  it('records nothing before start is called', () => {
    const recorder = new SessionRecorder();
    recorder.record({ key: 'a', timestamp: 1000 });
    expect(recorder.count).toBe(0);
    expect(recorder.isRecording).toBe(false);
  });

  it('records keystrokes once started', () => {
    const recorder = new SessionRecorder();
    recorder.start('lofi', 42);
    recorder.record({ key: 'a', timestamp: 1000 });
    recorder.record({ key: 'b', timestamp: 1150 });
    expect(recorder.count).toBe(2);
  });

  it('rebases timestamps so the first keystroke is at zero', () => {
    // The browser clock starts wherever it likes; a saved session must not
    // depend on when in the page's life it happened to be recorded.
    const recorder = new SessionRecorder();
    recorder.start('lofi', 42);
    recorder.record({ key: 'a', timestamp: 91234.5 });
    recorder.record({ key: 'b', timestamp: 91384.5 });

    const session = recorder.snapshot();

    expect(session.keystrokes[0].timestamp).toBe(0);
    expect(session.keystrokes[1].timestamp).toBe(150);
  });

  it('preserves the exact gaps between keystrokes', () => {
    const recorder = new SessionRecorder();
    recorder.start('jazz', 7);
    const gaps = [0, 120, 260, 1500, 90];
    let t = 5000;
    for (const gap of gaps) {
      t += gap;
      recorder.record({ key: 'x', timestamp: t });
    }

    const stamps = recorder.snapshot().keystrokes.map((k) => k.timestamp);

    let expected = 0;
    for (let i = 0; i < gaps.length; i++) {
      expected += i === 0 ? 0 : gaps[i];
      expect(stamps[i]).toBeCloseTo(expected, 6);
    }
  });

  it('carries the genre and seed', () => {
    const recorder = new SessionRecorder();
    recorder.start('eightbit', 20260920);
    recorder.record({ key: 'a', timestamp: 0 });

    const session = recorder.snapshot();

    expect(session.genreId).toBe('eightbit');
    expect(session.seed).toBe(20260920);
  });

  it('returns a copy, so later typing cannot mutate an earlier snapshot', () => {
    const recorder = new SessionRecorder();
    recorder.start('lofi', 1);
    recorder.record({ key: 'a', timestamp: 0 });

    const first = recorder.snapshot();
    recorder.record({ key: 'b', timestamp: 100 });

    expect(first.keystrokes).toHaveLength(1);
    expect(recorder.snapshot().keystrokes).toHaveLength(2);
  });

  it('starts over when restarted', () => {
    const recorder = new SessionRecorder();
    recorder.start('lofi', 1);
    recorder.record({ key: 'a', timestamp: 0 });
    recorder.start('jazz', 2);

    expect(recorder.count).toBe(0);
    expect(recorder.snapshot().genreId).toBe('jazz');
  });

  it('clears back to not recording', () => {
    const recorder = new SessionRecorder();
    recorder.start('lofi', 1);
    recorder.record({ key: 'a', timestamp: 0 });
    recorder.clear();

    expect(recorder.count).toBe(0);
    expect(recorder.isRecording).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd D:/projects/keytosound/frontend && npm test -- recorder`
Expected: FAIL — cannot resolve `../../src/session/recorder`.

- [ ] **Step 4: Write the recorder**

Create `frontend/src/session/recorder.ts`:

```ts
import type { KeyEvent } from '../typing/types';
import type { RecordedSession } from './types';

/**
 * Captures the keystroke stream that produced a performance. Holds no musical
 * knowledge whatsoever — it records input, and the engine turns input into
 * music. Timestamps are rebased to the first keystroke so a saved session does
 * not depend on when the page happened to load.
 */
export class SessionRecorder {
  private keystrokes: KeyEvent[] = [];
  private origin: number | null = null;
  private genreId = '';
  private seed = 0;
  private recording = false;

  start(genreId: string, seed: number): void {
    this.keystrokes = [];
    this.origin = null;
    this.genreId = genreId;
    this.seed = seed;
    this.recording = true;
  }

  record(event: KeyEvent): void {
    if (!this.recording) return;
    if (this.origin === null) this.origin = event.timestamp;
    this.keystrokes.push({ key: event.key, timestamp: event.timestamp - this.origin });
  }

  snapshot(): RecordedSession {
    return {
      genreId: this.genreId,
      seed: this.seed,
      // Copied, so a snapshot taken now is not mutated by later typing.
      keystrokes: this.keystrokes.map((k) => ({ ...k })),
    };
  }

  clear(): void {
    this.keystrokes = [];
    this.origin = null;
    this.recording = false;
  }

  get count(): number {
    return this.keystrokes.length;
  }

  get isRecording(): boolean {
    return this.recording;
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `cd D:/projects/keytosound/frontend && npm test -- recorder`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
cd D:/projects/keytosound
git -c safe.directory=D:/projects/keytosound add -A
git -c safe.directory=D:/projects/keytosound commit -m "feat: add session recorder capturing keystroke streams"
```

---

### Task 6: Headless render and the round-trip determinism guarantee

This is the task that proves the whole persistence model works. If a saved and reloaded session does not render identically, storing keystrokes instead of audio is unsound.

**Files:**
- Create: `frontend/src/session/render.ts`
- Test: `frontend/tests/session/render.test.ts`

**Interfaces:**
- Consumes: `TypingAnalyzer`, `MusicEngine`, `GENRES`, `RecordedSession`, `CompositionDetail`
- Produces:
  - `renderRecorded(session: RecordedSession): MusicalEvent[]`
  - `sessionFromDetail(detail: CompositionDetail): RecordedSession`

- [ ] **Step 1: Write the failing render test**

Create `frontend/tests/session/render.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderRecorded, sessionFromDetail } from '../../src/session/render';
import type { CompositionDetail, RecordedSession } from '../../src/session/types';

function sessionOf(text: string, genreId = 'lofi', seed = 20260920): RecordedSession {
  let t = 0;
  return {
    genreId,
    seed,
    keystrokes: [...text].map((key, i) => {
      t += 90 + ((i * 53) % 180);
      return { key, timestamp: t };
    }),
  };
}

const PROSE = 'the quick brown fox jumps over the lazy dog. music from typing!';

describe('renderRecorded', () => {
  it('produces notes from a recorded session', () => {
    const events = renderRecorded(sessionOf(PROSE));
    expect(events.length).toBeGreaterThan(20);
    expect(events[0].pitch).toBeGreaterThan(0);
  });

  it('is deterministic across repeated renders', () => {
    const session = sessionOf(PROSE);
    expect(renderRecorded(session)).toEqual(renderRecorded(session));
  });

  it('produces different music for a different seed', () => {
    const a = renderRecorded(sessionOf(PROSE, 'lofi', 1));
    const b = renderRecorded(sessionOf(PROSE, 'lofi', 2));
    expect(b).not.toEqual(a);
  });

  it('produces different music for a different genre', () => {
    const a = renderRecorded(sessionOf(PROSE, 'lofi'));
    const b = renderRecorded(sessionOf(PROSE, 'classical'));
    expect(b).not.toEqual(a);
  });

  it('falls back to the default genre if the stored one is gone', () => {
    // A composition saved under a genre that a later version removed must
    // still load rather than crashing the page.
    expect(() => renderRecorded(sessionOf(PROSE, 'genre-that-no-longer-exists'))).not.toThrow();
  });
});

describe('save and reload round trip', () => {
  it('renders identically after a JSON round trip', () => {
    // Exactly what save-then-load does to the data: serialise, store, parse.
    const session = sessionOf(PROSE);
    const overTheWire: RecordedSession = JSON.parse(JSON.stringify(session));

    expect(renderRecorded(overTheWire)).toEqual(renderRecorded(session));
  });

  it('renders identically after the API shape round trip', () => {
    const session = sessionOf(PROSE);
    const detail: CompositionDetail = {
      id: '00000000-0000-0000-0000-000000000000',
      title: 'round trip',
      genreId: session.genreId,
      seed: session.seed,
      settings: { genreId: session.genreId },
      keystrokes: session.keystrokes.map((k) => ({ key: k.key, timestampMs: k.timestamp })),
      createdAt: '2026-09-20T00:00:00Z',
    };

    expect(renderRecorded(sessionFromDetail(detail))).toEqual(renderRecorded(session));
  });

  it('survives fractional millisecond timings', () => {
    // performance.now() returns fractions; if the wire format rounded them the
    // analyzer would compute different intervals and the music would drift.
    const session: RecordedSession = {
      genreId: 'lofi',
      seed: 5,
      keystrokes: [
        { key: 'a', timestamp: 0 },
        { key: 'b', timestamp: 123.456 },
        { key: 'c', timestamp: 291.789 },
      ],
    };
    const revived: RecordedSession = JSON.parse(JSON.stringify(session));

    expect(revived.keystrokes[1].timestamp).toBe(123.456);
    expect(renderRecorded(revived)).toEqual(renderRecorded(session));
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd D:/projects/keytosound/frontend && npm test -- render`
Expected: FAIL — cannot resolve `../../src/session/render`.

- [ ] **Step 3: Write the renderer**

Create `frontend/src/session/render.ts`:

```ts
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
 * through two engine versions is how engine changes get compared.
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
```

- [ ] **Step 4: Run the tests**

Run: `cd D:/projects/keytosound/frontend && npm test -- render`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/keytosound
git -c safe.directory=D:/projects/keytosound add -A
git -c safe.directory=D:/projects/keytosound commit -m "feat: render recorded sessions headlessly with round-trip determinism"
```

---

### Task 7: API client

**Files:**
- Create: `frontend/src/session/api.ts`
- Test: `frontend/tests/session/api.test.ts`

**Interfaces:**
- Consumes: `RecordedSession`, `CompositionSummary`, `CompositionDetail` from `session/types.ts`
- Produces:
  - `saveComposition(session: RecordedSession, title: string): Promise<CompositionDetail>`
  - `listCompositions(): Promise<CompositionSummary[]>`
  - `loadComposition(id: string): Promise<CompositionDetail>`
  - `deleteComposition(id: string): Promise<void>`
  - `class ApiError extends Error` with `status: number`

- [ ] **Step 1: Write the failing API client test**

Create `frontend/tests/session/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiError,
  deleteComposition,
  listCompositions,
  loadComposition,
  saveComposition,
} from '../../src/session/api';
import type { RecordedSession } from '../../src/session/types';

const session: RecordedSession = {
  genreId: 'lofi',
  seed: 42,
  keystrokes: [
    { key: 'a', timestamp: 0 },
    { key: 'b', timestamp: 150.5 },
  ],
};

function mockFetch(status: number, body: unknown) {
  const spy = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('saveComposition', () => {
  it('posts the keystroke stream in the wire shape', async () => {
    const spy = mockFetch(201, { id: 'abc' });

    await saveComposition(session, 'my tune');

    const [url, init] = spy.mock.calls[0];
    expect(url).toContain('/api/compositions');
    expect(init.method).toBe('POST');

    const sent = JSON.parse(init.body);
    expect(sent.title).toBe('my tune');
    expect(sent.genreId).toBe('lofi');
    expect(sent.seed).toBe(42);
    // The engine's KeyEvent.timestamp becomes the wire's timestampMs.
    expect(sent.keystrokes).toEqual([
      { key: 'a', timestampMs: 0 },
      { key: 'b', timestampMs: 150.5 },
    ]);
  });

  it('sends settings so the backend can store them as jsonb', async () => {
    const spy = mockFetch(201, { id: 'abc' });
    await saveComposition(session, 'my tune');
    expect(JSON.parse(spy.mock.calls[0][1].body).settings).toEqual({ genreId: 'lofi' });
  });

  it('throws an ApiError carrying the status on failure', async () => {
    mockFetch(400, { message: 'bad' });
    await expect(saveComposition(session, '')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('listCompositions', () => {
  it('returns the parsed list', async () => {
    mockFetch(200, [{ id: 'a', title: 't', genreId: 'lofi', keystrokeCount: 3, createdAt: 'x' }]);
    const list = await listCompositions();
    expect(list).toHaveLength(1);
    expect(list[0].keystrokeCount).toBe(3);
  });
});

describe('loadComposition', () => {
  it('requests the composition by id', async () => {
    const spy = mockFetch(200, { id: 'xyz', keystrokes: [] });
    await loadComposition('xyz');
    expect(spy.mock.calls[0][0]).toContain('/api/compositions/xyz');
  });

  it('throws with status 404 when it is missing', async () => {
    mockFetch(404, { message: 'nope' });
    await expect(loadComposition('gone')).rejects.toMatchObject({ status: 404 });
  });
});

describe('deleteComposition', () => {
  it('issues a DELETE', async () => {
    const spy = mockFetch(204, null);
    await deleteComposition('xyz');
    expect(spy.mock.calls[0][1].method).toBe('DELETE');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd D:/projects/keytosound/frontend && npm test -- api`
Expected: FAIL — cannot resolve `../../src/session/api`.

- [ ] **Step 3: Write the API client**

Create `frontend/src/session/api.ts`:

```ts
import type { CompositionDetail, CompositionSummary, RecordedSession } from './types';

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = await response.json();
      if (body && typeof body.message === 'string') message = body.message;
    } catch {
      // A non-JSON error body is fine; the status is the useful part.
    }
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export function saveComposition(
  session: RecordedSession,
  title: string,
): Promise<CompositionDetail> {
  return request<CompositionDetail>('/api/compositions', {
    method: 'POST',
    body: JSON.stringify({
      title,
      genreId: session.genreId,
      seed: session.seed,
      settings: { genreId: session.genreId },
      keystrokes: session.keystrokes.map((k) => ({ key: k.key, timestampMs: k.timestamp })),
    }),
  });
}

export function listCompositions(): Promise<CompositionSummary[]> {
  return request<CompositionSummary[]>('/api/compositions');
}

export function loadComposition(id: string): Promise<CompositionDetail> {
  return request<CompositionDetail>(`/api/compositions/${id}`);
}

export function deleteComposition(id: string): Promise<void> {
  return request<void>(`/api/compositions/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 4: Run the tests**

Run: `cd D:/projects/keytosound/frontend && npm test -- api`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/keytosound
git -c safe.directory=D:/projects/keytosound add -A
git -c safe.directory=D:/projects/keytosound commit -m "feat: add composition API client"
```

---

### Task 8: Replay player

**Files:**
- Create: `frontend/src/session/replay.ts`
- Test: `frontend/tests/session/replay.test.ts`

**Interfaces:**
- Consumes: `RecordedSession`, `KeyEvent`
- Produces:
  - `interface ReplayClock { setTimeout(fn: () => void, ms: number): number; clearTimeout(handle: number): void }`
  - `const systemClock: ReplayClock`
  - `class ReplayPlayer` with `constructor(clock?: ReplayClock)`, `play(session, onKey, onDone): void`, `stop(): void`, `get isPlaying(): boolean`

- [ ] **Step 1: Write the failing replay test**

Create `frontend/tests/session/replay.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { ReplayPlayer, type ReplayClock } from '../../src/session/replay';
import type { KeyEvent } from '../../src/typing/types';
import type { RecordedSession } from '../../src/session/types';

/** A clock the test drives by hand, so replay is tested without real waiting. */
class FakeClock implements ReplayClock {
  private pending: { at: number; fn: () => void; handle: number }[] = [];
  private nextHandle = 1;
  now = 0;

  setTimeout(fn: () => void, ms: number): number {
    const handle = this.nextHandle++;
    this.pending.push({ at: this.now + ms, fn, handle });
    return handle;
  }

  clearTimeout(handle: number): void {
    this.pending = this.pending.filter((p) => p.handle !== handle);
  }

  advanceTo(time: number): void {
    this.now = time;
    const due = this.pending.filter((p) => p.at <= time).sort((a, b) => a.at - b.at);
    this.pending = this.pending.filter((p) => p.at > time);
    for (const item of due) item.fn();
  }
}

const session: RecordedSession = {
  genreId: 'lofi',
  seed: 1,
  keystrokes: [
    { key: 'a', timestamp: 0 },
    { key: 'b', timestamp: 100 },
    { key: 'c', timestamp: 350 },
  ],
};

describe('ReplayPlayer', () => {
  it('emits each keystroke at its recorded offset', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const seen: { key: string; at: number }[] = [];

    player.play(session, (e: KeyEvent) => seen.push({ key: e.key, at: clock.now }), () => {});

    clock.advanceTo(0);
    expect(seen.map((s) => s.key)).toEqual(['a']);
    clock.advanceTo(100);
    expect(seen.map((s) => s.key)).toEqual(['a', 'b']);
    clock.advanceTo(350);
    expect(seen.map((s) => s.key)).toEqual(['a', 'b', 'c']);
  });

  it('preserves the original gaps rather than firing everything at once', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const times: number[] = [];

    player.play(session, () => times.push(clock.now), () => {});
    clock.advanceTo(400);

    expect(times).toEqual([0, 100, 350]);
  });

  it('signals completion after the last keystroke', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const done = vi.fn();

    player.play(session, () => {}, done);
    clock.advanceTo(349);
    expect(done).not.toHaveBeenCalled();
    clock.advanceTo(350);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('reports whether it is playing', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);

    expect(player.isPlaying).toBe(false);
    player.play(session, () => {}, () => {});
    expect(player.isPlaying).toBe(true);
    clock.advanceTo(350);
    expect(player.isPlaying).toBe(false);
  });

  it('stops emitting when stopped part way', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const seen: string[] = [];

    player.play(session, (e) => seen.push(e.key), () => {});
    clock.advanceTo(100);
    player.stop();
    clock.advanceTo(1000);

    expect(seen).toEqual(['a', 'b']);
    expect(player.isPlaying).toBe(false);
  });

  it('cancels a previous replay when a new one starts', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const seen: string[] = [];

    player.play(session, (e) => seen.push(e.key), () => {});
    clock.advanceTo(0);
    player.play(
      { genreId: 'lofi', seed: 1, keystrokes: [{ key: 'z', timestamp: 0 }] },
      (e) => seen.push(e.key),
      () => {},
    );
    clock.advanceTo(1000);

    expect(seen).toEqual(['a', 'z']);
  });

  it('completes immediately for an empty session', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const done = vi.fn();

    player.play({ genreId: 'lofi', seed: 1, keystrokes: [] }, () => {}, done);

    expect(done).toHaveBeenCalledTimes(1);
    expect(player.isPlaying).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd D:/projects/keytosound/frontend && npm test -- replay`
Expected: FAIL — cannot resolve `../../src/session/replay`.

- [ ] **Step 3: Write the replay player**

Create `frontend/src/session/replay.ts`:

```ts
import type { KeyEvent } from '../typing/types';
import type { RecordedSession } from './types';

/**
 * Injected so replay can be tested with a clock the test drives by hand
 * instead of waiting in real time.
 */
export interface ReplayClock {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(handle: number): void;
}

export const systemClock: ReplayClock = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle),
};

/**
 * Re-emits a recorded keystroke stream on its original timing. It feeds the
 * same pipeline live typing does, so replay is not a special case in the
 * engine — it is the ordinary path with a different source of keystrokes.
 */
export class ReplayPlayer {
  private handles: number[] = [];
  private playing = false;

  constructor(private readonly clock: ReplayClock = systemClock) {}

  play(
    session: RecordedSession,
    onKey: (event: KeyEvent) => void,
    onDone: () => void,
  ): void {
    this.stop();

    if (session.keystrokes.length === 0) {
      onDone();
      return;
    }

    this.playing = true;
    const last = session.keystrokes.length - 1;

    session.keystrokes.forEach((keystroke, index) => {
      const handle = this.clock.setTimeout(() => {
        if (!this.playing) return;
        onKey({ key: keystroke.key, timestamp: keystroke.timestamp });
        if (index === last) {
          this.playing = false;
          this.handles = [];
          onDone();
        }
      }, keystroke.timestamp);
      this.handles.push(handle);
    });
  }

  stop(): void {
    for (const handle of this.handles) this.clock.clearTimeout(handle);
    this.handles = [];
    this.playing = false;
  }

  get isPlaying(): boolean {
    return this.playing;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `cd D:/projects/keytosound/frontend && npm test -- replay`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/keytosound
git -c safe.directory=D:/projects/keytosound add -A
git -c safe.directory=D:/projects/keytosound commit -m "feat: add replay player preserving original keystroke timing"
```

---

### Task 9: Visualizer

**Files:**
- Create: `frontend/src/ui/visualizerLayout.ts`, `frontend/src/ui/Visualizer.tsx`
- Test: `frontend/tests/ui/visualizerLayout.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  - `interface VisualNote { pitch: number; at: number; durationBeats: number; velocity: number }`
  - `interface LayoutOptions { width: number; height: number; windowMs: number; now: number; minPitch: number; maxPitch: number }`
  - `interface NoteBar { x: number; y: number; w: number; h: number; alpha: number }`
  - `layoutNotes(notes: VisualNote[], opts: LayoutOptions): NoteBar[]`
  - `<Visualizer notes={VisualNote[]} />`

- [ ] **Step 1: Write the failing layout test**

Create `frontend/tests/ui/visualizerLayout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { layoutNotes, type LayoutOptions, type VisualNote } from '../../src/ui/visualizerLayout';

const opts: LayoutOptions = {
  width: 800,
  height: 200,
  windowMs: 4000,
  now: 10000,
  minPitch: 48,
  maxPitch: 84,
};

const note = (o: Partial<VisualNote> = {}): VisualNote => ({
  pitch: 66,
  at: 10000,
  durationBeats: 1,
  velocity: 0.8,
  ...o,
});

describe('layoutNotes', () => {
  it('places the newest note at the right edge', () => {
    const [bar] = layoutNotes([note({ at: 10000 })], opts);
    expect(bar.x + bar.w).toBeCloseTo(800, 0);
  });

  it('places an older note further left', () => {
    const [recent] = layoutNotes([note({ at: 10000 })], opts);
    const [older] = layoutNotes([note({ at: 8000 })], opts);
    expect(older.x).toBeLessThan(recent.x);
  });

  it('drops notes older than the window', () => {
    expect(layoutNotes([note({ at: 5000 })], opts)).toHaveLength(0);
  });

  it('puts higher pitches higher on the canvas', () => {
    const [high] = layoutNotes([note({ pitch: 80 })], opts);
    const [low] = layoutNotes([note({ pitch: 52 })], opts);
    expect(high.y).toBeLessThan(low.y);
  });

  it('keeps every bar inside the canvas', () => {
    const notes = [48, 60, 72, 84].map((pitch) => note({ pitch }));
    for (const bar of layoutNotes(notes, opts)) {
      expect(bar.y).toBeGreaterThanOrEqual(0);
      expect(bar.y + bar.h).toBeLessThanOrEqual(200);
    }
  });

  it('clamps pitches outside the declared range instead of drawing off-canvas', () => {
    const [above] = layoutNotes([note({ pitch: 120 })], opts);
    expect(above.y).toBeGreaterThanOrEqual(0);
    const [below] = layoutNotes([note({ pitch: 12 })], opts);
    expect(below.y + below.h).toBeLessThanOrEqual(200);
  });

  it('makes louder notes more opaque', () => {
    const [loud] = layoutNotes([note({ velocity: 1 })], opts);
    const [quiet] = layoutNotes([note({ velocity: 0.2 })], opts);
    expect(loud.alpha).toBeGreaterThan(quiet.alpha);
  });

  it('makes longer notes wider', () => {
    const [long] = layoutNotes([note({ durationBeats: 2 })], opts);
    const [short] = layoutNotes([note({ durationBeats: 0.25 })], opts);
    expect(long.w).toBeGreaterThan(short.w);
  });

  it('gives every bar a visible width', () => {
    const [tiny] = layoutNotes([note({ durationBeats: 0.01 })], opts);
    expect(tiny.w).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd D:/projects/keytosound/frontend && npm test -- visualizerLayout`
Expected: FAIL — cannot resolve `../../src/ui/visualizerLayout`.

- [ ] **Step 3: Write the layout function**

Create `frontend/src/ui/visualizerLayout.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `cd D:/projects/keytosound/frontend && npm test -- visualizerLayout`
Expected: PASS, 9 tests.

- [ ] **Step 5: Write the canvas component**

Create `frontend/src/ui/Visualizer.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { layoutNotes, type VisualNote } from './visualizerLayout';

const WIDTH = 760;
const HEIGHT = 200;
const WINDOW_MS = 6000;
const MIN_PITCH = 48;
const MAX_PITCH = 88;

/**
 * Draws the note stream scrolling right to left. Holds no state of its own:
 * it renders whatever notes it is given, on an animation frame, so audio and
 * picture are driven by the same events.
 */
export function Visualizer({ notes }: { notes: VisualNote[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#0b0b0f';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const bars = layoutNotes(notesRef.current, {
        width: WIDTH,
        height: HEIGHT,
        windowMs: WINDOW_MS,
        now: performance.now(),
        minPitch: MIN_PITCH,
        maxPitch: MAX_PITCH,
      });

      for (const bar of bars) {
        ctx.globalAlpha = bar.alpha;
        ctx.fillStyle = '#7dd3fc';
        ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      }
      ctx.globalAlpha = 1;

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className="w-full rounded border border-neutral-200"
    />
  );
}
```

- [ ] **Step 6: Run the whole suite**

Run: `cd D:/projects/keytosound/frontend && npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
cd D:/projects/keytosound
git -c safe.directory=D:/projects/keytosound add -A
git -c safe.directory=D:/projects/keytosound commit -m "feat: add scrolling canvas visualizer"
```

---

### Task 10: Wire save, load, replay and the visualizer into the app

**Files:**
- Create: `frontend/src/ui/CompositionList.tsx`
- Modify: `frontend/src/ui/TypingSurface.tsx`

**Interfaces:**
- Consumes: everything from Tasks 5-9
- Produces: the complete vertical slice

- [ ] **Step 1: Write the composition list component**

Create `frontend/src/ui/CompositionList.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { deleteComposition, listCompositions } from '../session/api';
import type { CompositionSummary } from '../session/types';

interface Props {
  refreshKey: number;
  onPlay: (id: string) => void;
}

export function CompositionList({ refreshKey, onPlay }: Props) {
  const [items, setItems] = useState<CompositionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listCompositions());
      setError(null);
    } catch {
      // The backend not running is the common case in development, and it
      // must not break the part of the app that makes music.
      setError('Backend unavailable — typing and audio still work.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const remove = async (id: string) => {
    await deleteComposition(id);
    void refresh();
  };

  if (error) return <p className="text-sm text-neutral-500">{error}</p>;
  if (items.length === 0) return <p className="text-sm text-neutral-500">No saved compositions yet.</p>;

  return (
    <ul className="divide-y divide-neutral-200 rounded border border-neutral-200">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="truncate">
            <span className="font-medium">{item.title}</span>{' '}
            <span className="text-xs text-neutral-500">
              {item.genreId} · {item.keystrokeCount} keys
            </span>
          </span>
          <span className="flex shrink-0 gap-2">
            <button onClick={() => onPlay(item.id)} className="rounded border px-2 py-1 text-sm">
              Replay
            </button>
            <button onClick={() => void remove(item.id)} className="rounded border px-2 py-1 text-sm">
              Delete
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Wire recording, saving and replay into the typing surface**

In `frontend/src/ui/TypingSurface.tsx`, add these imports beside the existing ones:

```tsx
import { CompositionList } from './CompositionList';
import { Visualizer } from './Visualizer';
import type { VisualNote } from './visualizerLayout';
import { SessionRecorder } from '../session/recorder';
import { ReplayPlayer } from '../session/replay';
import { loadComposition, saveComposition } from '../session/api';
import { sessionFromDetail } from '../session/render';
```

Inside the `TypingSurface` component, beside the existing refs, add:

```tsx
  const recorderRef = useRef(new SessionRecorder());
  const playerRef = useRef(new ReplayPlayer());
  const [notes, setNotes] = useState<VisualNote[]>([]);
  const [title, setTitle] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
```

Replace the body of `handleKey` with this version, which records the keystroke and feeds the visualizer:

```tsx
  const handleKey = useCallback((key: KeyEvent) => {
    recorderRef.current.record(key);
    const features = analyzerRef.current.process(key);
    const event = musicRef.current.step(features);
    const state = musicRef.current.getState();
    if (!event) {
      setReadout((r) => ({ ...r, wpm: features.speed, chordIndex: state.chordIndex }));
      return;
    }
    audioRef.current.play(event);
    setNotes((current) => [
      ...current.slice(-200),
      {
        pitch: event.pitch,
        at: performance.now(),
        durationBeats: event.durationBeats,
        velocity: event.velocity,
      },
    ]);
    setReadout((r) => ({
      current: event.pitch,
      previous: r.current,
      wpm: features.speed,
      chordIndex: state.chordIndex,
    }));
  }, []);
```

Replace `start` and `changeGenre`, and add the save and replay handlers:

```tsx
  const start = async () => {
    await audioRef.current.start();
    recorderRef.current.start(genreId, SEED);
    setRunning(true);
    areaRef.current?.focus();
  };

  const changeGenre = (id: string) => {
    setGenreId(id);
    musicRef.current = new MusicEngine(GENRES[id], SEED);
    analyzerRef.current.reset();
    audioRef.current.setGenre(GENRES[id]);
    recorderRef.current.start(id, SEED);
    setReadout(EMPTY_READOUT);
    setNotes([]);
  };

  const save = async () => {
    const session = recorderRef.current.snapshot();
    if (session.keystrokes.length === 0) {
      setStatus('Type something first.');
      return;
    }
    try {
      await saveComposition(session, title.trim() || 'Untitled');
      setStatus(`Saved ${session.keystrokes.length} keystrokes.`);
      setTitle('');
      setRefreshKey((k) => k + 1);
    } catch {
      setStatus('Save failed — is the backend running on :8080?');
    }
  };

  const replay = async (id: string) => {
    const session = sessionFromDetail(await loadComposition(id));
    // Reset to the saved genre and seed, or replay produces different music.
    setGenreId(session.genreId);
    musicRef.current = new MusicEngine(GENRES[session.genreId] ?? GENRES[DEFAULT_GENRE_ID], session.seed);
    analyzerRef.current.reset();
    audioRef.current.setGenre(GENRES[session.genreId] ?? GENRES[DEFAULT_GENRE_ID]);
    setNotes([]);
    setStatus('Replaying...');
    playerRef.current.play(
      session,
      (event) => {
        const features = analyzerRef.current.process(event);
        const musical = musicRef.current.step(features);
        if (!musical) return;
        audioRef.current.play(musical);
        setNotes((current) => [
          ...current.slice(-200),
          {
            pitch: musical.pitch,
            at: performance.now(),
            durationBeats: musical.durationBeats,
            velocity: musical.velocity,
          },
        ]);
        setReadout((r) => ({ ...r, current: musical.pitch, previous: r.current }));
      },
      () => setStatus('Replay finished.'),
    );
  };
```

Add `DEFAULT_GENRE_ID` to the existing presets import, and add this JSX below the existing `<textarea>`:

```tsx
      <Visualizer notes={notes} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Composition title"
          className="flex-1 rounded border border-neutral-300 px-3 py-2"
        />
        <button onClick={() => void save()} className="rounded bg-neutral-900 px-4 py-2 text-white">
          Save
        </button>
      </div>

      {status && <p className="text-sm text-neutral-500">{status}</p>}

      <CompositionList refreshKey={refreshKey} onPlay={(id) => void replay(id)} />
```

- [ ] **Step 3: Type-check and run the suite**

Run: `cd D:/projects/keytosound/frontend && npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 4: Verify the whole slice by hand**

Start the backend: `cd D:/projects/keytosound/backend && ./mvnw spring-boot:run`
Start the frontend: `cd D:/projects/keytosound/frontend && npm run dev`

Then, in the browser:

1. Click **Start audio** and type a sentence. Notes appear in the visualizer and scroll left.
2. Enter a title and click **Save**. The status reports the keystroke count.
3. The composition appears in the list below with its genre and keystroke count.
4. Click **Replay**. The same melody plays back with the same rhythm you typed it in.
5. Click **Delete**. The row disappears and stays gone after a page reload.
6. Stop the backend and reload. Typing and audio still work; the list shows "Backend unavailable".

Step 4 is the one that matters: if replay sounds different from what you originally typed, the determinism contract is broken and the cause is almost certainly that genre or seed was not restored before replay began.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/keytosound
git -c safe.directory=D:/projects/keytosound add -A
git -c safe.directory=D:/projects/keytosound commit -m "feat: wire save, load, replay and visualizer into the app"
```

---

## What this plan deliberately does not build

Carried to Plan 3, listed so nobody implements them early:

- Authentication, user accounts, JWT, the `users` table and the FK on `compositions.user_id`
- MIDI export via `javax.sound.midi`
- Session analytics (WPM distributions, rhythm histograms)
- Serving genre presets from the database — the frontend `GENRES` constant remains the source of truth for now
- Deployment of either service

## Self-review notes

**Spec coverage.** Spec section 4.12 (SessionRecorder) is Task 5; section 6's composition persistence is Tasks 2-4; the data model and API surface in section 6 are implemented minus the auth, MIDI and analytics rows, which are explicitly Plan 3; section 4.11 (Visualizer) is Task 9; section 7's round-trip determinism requirement is Task 6. Section 6's "musical model serving" is the one backend responsibility deferred rather than built — noted above, and called out to the user, because moving `GENRES` into Postgres would destabilise a working engine for no gain in this slice.

**Deviation from the spec's data model.** The spec writes the keystroke column as `key`; the migration uses `key_value` because `key` is a reserved word in SQL. The spec also does not mention `keystroke_seq`; it exists because Hibernate silently disables JDBC batching for `IDENTITY` columns, and a composition can carry thousands of rows.

**Type consistency.** `KeyEvent.timestamp` (frontend, relative ms) maps to `timestampMs` on the wire and `timestamp_ms` in the database; the conversion happens in exactly two places, `saveComposition` in Task 7 and `sessionFromDetail` in Task 6, and Task 6 tests that the round trip is exact. `CompositionDetail` and `CompositionSummary` are declared identically in `frontend/src/session/types.ts` and as Java records in Task 3.

**Known risk.** Task 1 depends on Zonky embedded-postgres downloading PostgreSQL binaries on first run. If that fails, the plan stops at Task 1 with two documented fallbacks rather than failing deep in the build.
