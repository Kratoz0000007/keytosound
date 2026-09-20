package com.keytosound.backend.composition.dto;

import java.time.Instant;
import java.util.UUID;

public record CompositionSummary(
        UUID id, String title, String genreId, int keystrokeCount, Instant createdAt) {}
