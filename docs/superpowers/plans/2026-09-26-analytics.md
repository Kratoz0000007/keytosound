# Session Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Stats view for each saved composition, computed in Java from its stored keystrokes: rhythm, speed per sentence, pauses and key usage.

**Architecture:** A plain Java `SessionAnalyzer` (no Spring, no JPA) turns the ordered `List<KeystrokeDto>` into an `Analytics` record. `AnalyticsController` serves it at `GET /api/compositions/{id}/analytics` through the existing owner-scoped `CompositionService.get`. The frontend fetches it with `getAnalytics` and shows it in a deliberately temporary `AnalyticsPanel` below the library.

**Tech Stack:** Spring Boot 4.1.1, Java 22, JUnit 5 + AssertJ, MockMvc; React 19, TypeScript, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-26-analytics-design.md`

## Global Constraints

- Pause is a gap **> 400 ms**; a word is **5** keys; WPM capped at **300**; sentences end at `.` `!` `?` `Enter` (all from `frontend/src/typing/analyzer.ts`).
- Held key: same key as the previous keystroke seen, **< 50 ms** after it. Dropped and counted.
- Digits `0`–`9` are drum keys: excluded from rhythm, speed, pauses and text; counted as `drums`.
- Nothing is stored: analytics are computed on every request. No migration.
- Another user's composition is **404**; no session is **401**.
- The UI is a placeholder: white background, neutral greys, div bars, **no chart library, no new dependency**.
- Commits: very short messages, no `feat:`-style prefix, **no `Co-Authored-By` trailer**. Do not push. Every git command needs `-c safe.directory=D:/projects/keytosound`.
- Windows: run git and `mvnw` through Git Bash. New files use LF.

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/main/java/com/keytosound/backend/analytics/Analytics.java` (create) | The response shape: nested records only. |
| `backend/src/main/java/com/keytosound/backend/analytics/SessionAnalyzer.java` (create) | All analysis rules. Pure function of the keystroke list. |
| `backend/src/main/java/com/keytosound/backend/analytics/AnalyticsController.java` (create) | The endpoint. Loads, delegates, returns. |
| `backend/src/test/java/com/keytosound/backend/analytics/SessionAnalyzerTest.java` (create) | Unit tests, no Spring. |
| `backend/src/test/java/com/keytosound/backend/analytics/AnalyticsControllerTest.java` (create) | 200 / 404 / 401 over MockMvc. |
| `frontend/src/session/types.ts` (modify) | `CompositionAnalytics` types. |
| `frontend/src/session/api.ts` (modify) | `getAnalytics(id)`. |
| `frontend/src/ui/analyticsView.ts` (create) | Pure display helpers. |
| `frontend/src/ui/AnalyticsPanel.tsx` (create) | The placeholder panel. |
| `frontend/src/ui/CompositionList.tsx` (modify) | Stats button. |
| `frontend/src/ui/TypingSurface.tsx` (modify) | Which composition's stats are open. |
| `frontend/tests/session/api.test.ts` (modify), `frontend/tests/ui/analyticsView.test.ts` (create) | Frontend tests. |

---

### Task 1: The analyzer

**Files:**
- Create: `backend/src/main/java/com/keytosound/backend/analytics/Analytics.java`
- Create: `backend/src/main/java/com/keytosound/backend/analytics/SessionAnalyzer.java`
- Test: `backend/src/test/java/com/keytosound/backend/analytics/SessionAnalyzerTest.java`

**Interfaces:**
- Consumes: `com.keytosound.backend.composition.dto.KeystrokeDto(String key, double timestampMs)`.
- Produces: `public static Analytics SessionAnalyzer.analyze(List<KeystrokeDto>)`; record `Analytics(Summary summary, Rhythm rhythm, List<Sentence> sentences, Pauses pauses, Keys keys)` with nested records `Summary(int keyCount, double durationMs, double averageWpm, Double peakWpm, int heldKeysIgnored)`, `Band(int fromMs, int toMs, int count)`, `Rhythm(List<Band> bands, Double medianGapMs, Double steadiness)`, `Sentence(String label, int keyCount, Double wpm)`, `Segment(String text, Double pauseAfterMs)`, `Pauses(int count, double totalMs, double longestMs, Map<String,Integer> byKind, List<Segment> segments)`, `KeyCount(String key, int count)`, `Keys(List<KeyCount> top, int backspaces, double correctionRate, Map<String,Integer> punctuation, int enters, int drums)`.

- [ ] **Step 1: Write the failing tests**

`backend/src/test/java/com/keytosound/backend/analytics/SessionAnalyzerTest.java`:

