package com.keytosound.backend.auth;

import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * The session cookie. HttpOnly so page JavaScript, including an injected
 * script, can never read the token. SameSite=Lax so a cross-site POST or
 * DELETE never carries it.
 */
@Component
public class AuthCookies {

    public static final String NAME = "kts_session";

    private final boolean secure;

    public AuthCookies(AuthProperties properties) {
        this.secure = properties.cookieSecure();
    }

    public ResponseCookie session(String token) {
        return base(token).maxAge(TokenService.LIFETIME).build();
    }

    /** Same attributes, so the browser matches and replaces the cookie; Max-Age=0 deletes it. */
    public ResponseCookie cleared() {
        return base("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(NAME, value).httpOnly(true).secure(secure).sameSite("Lax").path("/");
    }
}
