package com.keytosound.backend.auth;

import com.keytosound.backend.auth.dto.LoginRequest;
import com.keytosound.backend.auth.dto.RegisterRequest;
import com.keytosound.backend.auth.dto.UserView;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP only: AuthService decides, this sets the cookie. Page JavaScript cannot
 * read an HttpOnly cookie, so /me is how the app learns on load whether the
 * user is still logged in.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final TokenService tokens;
    private final AuthCookies cookies;

    public AuthController(AuthService auth, TokenService tokens, AuthCookies cookies) {
        this.auth = auth;
        this.tokens = tokens;
        this.cookies = cookies;
    }

    /** Registering logs the new user straight in. */
    @PostMapping("/register")
    public ResponseEntity<UserView> register(@Valid @RequestBody RegisterRequest request) {
        UserView user = auth.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, cookies.session(tokens.issue(user.id())).toString())
                .body(user);
    }

    @PostMapping("/login")
    public ResponseEntity<UserView> login(@Valid @RequestBody LoginRequest request) {
        UserView user = auth.login(request);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookies.session(tokens.issue(user.id())).toString())
                .body(user);
    }

    /** Clears this browser's cookie. A copied token stays valid until it expires (a known gap). */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookies.cleared().toString())
                .build();
    }

    @GetMapping("/me")
    public UserView me(@AuthenticationPrincipal UUID userId) {
        return auth.me(userId);
    }
}