```java
package com.keytosound.backend.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.keytosound.backend.composition.dto.KeystrokeDto;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class SessionAnalyzerTest {

    private static KeystrokeDto k(String key, double timestampMs) {
        return new KeystrokeDto(key, timestampMs);
    }

    /** One keystroke per character, step ms apart, starting at start. */
    private static List<KeystrokeDto> typed(String text, double start, double step) {
        List<KeystrokeDto> out = new ArrayList<>();
        for (int i = 0; i < text.length(); i++) {
            out.add(k(String.valueOf(text.charAt(i)), start + i * step));
        }
        return out;
    }

    @SafeVarargs
    private static List<KeystrokeDto> concat(List<KeystrokeDto>... parts) {
        List<KeystrokeDto> out = new ArrayList<>();
        for (List<KeystrokeDto> part : parts) out.addAll(part);
        return out;
    }

    @Test
    void allDigitsLeavesNothingToAnalyse() {
        Analytics a = SessionAnalyzer.analyze(List.of(k("1", 0), k("2", 100)));

        assertThat(a.summary().keyCount()).isZero();
        assertThat(a.summary().durationMs()).isZero();
        assertThat(a.summary().averageWpm()).isZero();
        assertThat(a.summary().peakWpm()).isNull();
        assertThat(a.rhythm().bands()).hasSize(6).allMatch(b -> b.count() == 0);
        assertThat(a.rhythm().medianGapMs()).isNull();
        assertThat(a.rhythm().steadiness()).isNull();
        assertThat(a.sentences()).isEmpty();
        assertThat(a.pauses().count()).isZero();
        assertThat(a.pauses().longestMs()).isZero();
        assertThat(a.pauses().segments()).isEmpty();
        assertThat(a.pauses().byKind()).containsOnlyKeys("word", "comma", "sentence", "hesitation");
        assertThat(a.keys().punctuation()).containsOnlyKeys(".", ",", "!", "?");
        assertThat(a.keys().drums()).isEqualTo(2);
        assertThat(a.keys().correctionRate()).isZero();
    }

    @Test
    void aSingleKeyHasNoSpeed() {
        Analytics a = SessionAnalyzer.analyze(List.of(k("a", 0)));

        assertThat(a.summary().keyCount()).isEqualTo(1);
        assertThat(a.summary().averageWpm()).isZero();
        assertThat(a.sentences()).singleElement().satisfies(s -> {
            assertThat(s.label()).isEqualTo("a");
            assertThat(s.wpm()).isNull();
        });
        assertThat(a.pauses().segments()).containsExactly(new Analytics.Segment("a", null));
    }

    @Test
    void dropsAWholeHeldKeyChainAndCountsIt() {
        Analytics a = SessionAnalyzer.analyze(List.of(k("a", 0), k("a", 30), k("a", 60), k("a", 90)));

        assertThat(a.summary().keyCount()).isEqualTo(1);
        assertThat(a.summary().heldKeysIgnored()).isEqualTo(3);
    }

    @Test
    void keepsARealDoubleLetter() {
        Analytics a = SessionAnalyzer.analyze(List.of(k("l", 0), k("l", 50)));

        assertThat(a.summary().keyCount()).isEqualTo(2);
        assertThat(a.summary().heldKeysIgnored()).isZero();
    }

    @Test
    void digitsAreCountedButNeitherSplitAGapNorAppearInTheText() {
        Analytics a = SessionAnalyzer.analyze(List.of(k("a", 0), k("5", 100), k("b", 200)));

        assertThat(a.summary().keyCount()).isEqualTo(2);
        assertThat(a.keys().drums()).isEqualTo(1);
        assertThat(a.rhythm().medianGapMs()).isEqualTo(200.0);
        assertThat(a.pauses().segments()).containsExactly(new Analytics.Segment("ab", null));
    }

    @Test
    void bandEdgesAreHalfOpenExceptTheLastWhichKeeps400() {
        // gaps: 49, 50, 399, 400, 401 (the last is a pause)
        Analytics a = SessionAnalyzer.analyze(List.of(
                k("a", 0), k("b", 49), k("c", 99), k("d", 498), k("e", 898), k("f", 1299)));

        assertThat(a.rhythm().bands()).extracting(Analytics.Band::count).containsExactly(1, 1, 0, 0, 0, 2);
        assertThat(a.rhythm().bands()).extracting(Analytics.Band::fromMs).containsExactly(0, 50, 100, 150, 200, 300);
        assertThat(a.rhythm().bands()).extracting(Analytics.Band::toMs).containsExactly(50, 100, 150, 200, 300, 400);
        assertThat(a.pauses().count()).isEqualTo(1);
    }

    @Test
    void medianOfAnOddCountIsTheMiddleGap() {
        // gaps: 100, 200, 300
        Analytics a = SessionAnalyzer.analyze(List.of(k("a", 0), k("b", 100), k("c", 300), k("d", 600)));

        assertThat(a.rhythm().medianGapMs()).isEqualTo(200.0);
    }

    @Test
    void medianOfAnEvenCountIsTheMeanOfTheMiddleTwo() {
        // gaps: 100, 200, 300, 350
        Analytics a = SessionAnalyzer.analyze(
                List.of(k("a", 0), k("b", 100), k("c", 300), k("d", 600), k("e", 950)));

        assertThat(a.rhythm().medianGapMs()).isEqualTo(250.0);
    }

    @Test
    void steadinessIsTheShareOfGapsNearTheMedian() {
        // gaps: 100, 100, 100, 200 -> median 100, three within 25%
        Analytics a = SessionAnalyzer.analyze(
                List.of(k("a", 0), k("b", 100), k("c", 200), k("d", 300), k("e", 500)));

        assertThat(a.rhythm().steadiness()).isEqualTo(0.75);
    }

    @Test
    void sentencesSplitAfterTheirTerminatorAndKeepATrailingRun() {
        Analytics a = SessionAnalyzer.analyze(typed("hi. yo", 0, 100));

        assertThat(a.sentences()).extracting(Analytics.Sentence::label).containsExactly("hi.", "yo");
        assertThat(a.sentences()).extracting(Analytics.Sentence::keyCount).containsExactly(3, 3);
    }

    @Test
    void enterEndsASentence() {
        Analytics a = SessionAnalyzer.analyze(List.of(k("a", 0), k("Enter", 100), k("b", 200)));

        assertThat(a.sentences()).extracting(Analytics.Sentence::label).containsExactly("a\u21B5", "b");
    }

    @Test
    void longSentenceLabelsAreCutAt40Characters() {
        Analytics a = SessionAnalyzer.analyze(typed("abcdefghij".repeat(5), 0, 100));

        assertThat(a.sentences().getFirst().label()).isEqualTo("abcdefghij".repeat(4));
    }

    @Test
    void wpmIsFiveKeysAWordOverTheSentenceTime() {
        // 10 keys over 900 ms: 2 words / 0.015 min
        Analytics a = SessionAnalyzer.analyze(typed("abcdefghij", 0, 100));

        assertThat(a.sentences().getFirst().wpm()).isCloseTo(133.33, within(0.01));
        assertThat(a.summary().averageWpm()).isCloseTo(133.33, within(0.01));
        assertThat(a.summary().peakWpm()).isCloseTo(133.33, within(0.01));
        assertThat(a.summary().durationMs()).isEqualTo(900.0);
    }

    @Test
    void wpmIsCappedAt300() {
        Analytics a = SessionAnalyzer.analyze(typed("abcdefghij", 0, 20));

        assertThat(a.sentences().getFirst().wpm()).isEqualTo(300.0);
        assertThat(a.summary().averageWpm()).isEqualTo(300.0);
    }

    @Test
    void peakIsTheFastestSentence() {
        Analytics a = SessionAnalyzer.analyze(concat(typed("abcd.", 0, 200), typed("efgh.", 2000, 100)));

        assertThat(a.summary().peakWpm()).isEqualTo(a.sentences().get(1).wpm());
    }

    @Test
    void pausesAreNamedAfterTheKeyBeforeThem() {
        Analytics a = SessionAnalyzer.analyze(List.of(
                k("a", 0), k(" ", 100),
                k("b", 600), k(",", 700),
                k("c", 1200), k(".", 1300),
                k("d", 1800),
                k("e", 2400)));

        assertThat(a.pauses().byKind())
                .containsEntry("word", 1)
                .containsEntry("comma", 1)
                .containsEntry("sentence", 1)
                .containsEntry("hesitation", 1);
        assertThat(a.pauses().count()).isEqualTo(4);
        assertThat(a.pauses().totalMs()).isEqualTo(2100.0);
        assertThat(a.pauses().longestMs()).isEqualTo(600.0);
    }

    @Test
    void segmentsSplitTheTypedTextAtEachPause() {
        Analytics a = SessionAnalyzer.analyze(concat(typed("hello world.", 0, 100), typed(" keep", 2300, 100)));

        assertThat(a.pauses().segments()).containsExactly(
                new Analytics.Segment("hello world.", 1200.0),
                new Analytics.Segment(" keep", null));
    }

    @Test
    void renderedTextShowsCorrectionsAndSkipsOtherNamedKeys() {
        Analytics a = SessionAnalyzer.analyze(List.of(
                k("h", 0), k("Backspace", 100), k("i", 200), k("Enter", 300), k("Delete", 400), k("j", 500)));

        assertThat(a.pauses().segments()).containsExactly(new Analytics.Segment("h\u232Bi\u21B5j", null));
        assertThat(a.summary().keyCount()).isEqualTo(6);
    }

    @Test
    void topKeysFoldCaseAndBreakTiesByFirstAppearance() {
        Analytics a = SessionAnalyzer.analyze(typed("bAab", 0, 100));

        assertThat(a.keys().top()).containsExactly(new Analytics.KeyCount("b", 2), new Analytics.KeyCount("a", 2));
    }

    @Test
    void topKeysStopAtTen() {
        Analytics a = SessionAnalyzer.analyze(typed("abcdefghijk", 0, 100));

        assertThat(a.keys().top()).hasSize(10);
        assertThat(a.keys().top().getLast().key()).isEqualTo("j");
    }

    @Test
    void countsCorrectionsEntersAndPunctuation() {
        Analytics a = SessionAnalyzer.analyze(
                List.of(k("a", 0), k("Backspace", 100), k("b", 200), k(".", 300), k("Enter", 400)));

        assertThat(a.keys().backspaces()).isEqualTo(1);
        assertThat(a.keys().correctionRate()).isEqualTo(0.2);
        assertThat(a.keys().enters()).isEqualTo(1);
        assertThat(a.keys().punctuation())
                .containsEntry(".", 1).containsEntry(",", 0).containsEntry("!", 0).containsEntry("?", 0);
        assertThat(a.keys().top()).extracting(Analytics.KeyCount::key).containsExactly("a", "b", ".");
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run (Git Bash, from `backend/`): `./mvnw -B -q test -Dtest=SessionAnalyzerTest`
Expected: compilation failure, `cannot find symbol ... SessionAnalyzer` / `Analytics`.

- [ ] **Step 3: Write the response records**

`backend/src/main/java/com/keytosound/backend/analytics/Analytics.java`:

```java
package com.keytosound.backend.analytics;

