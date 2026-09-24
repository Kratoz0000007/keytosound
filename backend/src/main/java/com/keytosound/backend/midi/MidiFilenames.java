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
