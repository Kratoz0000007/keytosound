package com.keytosound.backend.auth.dto;

import java.util.UUID;

public record UserView(UUID id, String email) {}