import java.util.List;
import java.util.Map;

/**
 * Everything the stats view shows for one composition, serialised as-is.
 * A number that has no meaning (no gaps to take a median of, a sentence too
 * short to time) is null rather than 0, so the UI can show a dash.
 */
public record Analytics(Summary summary, Rhythm rhythm, List<Sentence> sentences, Pauses pauses, Keys keys) {

    public record Summary(int keyCount, double durationMs, double averageWpm, Double peakWpm, int heldKeysIgnored) {}

    public record Band(int fromMs, int toMs, int count) {}

    public record Rhythm(List<Band> bands, Double medianGapMs, Double steadiness) {}

    public record Sentence(String label, int keyCount, Double wpm) {}

    public record Segment(String text, Double pauseAfterMs) {}

    public record Pauses(
            int count, double totalMs, double longestMs, Map<String, Integer> byKind, List<Segment> segments) {}

    public record KeyCount(String key, int count) {}

    public record Keys(
            List<KeyCount> top,
            int backspaces,
            double correctionRate,
            Map<String, Integer> punctuation,
            int enters,
            int drums) {}
}
```

- [ ] **Step 4: Write the analyzer**

`backend/src/main/java/com/keytosound/backend/analytics/SessionAnalyzer.java`:

```java
package com.keytosound.backend.analytics;

import com.keytosound.backend.composition.dto.KeystrokeDto;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Turns a stored keystroke stream into {@link Analytics}. Plain Java with no
 * Spring or JPA, so every rule is testable with hand-built streams.
 *
 * <p>The timing rules match the browser's live analyzer
 * (frontend/src/typing/analyzer.ts), so the stats agree with the readout.
 */
public final class SessionAnalyzer {

