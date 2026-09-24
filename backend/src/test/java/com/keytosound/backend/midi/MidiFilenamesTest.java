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
