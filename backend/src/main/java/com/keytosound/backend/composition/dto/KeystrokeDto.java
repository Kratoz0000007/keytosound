package com.keytosound.backend.composition.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record KeystrokeDto(@NotBlank @Size(max = 16) String key, double timestampMs) {}
