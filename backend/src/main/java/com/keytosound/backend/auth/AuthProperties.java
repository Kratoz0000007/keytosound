package com.keytosound.backend.auth;

import java.nio.charset.StandardCharsets;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings under {@code keytosound.auth}.
 *
 * @param secret the HS256 signing key. HS256 needs a 256-bit key, so anything
 *     under 32 bytes, or no secret at all, stops the app at startup rather
 *     than letting it sign sessions with a guessable key.
 * @param cookieSecure whether the session cookie is marked {@code Secure}. True
 *     unless a profile turns it off, as dev does for plain-http localhost.
 */
@ConfigurationProperties("keytosound.auth")
public record AuthProperties(String secret, @DefaultValue("true") boolean cookieSecure) {

    static final int MIN_SECRET_BYTES = 32;

    public AuthProperties {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "keytosound.auth.secret must be set to at least " + MIN_SECRET_BYTES + " bytes");
        }
    }
}
