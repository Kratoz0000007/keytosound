package com.keytosound.backend.midi;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ScoreValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsANullElementInLead() {
        Score score = new Score(120, "synthLead", Arrays.asList((ScoreNote) null),
                List.of(), List.of(), List.of());

        Set<ConstraintViolation<Score>> violations = validator.validate(score);

        assertThat(violations)
                .extracting(v -> v.getPropertyPath().toString())
                .contains("lead[0].<list element>");
    }
}
