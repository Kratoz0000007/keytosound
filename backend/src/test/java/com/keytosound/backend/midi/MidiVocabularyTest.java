package com.keytosound.backend.midi;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * Pins the two literal vocabularies these records accept — instrument names
 * in Score.leadInstrument and drum voice names in DrumHit.voice — against what
 * the frontend actually produces (frontend/src/engine/presets.ts leadInstrument
 * values, frontend/src/engine/beat.ts VOICES). Written as literals here rather
 * than derived from Score.java/DrumHit.java: if either side's vocabulary
 * changes without the other, this goes red instead of a runtime 400.
 */
class MidiVocabularyTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private static final List<String> INSTRUMENTS =
            List.of("piano", "electricPiano", "synthLead", "eightBit", "bass");

    private static final List<String> DRUM_VOICES =
            List.of("kick", "snare", "hat", "openHat", "clap", "perc", "fx");

    private static ScoreNote note() {
        return new ScoreNote(60, 0.0, 0.5, 0.7);
    }

    @Test
    void acceptsEveryDeclaredInstrumentName() {
        for (String instrument : INSTRUMENTS) {
            Score score = new Score(120, instrument, List.of(note()), List.of(), List.of(), List.of());
            Set<ConstraintViolation<Score>> violations = validator.validate(score);
            assertThat(violations)
                    .as("instrument %s", instrument)
                    .noneMatch(v -> v.getPropertyPath().toString().equals("leadInstrument"));
        }
    }

    @Test
    void rejectsAnInstrumentNameNotInTheVocabulary() {
        Score score = new Score(120, "mellotron", List.of(note()), List.of(), List.of(), List.of());
        Set<ConstraintViolation<Score>> violations = validator.validate(score);
        assertThat(violations).anyMatch(v -> v.getPropertyPath().toString().equals("leadInstrument"));
    }

    @Test
    void acceptsEveryDeclaredDrumVoiceName() {
        for (String voice : DRUM_VOICES) {
            DrumHit hit = new DrumHit(voice, 0.0, 0.7);
            Set<ConstraintViolation<DrumHit>> violations = validator.validate(hit);
            assertThat(violations)
                    .as("voice %s", voice)
                    .noneMatch(v -> v.getPropertyPath().toString().equals("voice"));
        }
    }

    @Test
    void rejectsADrumVoiceNotInTheVocabulary() {
        DrumHit hit = new DrumHit("cowbell", 0.0, 0.7);
        Set<ConstraintViolation<DrumHit>> violations = validator.validate(hit);
        assertThat(violations).anyMatch(v -> v.getPropertyPath().toString().equals("voice"));
    }
}
