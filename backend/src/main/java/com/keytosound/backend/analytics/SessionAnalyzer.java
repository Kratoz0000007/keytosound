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
