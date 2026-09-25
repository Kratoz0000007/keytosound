package com.keytosound.backend;

/** Valid request bodies for tests that need to get past validation. */
public final class ApiBodies {

    private ApiBodies() {}

    public static final String SAVE = """
            {"title":"rain","genreId":"lofi","seed":42,"settings":{"genreId":"lofi"},
             "keystrokes":[{"key":"a","timestampMs":0},{"key":" ","timestampMs":120}]}""";

    public static final String SCORE = """
            {"bpm":75,"leadInstrument":"electricPiano",
             "lead":[{"pitch":69,"start":0.4,"duration":0.3,"velocity":0.7}],
             "pad":[],"bass":[],"drums":[]}""";
}
