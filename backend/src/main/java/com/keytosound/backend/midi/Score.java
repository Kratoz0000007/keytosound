package com.keytosound.backend.midi;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * A composition rendered to notes by the browser's engine. Every musical
 * decision is already made; the server's job is the MIDI format. Capped per
 * track so the file the writer produces is bounded — the caps run after
 * Jackson has already materialized the whole request body, so they do not
 * bound the bytes buffered while reading it.
 */
public record Score(
        @Min(40) @Max(240) int bpm,
        @NotNull @Pattern(regexp = "piano|electricPiano|synthLead|eightBit|bass") String leadInstrument,
        @NotNull @Size(max = 20000) List<@NotNull @Valid ScoreNote> lead,
        @NotNull @Size(max = 20000) List<@NotNull @Valid ScoreNote> pad,
        @NotNull @Size(max = 20000) List<@NotNull @Valid ScoreNote> bass,
        @NotNull @Size(max = 20000) List<@NotNull @Valid DrumHit> drums) {}
