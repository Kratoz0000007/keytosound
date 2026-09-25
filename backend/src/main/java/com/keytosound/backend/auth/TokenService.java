package com.keytosound.backend.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

/** Issues and checks the session token. There is no refresh token: expiry means logging in again. */
@Component
public class TokenService {

    public static final String ISSUER = "keytosound";
    public static final Duration LIFETIME = Duration.ofHours(24);

    /** Without an explicit HS256 header the encoder would look for an RSA key. */
    static final JwsHeader HEADER = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;

    public TokenService(JwtEncoder encoder, JwtDecoder decoder) {
        this.encoder = encoder;
        this.decoder = decoder;
    }

    public String issue(UUID userId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(userId.toString())
                .issuedAt(now)
                .expiresAt(now.plus(LIFETIME))
                .build();
        return encoder.encode(JwtEncoderParameters.from(HEADER, claims)).getTokenValue();
    }

    /** The user a token names, or empty when it is tampered, expired, foreign or not a token at all. */
    public Optional<UUID> verify(String token) {
        try {
            String subject = decoder.decode(token).getSubject();
            return subject == null ? Optional.empty() : Optional.of(UUID.fromString(subject));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
