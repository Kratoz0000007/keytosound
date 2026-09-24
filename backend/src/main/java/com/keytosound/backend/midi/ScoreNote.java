package com.keytosound.backend.midi;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * One pitched note. Times in seconds from the session start; velocity 0..1.
 * start and duration are capped at 86400s (24h), far above the roughly one
 * hour the 20000-keystroke cap can produce, so MidiWriter.ticks never has to
 * saturate Math.round on a runaway value.
 */
public record ScoreNote(
        @Min(0) @Max(127) int pitch,
        @PositiveOrZero @DecimalMax("86400.0") double start,
        @Positive @DecimalMax("86400.0") double duration,
        @DecimalMin("0.0") @DecimalMax("1.0") double velocity) {}