    /** Silence longer than this is a pause, as in the live analyzer. */
    static final double PAUSE_THRESHOLD_MS = 400;
    /** The same key again sooner than this is OS auto-repeat from a held key. */
    static final double REPEAT_WINDOW_MS = 50;
    /** Conventional WPM definition: five keys make a word. */
    private static final double KEYS_PER_WORD = 5;
    /** Nobody sustains more; anything faster is noise. */
    private static final double MAX_WPM = 300;
    private static final int[] BAND_EDGES_MS = {0, 50, 100, 150, 200, 300, 400};
    /** A gap within this share of the median counts as steady. */
    private static final double STEADY_TOLERANCE = 0.25;
    private static final int TOP_KEYS = 10;
    private static final int LABEL_LENGTH = 40;
    private static final Set<String> SENTENCE_ENDS = Set.of(".", "!", "?", "Enter");
    private static final List<String> PUNCTUATION = List.of(".", ",", "!", "?");
    private static final List<String> PAUSE_KINDS = List.of("word", "comma", "sentence", "hesitation");
    private static final String BACKSPACE = "Backspace";
    private static final String ENTER = "Enter";

    private SessionAnalyzer() {}

    public static Analytics analyze(List<KeystrokeDto> keystrokes) {
        List<KeystrokeDto> text = new ArrayList<>();
        int held = 0;
        int drums = 0;
        KeystrokeDto previous = null;
        for (KeystrokeDto keystroke : keystrokes) {
            // Compared with the previous keystroke seen, kept or not, so a
            // whole repeat chain drops rather than every other key of it.
            boolean repeat = previous != null
                    && keystroke.key().equals(previous.key())
                    && keystroke.timestampMs() - previous.timestampMs() < REPEAT_WINDOW_MS;
            previous = keystroke;
            if (repeat) {
                held++;
            } else if (isDigit(keystroke.key())) {
                drums++;
            } else {
                text.add(keystroke);
            }
        }

        List<Double> gaps = gapsBetween(text);
        List<Analytics.Sentence> sentences = sentences(text);
        return new Analytics(
                summary(text, sentences, held), rhythm(gaps), sentences, pauses(text, gaps), keys(text, drums));
    }

    /** gaps.get(i) is the silence between text key i and text key i + 1. */
    private static List<Double> gapsBetween(List<KeystrokeDto> text) {
        List<Double> gaps = new ArrayList<>();
        for (int i = 1; i < text.size(); i++) {
            gaps.add(Math.max(0, text.get(i).timestampMs() - text.get(i - 1).timestampMs()));
        }
        return gaps;
    }

    private static Analytics.Summary summary(
            List<KeystrokeDto> text, List<Analytics.Sentence> sentences, int held) {
        double duration = span(text);
        Double average = wpm(text.size(), duration);
        Double peak = sentences.stream()
                .map(Analytics.Sentence::wpm)
                .filter(Objects::nonNull)
                .max(Double::compare)
                .orElse(null);
        return new Analytics.Summary(text.size(), duration, average == null ? 0 : average, peak, held);
    }

    private static Analytics.Rhythm rhythm(List<Double> gaps) {
        List<Double> typing = gaps.stream().filter(g -> g <= PAUSE_THRESHOLD_MS).sorted().toList();
        List<Analytics.Band> bands = new ArrayList<>();
        for (int i = 0; i + 1 < BAND_EDGES_MS.length; i++) {
            int from = BAND_EDGES_MS[i];
            int to = BAND_EDGES_MS[i + 1];
            // Half-open, except the last band keeps its 400 ms edge: exactly
            // 400 is still typing, not a pause.
            boolean last = i + 2 == BAND_EDGES_MS.length;
            int count = (int) typing.stream().filter(g -> g >= from && (last ? g <= to : g < to)).count();
            bands.add(new Analytics.Band(from, to, count));
        }
        if (typing.isEmpty()) return new Analytics.Rhythm(bands, null, null);

        int n = typing.size();
        double median = n % 2 == 1 ? typing.get(n / 2) : (typing.get(n / 2 - 1) + typing.get(n / 2)) / 2;
        long steady = typing.stream()
                .filter(g -> Math.abs(g - median) <= STEADY_TOLERANCE * median)
                .count();
        return new Analytics.Rhythm(bands, median, (double) steady / n);
    }

    private static List<Analytics.Sentence> sentences(List<KeystrokeDto> text) {
        List<Analytics.Sentence> sentences = new ArrayList<>();
        List<KeystrokeDto> current = new ArrayList<>();
        for (KeystrokeDto keystroke : text) {
            current.add(keystroke);
            if (SENTENCE_ENDS.contains(keystroke.key())) {
                sentences.add(sentence(current));
                current = new ArrayList<>();
            }
        }
        if (!current.isEmpty()) sentences.add(sentence(current));
        return sentences;
    }

    private static Analytics.Sentence sentence(List<KeystrokeDto> keys) {
        String label = render(keys).strip();
        if (label.length() > LABEL_LENGTH) label = label.substring(0, LABEL_LENGTH);
        return new Analytics.Sentence(label, keys.size(), wpm(keys.size(), span(keys)));
    }

    private static Analytics.Pauses pauses(List<KeystrokeDto> text, List<Double> gaps) {
        Map<String, Integer> byKind = new LinkedHashMap<>();
        PAUSE_KINDS.forEach(kind -> byKind.put(kind, 0));
        List<Analytics.Segment> segments = new ArrayList<>();
        int count = 0;
        double total = 0;
        double longest = 0;
        StringBuilder segment = new StringBuilder();
        for (int i = 0; i < text.size(); i++) {
            segment.append(render(text.get(i).key()));
            if (i < gaps.size() && gaps.get(i) > PAUSE_THRESHOLD_MS) {
                double gap = gaps.get(i);
                count++;
                total += gap;
                longest = Math.max(longest, gap);
                byKind.merge(pauseKind(text.get(i).key()), 1, Integer::sum);
                segments.add(new Analytics.Segment(segment.toString(), gap));
                segment.setLength(0);
            }
        }
        if (!text.isEmpty()) segments.add(new Analytics.Segment(segment.toString(), null));
        return new Analytics.Pauses(count, total, longest, byKind, segments);
    }

    /** Named after what the typist had just finished when they stopped. */
    private static String pauseKind(String keyBefore) {
        if (keyBefore.equals(" ")) return "word";
        if (keyBefore.equals(",")) return "comma";
        if (SENTENCE_ENDS.contains(keyBefore)) return "sentence";
        return "hesitation";
    }

