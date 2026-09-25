package com.keytosound.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;

class TokenServiceTest {

    private final AuthProperties properties =
            new AuthProperties("unit-test-secret-0123456789abcdef", true);
    private final JwtConfig config = new JwtConfig();
    private final JwtEncoder encoder = config.jwtEncoder(properties);
    private final JwtDecoder decoder = config.jwtDecoder(properties);
    private final TokenService tokens = new TokenService(encoder, decoder);

    @Test
    void anIssuedTokenVerifiesToItsUser() {
        UUID user = UUID.randomUUID();
        assertThat(tokens.verify(tokens.issue(user))).contains(user);
    }

    @Test
    void theTokenNamesTheIssuerAndLasts24Hours() {
        Jwt jwt = decoder.decode(tokens.issue(UUID.randomUUID()));

        // getIssuer() would try to parse "keytosound" as a URL.
        assertThat(jwt.getClaimAsString(JwtClaimNames.ISS)).isEqualTo("keytosound");
        assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofHours(24));
    }

    @Test
    void aTamperedPayloadIsRejected() {
        String token = tokens.issue(UUID.randomUUID());
        assertThat(tokens.verify(AuthTestSupport.tampered(token, UUID.randomUUID()))).isEmpty();
    }

    @Test
    void aTokenSignedWithAnotherSecretIsRejected() {
        AuthProperties other = new AuthProperties("another-secret-0123456789abcdef-xyz", true);
        TokenService foreign = new TokenService(config.jwtEncoder(other), config.jwtDecoder(other));

        assertThat(tokens.verify(foreign.issue(UUID.randomUUID()))).isEmpty();
    }

    @Test
    void anExpiredTokenIsRejected() {
        Instant now = Instant.now();
        String expired = AuthTestSupport.token(
                encoder, UUID.randomUUID(), "keytosound", now.minus(Duration.ofHours(25)), now.minus(Duration.ofHours(1)));

        assertThat(tokens.verify(expired)).isEmpty();
    }

    @Test
    void aTokenFromAnotherIssuerIsRejected() {
        Instant now = Instant.now();
        String foreign = AuthTestSupport.token(
                encoder, UUID.randomUUID(), "someone-else", now, now.plus(Duration.ofHours(1)));

        assertThat(tokens.verify(foreign)).isEmpty();
    }

    @Test
    void garbageIsRejected() {
        assertThat(tokens.verify("not-a-token")).isEmpty();
        assertThat(tokens.verify("")).isEmpty();
    }
}
