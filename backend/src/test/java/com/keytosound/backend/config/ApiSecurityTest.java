package com.keytosound.backend.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.keytosound.backend.ApiBodies;
import com.keytosound.backend.auth.AuthCookies;
import com.keytosound.backend.auth.AuthTestSupport;
import com.keytosound.backend.auth.TokenService;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
class ApiSecurityTest {

    @Autowired private MockMvc mvc;
    @Autowired private TokenService tokens;
    @Autowired private JwtEncoder encoder;

    @Test
    void everyCompositionEndpointRejectsAnonymousCallers() throws Exception {
        UUID id = UUID.randomUUID();
        List<MockHttpServletRequestBuilder> calls = List.of(
                get("/api/compositions"),
                post("/api/compositions").contentType(MediaType.APPLICATION_JSON).content(ApiBodies.SAVE),
                get("/api/compositions/" + id),
                delete("/api/compositions/" + id),
                post("/api/compositions/" + id + "/midi")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ApiBodies.SCORE));

        for (MockHttpServletRequestBuilder call : calls) {
            mvc.perform(call)
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("unauthorized"))
                    .andExpect(jsonPath("$.message").value("Log in to continue."))
                    .andExpect(jsonPath("$.at").exists());
        }
    }

    @Test
    void aValidSessionGetsThrough() throws Exception {
        mvc.perform(get("/api/compositions").cookie(AuthTestSupport.sessionFor(tokens, UUID.randomUUID())))
                .andExpect(status().isOk())
                // Stateless: no JSESSIONID, and the token is not reissued.
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void aTamperedTokenIsUnauthorized() throws Exception {
        String token = tokens.issue(UUID.randomUUID());
        expectUnauthorized(AuthTestSupport.tampered(token, UUID.randomUUID()));
    }

    @Test
    void anExpiredTokenIsUnauthorized() throws Exception {
        Instant now = Instant.now();
        expectUnauthorized(AuthTestSupport.token(
                encoder, UUID.randomUUID(), "keytosound", now.minus(Duration.ofHours(25)), now.minus(Duration.ofHours(1))));
    }

    @Test
    void aWrongIssuerTokenIsUnauthorized() throws Exception {
        Instant now = Instant.now();
        expectUnauthorized(AuthTestSupport.token(
                encoder, UUID.randomUUID(), "someone-else", now, now.plus(Duration.ofHours(1))));
    }

    @Test
    void thePreflightFromTheFrontendAllowsCredentials() throws Exception {
        mvc.perform(options("/api/compositions")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void thePreflightFrom127001IsRefused() throws Exception {
        // A SameSite cookie set by localhost never reaches a 127.0.0.1 page anyway.
        mvc.perform(options("/api/compositions")
                        .header("Origin", "http://127.0.0.1:5173")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }

    private void expectUnauthorized(String token) throws Exception {
        mvc.perform(get("/api/compositions").cookie(new Cookie(AuthCookies.NAME, token)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Log in to continue."));
    }
}