    private static Analytics.Keys keys(List<KeystrokeDto> text, int drums) {
        Map<String, Integer> counts = new LinkedHashMap<>(); // insertion order = first appearance
        Map<String, Integer> punctuation = new LinkedHashMap<>();
        PUNCTUATION.forEach(mark -> punctuation.put(mark, 0));
        int backspaces = 0;
        int enters = 0;
        for (KeystrokeDto keystroke : text) {
            String key = keystroke.key();
            if (key.equals(BACKSPACE)) backspaces++;
            if (key.equals(ENTER)) enters++;
            if (punctuation.containsKey(key)) punctuation.merge(key, 1, Integer::sum);
            if (isSingleCharacter(key)) counts.merge(key.toLowerCase(Locale.ROOT), 1, Integer::sum);
        }
        // sorted() is stable on an ordered stream, so equal counts keep
        // first-appearance order.
        List<Analytics.KeyCount> top = counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(TOP_KEYS)
                .map(e -> new Analytics.KeyCount(e.getKey(), e.getValue()))
                .toList();
        double correctionRate = text.isEmpty() ? 0 : (double) backspaces / text.size();
        return new Analytics.Keys(top, backspaces, correctionRate, punctuation, enters, drums);
    }

    /** The text as typed: a correction shows as a backspace mark instead of being applied. */
    private static String render(List<KeystrokeDto> keys) {
        StringBuilder out = new StringBuilder();
        keys.forEach(k -> out.append(render(k.key())));
        return out.toString();
    }

    private static String render(String key) {
        if (isSingleCharacter(key)) return key;
        if (key.equals(BACKSPACE)) return "\u232B";
        if (key.equals(ENTER)) return "\u21B5";
        return ""; // Delete, Home, F5 and the like are timed but type nothing
    }

    private static boolean isSingleCharacter(String key) {
        return key.codePointCount(0, key.length()) == 1;
    }

    private static boolean isDigit(String key) {
        return key.length() == 1 && key.charAt(0) >= '0' && key.charAt(0) <= '9';
    }

    private static double span(List<KeystrokeDto> keys) {
        return keys.size() < 2 ? 0 : Math.max(0, keys.getLast().timestampMs() - keys.getFirst().timestampMs());
    }

    /** Null when there is no time to measure over. */
    private static Double wpm(int keyCount, double durationMs) {
        if (keyCount < 2 || durationMs <= 0) return null;
        return Math.min(MAX_WPM, (keyCount / KEYS_PER_WORD) / (durationMs / 60000));
    }
}
```

- [ ] **Step 5: Run the tests**

Run: `./mvnw -B -q test -Dtest=SessionAnalyzerTest`
Expected: 21 tests, all PASS.

- [ ] **Step 6: Commit**

```bash
git -c safe.directory=D:/projects/keytosound add backend/src/main/java/com/keytosound/backend/analytics backend/src/test/java/com/keytosound/backend/analytics/SessionAnalyzerTest.java
git -c safe.directory=D:/projects/keytosound commit -m "add session analyzer"
```

---

### Task 2: The endpoint

**Files:**
- Create: `backend/src/main/java/com/keytosound/backend/analytics/AnalyticsController.java`
- Test: `backend/src/test/java/com/keytosound/backend/analytics/AnalyticsControllerTest.java`

**Interfaces:**
- Consumes: `SessionAnalyzer.analyze(List<KeystrokeDto>)` (Task 1); `CompositionService.get(UUID userId, UUID id)` returning `CompositionDetail` whose `keystrokes()` is ordered by ordinal and which throws `NotFoundException` (404) for another user's composition; `AuthTestSupport.sessionFor(TokenService, UUID)` and `AuthTestSupport.createUser(UserAccountRepository)`.
- Produces: `GET /api/compositions/{id}/analytics` → JSON of `Analytics`.

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/com/keytosound/backend/analytics/AnalyticsControllerTest.java`:

```java
package com.keytosound.backend.analytics;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.keytosound.backend.auth.AuthTestSupport;
import com.keytosound.backend.auth.TokenService;
import com.keytosound.backend.auth.UserAccountRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
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
class AnalyticsControllerTest {

    private static final String COMPOSITION =
            "{\"title\":\"hi\",\"genreId\":\"lofi\",\"seed\":1,\"settings\":{\"genreId\":\"lofi\"},"
                    + "\"keystrokes\":[{\"key\":\"h\",\"timestampMs\":0},{\"key\":\"i\",\"timestampMs\":100}]}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TokenService tokens;

    @Autowired
    private UserAccountRepository users;

    private Cookie session;

    @BeforeEach
    void signIn() {
        session = AuthTestSupport.sessionFor(tokens, AuthTestSupport.createUser(users));
    }

    private String save() throws Exception {
        String response = mockMvc.perform(post("/api/compositions")
                        .cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(COMPOSITION))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asString();
    }

    @Test
    void returnsTheStatsForTheOwner() throws Exception {
        String id = save();

        mockMvc.perform(get("/api/compositions/" + id + "/analytics").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.keyCount").value(2))
                .andExpect(jsonPath("$.summary.durationMs").value(100.0))
                .andExpect(jsonPath("$.rhythm.bands.length()").value(6))
                .andExpect(jsonPath("$.rhythm.medianGapMs").value(100.0))
                .andExpect(jsonPath("$.sentences[0].label").value("hi"))
                .andExpect(jsonPath("$.pauses.byKind.hesitation").value(0))
                .andExpect(jsonPath("$.pauses.segments[0].text").value("hi"))
                .andExpect(jsonPath("$.pauses.segments[0].pauseAfterMs").isEmpty())
                .andExpect(jsonPath("$.keys.top[0].key").value("h"))
                .andExpect(jsonPath("$.keys.drums").value(0));
    }

    @Test
    void anotherUsersCompositionIsNotFound() throws Exception {
        String id = save();
        Cookie stranger = AuthTestSupport.sessionFor(tokens, AuthTestSupport.createUser(users));

        mockMvc.perform(get("/api/compositions/" + id + "/analytics").cookie(stranger))
                .andExpect(status().isNotFound());
    }

    @Test
    void needsASession() throws Exception {
        String id = save();

        mockMvc.perform(get("/api/compositions/" + id + "/analytics"))
                .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./mvnw -B -q test -Dtest=AnalyticsControllerTest`
