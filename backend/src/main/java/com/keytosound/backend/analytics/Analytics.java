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
