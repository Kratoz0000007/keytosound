package com.keytosound.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

class AuthPropertiesTest {

    @Test
    void refusesAMissingSecret() {
        assertThatThrownBy(() -> new AuthProperties(null, true))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("keytosound.auth.secret");
    }

    @Test
    void refusesASecretShorterThan32Bytes() {
        assertThatThrownBy(() -> new AuthProperties("x".repeat(31), true))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void accepts32Bytes() {
        assertThat(new AuthProperties("x".repeat(32), false).cookieSecure()).isFalse();
    }

    @Test
    void cookieIsSecureUnlessConfiguredOtherwise() {
        Binder binder = new Binder(new MapConfigurationPropertySource(
                Map.of("keytosound.auth.secret", "x".repeat(32))));

        AuthProperties bound = binder.bind("keytosound.auth", AuthProperties.class).get();

        assertThat(bound.cookieSecure()).isTrue();
    }
}