Expected: `returnsTheStatsForTheOwner` and `anotherUsersCompositionIsNotFound` FAIL with status 404 for a missing handler (no mapping yet); `needsASession` may already pass (the security chain answers 401 first).

- [ ] **Step 3: Write the controller**

`backend/src/main/java/com/keytosound/backend/analytics/AnalyticsController.java`:

```java
package com.keytosound.backend.analytics;

import com.keytosound.backend.composition.CompositionService;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Typing stats for one saved composition. Computed on every request rather
 * than stored, so they always follow the current rules. Ownership comes from
 * CompositionService: anyone else's composition is a 404.
 */
@RestController
@RequestMapping("/api/compositions")
public class AnalyticsController {

    private final CompositionService compositions;

    public AnalyticsController(CompositionService compositions) {
        this.compositions = compositions;
    }

    @GetMapping("/{id}/analytics")
    public Analytics analytics(@AuthenticationPrincipal UUID userId, @PathVariable UUID id) {
        return SessionAnalyzer.analyze(compositions.get(userId, id).keystrokes());
    }
}
```

- [ ] **Step 4: Run the full backend suite**

Run: `./mvnw -B -q test`
Expected: all tests pass (93 existing + 21 + 3 = 117). Postgres `ERROR:` lines in the log come from the migration tests' deliberate constraint violations and are expected.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory=D:/projects/keytosound add backend/src/main/java/com/keytosound/backend/analytics/AnalyticsController.java backend/src/test/java/com/keytosound/backend/analytics/AnalyticsControllerTest.java
git -c safe.directory=D:/projects/keytosound commit -m "add analytics endpoint"
```

---

### Task 3: Frontend client

**Files:**
- Modify: `frontend/src/session/types.ts` (append)
- Modify: `frontend/src/session/api.ts` (import + one function)
- Create: `frontend/src/ui/analyticsView.ts`
- Modify: `frontend/tests/session/api.test.ts` (import + one describe)
- Create: `frontend/tests/ui/analyticsView.test.ts`

**Interfaces:**
- Consumes: `request<T>(path, init?)` from `session/api.ts` (sends `credentials: 'include'`); the JSON shape from Task 2.
- Produces: `getAnalytics(id: string): Promise<CompositionAnalytics>`; types `CompositionAnalytics`, `PauseKind`; helpers `formatMs(ms: number): string`, `barPercent(value: number, max: number): number`, `asPercent(share: number): string`, `keyLabel(key: string): string`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/tests/session/api.test.ts`, and add `getAnalytics` to its import list from `'../../src/session/api'`:

```ts
describe('getAnalytics', () => {
  it('fetches one composition\'s stats with the session cookie', async () => {
    const spy = mockFetch(200, { summary: { keyCount: 0 } });

    await getAnalytics('abc');

    const [url, init] = spy.mock.calls[0];
    expect(url).toMatch(/\/api\/compositions\/abc\/analytics$/);
    expect(init.credentials).toBe('include');
    expect(init.method).toBeUndefined();
  });
});
```

Create `frontend/tests/ui/analyticsView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { asPercent, barPercent, formatMs, keyLabel } from '../../src/ui/analyticsView';

describe('formatMs', () => {
  it('shows whole milliseconds under a second', () => {
    expect(formatMs(340)).toBe('340ms');
    expect(formatMs(12.4)).toBe('12ms');
  });

  it('shows seconds with one decimal from a second up', () => {
    expect(formatMs(1000)).toBe('1.0s');
    expect(formatMs(1234)).toBe('1.2s');
  });

  it('does not print 1000ms for values that round up to a second', () => {
    expect(formatMs(999.6)).toBe('1.0s');
  });
});

describe('barPercent', () => {
  it('scales against the largest value', () => {
    expect(barPercent(50, 200)).toBe(25);
    expect(barPercent(200, 200)).toBe(100);
  });

  it('is 0 when there is nothing to compare against', () => {
    expect(barPercent(0, 0)).toBe(0);
  });
});

describe('asPercent', () => {
  it('turns a share into a whole percentage', () => {
    expect(asPercent(0.72)).toBe('72%');
    expect(asPercent(0)).toBe('0%');
  });
});

describe('keyLabel', () => {
  it('names the space bar and leaves other keys alone', () => {
    expect(keyLabel(' ')).toBe('space');
    expect(keyLabel('e')).toBe('e');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run (from `frontend/`): `npx vitest run tests/session/api.test.ts tests/ui/analyticsView.test.ts`
Expected: FAIL — `getAnalytics` is not exported; `analyticsView` cannot be resolved.

- [ ] **Step 3: Add the types**

Append to `frontend/src/session/types.ts`:

```ts
/** Server-computed typing stats for one composition; see AnalyticsController. */
export type PauseKind = 'word' | 'comma' | 'sentence' | 'hesitation';

