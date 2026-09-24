package com.keytosound.backend.midi;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * One drum hit; the voice names match the frontend's digit voices. start is
 * capped at 86400s (24h) for the same reason as ScoreNote.start.
 */
public record DrumHit(
        @NotNull @Pattern(regexp = "kick|snare|hat|openHat|clap|perc|fx") String voice,
        @PositiveOrZero @DecimalMax("86400.0") double start,
        @DecimalMin("0.0") @DecimalMax("1.0") double velocity) {}
