package com.keytosound.backend.composition.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// The space bar is a keystroke like any other, and its key is " ". @NotBlank
// would reject it and make every multi-word sentence unsavable, so the floor is
// a length check: at least one character, at most 16.
public record KeystrokeDto(@NotNull @Size(min = 1, max = 16) String key, double timestampMs) {}