export interface CompositionAnalytics {
  summary: {
    keyCount: number;
    durationMs: number;
    averageWpm: number;
    peakWpm: number | null;
    heldKeysIgnored: number;
  };
  rhythm: {
    bands: { fromMs: number; toMs: number; count: number }[];
    medianGapMs: number | null;
    steadiness: number | null;
  };
  sentences: { label: string; keyCount: number; wpm: number | null }[];
  pauses: {
    count: number;
    totalMs: number;
    longestMs: number;
    byKind: Record<PauseKind, number>;
    segments: { text: string; pauseAfterMs: number | null }[];
  };
  keys: {
    top: { key: string; count: number }[];
    backspaces: number;
    correctionRate: number;
    punctuation: Record<string, number>;
    enters: number;
    drums: number;
  };
}
```

- [ ] **Step 4: Add `getAnalytics`**

In `frontend/src/session/api.ts`, change the types import to:

```ts
import type {
  CompositionAnalytics,
  CompositionDetail,
  CompositionSummary,
  RecordedSession,
} from './types';
```

and add after `deleteComposition`:

```ts
export function getAnalytics(id: string): Promise<CompositionAnalytics> {
  return request<CompositionAnalytics>(`/api/compositions/${id}/analytics`);
}
```

- [ ] **Step 5: Add the helpers**

`frontend/src/ui/analyticsView.ts`:

```ts
/** 340 → "340ms"; from a second up, one decimal: 1234 → "1.2s". */
export function formatMs(ms: number): string {
  return Math.round(ms) < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** A bar's width as a percentage of the largest value; 0 when there is none. */
export function barPercent(value: number, max: number): number {
  return max > 0 ? Math.round((value / max) * 100) : 0;
}

/** 0.72 → "72%". */
export function asPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** The space bar's key is " ", which would render as nothing. */
export function keyLabel(key: string): string {
  return key === ' ' ? 'space' : key;
}
```

- [ ] **Step 6: Run the frontend suite**

Run: `npx vitest run`
Expected: all pass (331 existing + 1 + 7 = 339).

- [ ] **Step 7: Commit**

```bash
git -c safe.directory=D:/projects/keytosound add frontend/src/session/types.ts frontend/src/session/api.ts frontend/src/ui/analyticsView.ts frontend/tests/session/api.test.ts frontend/tests/ui/analyticsView.test.ts
git -c safe.directory=D:/projects/keytosound commit -m "add analytics client"
```

---

### Task 4: The placeholder panel

**Files:**
- Create: `frontend/src/ui/AnalyticsPanel.tsx`
- Modify: `frontend/src/ui/CompositionList.tsx` (new prop + button)
- Modify: `frontend/src/ui/TypingSurface.tsx` (state, wiring, close on sign-out)

**Interfaces:**
- Consumes: `getAnalytics`, `CompositionAnalytics`, `PauseKind` (Task 3); `formatMs`, `barPercent`, `asPercent`, `keyLabel` (Task 3); `isUnauthorized` from `ui/authView.ts`; `expireSession` in `TypingSurface` (a stable `useCallback`).
- Produces: `AnalyticsPanel({ id, title, onClose, onUnauthorized })`; `CompositionList` prop `onStats: (id: string, title: string) => void`.

UI wiring is verified in the browser (Task 5); its logic lives in the tested helpers.

- [ ] **Step 1: Write the panel**

`frontend/src/ui/AnalyticsPanel.tsx`:

```tsx
// PLACEHOLDER UI. Deliberately plain until the stats view gets a real design.
// Replace this file wholesale then: the data (getAnalytics) and the formatting
// helpers (analyticsView.ts) do not need to change.
import { useEffect, useState, type ReactNode } from 'react';
import { getAnalytics } from '../session/api';
import type { CompositionAnalytics, PauseKind } from '../session/types';
import { asPercent, barPercent, formatMs, keyLabel } from './analyticsView';
import { isUnauthorized } from './authView';

interface Props {
  id: string;
  title: string;
  onClose: () => void;
  /** Must be stable: the fetch depends on it. */
  onUnauthorized: () => void;
}

const PAUSE_LABELS: [PauseKind, string][] = [
  ['word', 'Between words'],
  ['comma', 'After a comma'],
  ['sentence', 'After a sentence'],
  ['hesitation', 'Hesitation'],
];

/** Mount with key={id}: a new composition remounts it, which resets the state. */
export function AnalyticsPanel({ id, title, onClose, onUnauthorized }: Props) {
  const [data, setData] = useState<CompositionAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getAnalytics(id).then(
      (result) => {
        if (live) setData(result);
      },
      (err: unknown) => {
        if (!live) return;
        if (isUnauthorized(err)) onUnauthorized();
        else setError('Could not load stats.');
      },
    );
    return () => {
      live = false;
    };
  }, [id, onUnauthorized]);

  return (
    <section className="flex flex-col gap-4 rounded border border-neutral-200 bg-white p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate font-semibold">Stats · {title}</h2>
        <button onClick={onClose} className="rounded border px-2 py-1">
          Close
        </button>
      </div>
      {error && <p className="text-neutral-500">{error}</p>}
      {!data && !error && <p className="text-neutral-500">Loading…</p>}
      {data && <Stats data={data} />}
    </section>
  );
}

