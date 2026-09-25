package com.keytosound.backend.auth;

import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

/** Shared by every test that needs a logged-in caller or a deliberately bad token. */
public final class AuthTestSupport {

    private AuthTestSupport() {}

    /** A session cookie for userId, exactly as the login endpoint issues it. */
    public static Cookie sessionFor(TokenService tokens, UUID userId) {
        return new Cookie(AuthCookies.NAME, tokens.issue(userId));
    }

    /** A token with chosen claims, signed with the app's real key. */
    public static String token(
            JwtEncoder encoder, UUID userId, String issuer, Instant issuedAt, Instant expiresAt) {
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .subject(userId.toString())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .build();
        return encoder.encode(JwtEncoderParameters.from(TokenService.HEADER, claims)).getTokenValue();
    }

    /** Swaps the payload for one naming another user, keeping the original signature. */
    public static String tampered(String token, UUID otherUser) {
        String[] parts = token.split("\\.");
        String payload = "{\"sub\":\"" + otherUser + "\",\"iss\":\"keytosound\",\"exp\":"
                + (Instant.now().getEpochSecond() + 3600) + "}";
        String forged = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return parts[0] + "." + forged + "." + parts[2];
    }
}
