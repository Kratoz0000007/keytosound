package com.keytosound.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * No length or format rules, on purpose: a short or malformed attempt gets the
 * same 401 as any other failed login, so login reveals nothing about the rules
 * stored passwords follow.
 */
public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
