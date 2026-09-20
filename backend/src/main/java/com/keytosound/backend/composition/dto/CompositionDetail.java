package com.keytosound.backend.composition.dto;

import tools.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CompositionDetail(
        UUID id,
        String title,
        String genreId,
        long seed,
        JsonNode settings,
        List<KeystrokeDto> keystrokes,
        Instant createdAt) {}