function Stats({ data }: { data: CompositionAnalytics }) {
  const { summary, rhythm, sentences, pauses, keys } = data;
  const maxBand = Math.max(0, ...rhythm.bands.map((b) => b.count));
  const maxWpm = Math.max(0, ...sentences.map((s) => s.wpm ?? 0));

  return (
    <>
      <Section title="Summary">
        <Row label="Keys" value={String(summary.keyCount)} />
        <Row label="Length" value={formatMs(summary.durationMs)} />
        <Row label="Average speed" value={`${Math.round(summary.averageWpm)} wpm`} />
        <Row
          label="Fastest sentence"
          value={summary.peakWpm === null ? '—' : `${Math.round(summary.peakWpm)} wpm`}
        />
        <Row label="Held keys ignored" value={String(summary.heldKeysIgnored)} />
      </Section>

      <Section title="Rhythm">
        <Row
          label="Usual gap"
          value={rhythm.medianGapMs === null ? '—' : formatMs(rhythm.medianGapMs)}
        />
        <Row
          label="Steady keypresses"
          value={rhythm.steadiness === null ? '—' : asPercent(rhythm.steadiness)}
        />
        {rhythm.bands.map((b) => (
          <Bar
            key={b.fromMs}
            label={`${b.fromMs}–${b.toMs}ms`}
            value={String(b.count)}
            percent={barPercent(b.count, maxBand)}
          />
        ))}
      </Section>

      <Section title="Speed per sentence">
        {sentences.length === 0 && <p className="text-neutral-500">No sentences.</p>}
        {sentences.map((s, i) => (
          <Bar
            key={i}
            label={s.label || '(blank)'}
            value={s.wpm === null ? '—' : `${Math.round(s.wpm)} wpm`}
            percent={barPercent(s.wpm ?? 0, maxWpm)}
          />
        ))}
      </Section>

      <Section title="Pauses">
        <Row label="Pauses" value={String(pauses.count)} />
        <Row label="Time paused" value={formatMs(pauses.totalMs)} />
        <Row label="Longest" value={formatMs(pauses.longestMs)} />
        {PAUSE_LABELS.map(([kind, label]) => (
          <Row key={kind} label={label} value={String(pauses.byKind[kind])} />
        ))}
        {pauses.segments.length > 0 && (
          <p className="whitespace-pre-wrap break-words rounded bg-neutral-50 p-2 font-mono">
            {pauses.segments.map((seg, i) => (
              <span key={i}>
                {seg.text}
                {seg.pauseAfterMs !== null && (
                  <span className="text-neutral-400">[{formatMs(seg.pauseAfterMs)}]</span>
                )}
              </span>
            ))}
          </p>
        )}
      </Section>

      <Section title="Keys">
        <Row
          label="Backspaces"
          value={`${keys.backspaces} (${asPercent(keys.correctionRate)})`}
        />
        <Row label="Enter" value={String(keys.enters)} />
        <Row label="Drum hits" value={String(keys.drums)} />
        <Row
          label="Punctuation"
          value={Object.entries(keys.punctuation)
            .map(([mark, n]) => `${mark} ${n}`)
            .join('   ')}
        />
        {keys.top.length > 0 && (
          <table className="mt-1 font-mono">
            <tbody>
              {keys.top.map((k) => (
                <tr key={k.key}>
                  <td className="pr-6 text-neutral-500">{keyLabel(k.key)}</td>
                  <td>{k.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-medium">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-0.5">
      <span className="text-neutral-500">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Bar({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="grid grid-cols-[10rem_1fr_5rem] items-center gap-2">
      <span className="truncate text-neutral-500">{label}</span>
      <div className="h-2 bg-neutral-100">
        <div className="h-2 bg-neutral-400" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-right font-mono">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Add the Stats button**

In `frontend/src/ui/CompositionList.tsx`, add to `Props` after `onExport`:

```ts
  onStats: (id: string, title: string) => void;
```

change the signature to:

```ts
export function CompositionList({ refreshKey, onPlay, onExport, onStats, onUnauthorized }: Props) {
```

and add this button between Export MIDI and Delete:

```tsx
            <button
              onClick={() => onStats(item.id, item.title)}
              className="rounded border px-2 py-1 text-sm"
            >
              Stats
            </button>
```

- [ ] **Step 3: Wire it into TypingSurface**

In `frontend/src/ui/TypingSurface.tsx`:

1. Add the import after `import { AuthPanel } from './AuthPanel';`:

```ts
import { AnalyticsPanel } from './AnalyticsPanel';
```

2. Add state after `const [authOpen, setAuthOpen] = useState(false);`:

```ts
  const [stats, setStats] = useState<{ id: string; title: string } | null>(null);
```

3. In `expireSession`, before its existing first statement, add `setStats(null);` so a 401 anywhere closes the panel.

4. Change the Log out button's handler from `onClick={() => void auth.logout()}` to:

```tsx
onClick={() => {
  setStats(null);
  void auth.logout();
}}
```

5. Pass the new prop to `CompositionList` and render the panel after it:

```tsx
      {saveArea === 'controls' && (
        <CompositionList
          refreshKey={refreshKey}
          onPlay={(id) => void replay(id)}
          onExport={(id) => void exportComposition(id)}
          onStats={(id, title) => setStats({ id, title })}
          onUnauthorized={expireSession}
        />
      )}

      {saveArea === 'controls' && stats && (
        <AnalyticsPanel
          key={stats.id}
          id={stats.id}
          title={stats.title}
          onClose={() => setStats(null)}
          onUnauthorized={expireSession}
        />
      )}
```

- [ ] **Step 4: Type-check, lint, test**

Run (from `frontend/`):
- `npx tsc -b 2>&1 | grep -c "error TS"` — expected **16**, the pre-existing TS1294 errors; `npx tsc -b 2>&1 | grep -E "AnalyticsPanel|analyticsView|CompositionList|TypingSurface"` — expected no output.
- `npx eslint src/ui src/session` — expected clean.
- `npx vitest run` — expected 339 passing.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory=D:/projects/keytosound add frontend/src/ui/AnalyticsPanel.tsx frontend/src/ui/CompositionList.tsx frontend/src/ui/TypingSurface.tsx
git -c safe.directory=D:/projects/keytosound commit -m "add stats panel"
```

---

### Task 5: Browser check

No new code unless a check fails; then debug, add a test that pins the fix, and commit with a short message.

- [ ] **Step 1:** `preview_start` name `backend`, then `frontend`. Open `http://localhost:5173`. Log in (or create an account).
- [ ] **Step 2:** Start audio. In the typing area, send real key presses (the browser tool's `key` action; its `type` action inserts text without `keydown`, and its `period` key name sends an empty key — send `.` instead). Type `hello world.`, wait 2 seconds, type ` keep`. Save as `stats test`.
- [ ] **Step 3:** Click **Stats** on `stats test`. Confirm: Keys 17; Pauses 1 with *After a sentence* 1; the pause text reads `hello world.[2.0s] keep` (about 2 s); two sentence bars; top keys include `l 3` and `e 3`; Drum hits 0; white background, grey bars.
- [ ] **Step 4:** Click Stats on another composition: the panel swaps to it. Close hides it. Open it again, click Log out: it disappears and does not return on logging back in.
- [ ] **Step 5:** Check console and network for unexpected errors; screenshot the panel. Stop both previews, then stop the embedded Postgres cleanly: `pg_ctl stop -D .pgdata -m fast` from `backend/`, using the `pg_ctl.exe` beside the running `postgres.exe` (`Get-CimInstance Win32_Process -Filter "Name='postgres.exe'"` shows its path).
