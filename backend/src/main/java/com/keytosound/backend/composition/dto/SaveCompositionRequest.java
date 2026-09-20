package com.keytosound.backend.composition.dto;

import tools.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SaveCompositionRequest(
        @NotBlank @Size(max = 120) String title,
        @NotBlank @Size(max = 32) String genreId,
        long seed,
        @NotNull JsonNode settings,
        // A cap is required, not optional: without it one request can insert
        // unbounded rows. 20000 keystrokes is roughly an hour of fast typing.
        @NotEmpty @Size(max = 20000) @Valid List<KeystrokeDto> keystrokes) {}
