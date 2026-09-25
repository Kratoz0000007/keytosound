package com.keytosound.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AuthCookiesTest {

    private static final String SECRET = "unit-test-secret-0123456789abcdef";

    @Test
    void theSessionCookieIsHttpOnlyLaxAndLastsADay() {
        String cookie = new AuthCookies(new AuthProperties(SECRET, true)).session("tok").toString();

        assertThat(cookie)
                .startsWith("kts_session=tok")
                .contains("HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=86400", "Secure");
    }

    @Test
    void secureFollowsTheSetting() {
        String cookie = new AuthCookies(new AuthProperties(SECRET, false)).session("tok").toString();
        assertThat(cookie).doesNotContain("Secure");
    }

    @Test
    void theClearedCookieExpiresImmediately() {
        String cookie = new AuthCookies(new AuthProperties(SECRET, true)).cleared().toString();

        assertThat(cookie).startsWith("kts_session=").contains("Max-Age=0", "HttpOnly", "SameSite=Lax", "Path=/");
    }
}
