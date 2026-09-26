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
