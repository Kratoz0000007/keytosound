package com.keytosound.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

    private static final String PASSWORD = "correct-horse";

    @Autowired private MockMvc mvc;
    @Autowired private TokenService tokens;
    @Autowired private UserAccountRepository users;

    @Test
    void registerLogsTheNewUserStraightIn() throws Exception {
        String email = uniqueEmail();

        MvcResult result = call("/api/auth/register", email, PASSWORD)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.id").exists())
                .andReturn();

        String setCookie = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        assertThat(setCookie)
                .startsWith("kts_session=")
                .contains("HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=86400", "Secure");

        mvc.perform(get("/api/auth/me").cookie(sessionFrom(result)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));
    }

    @Test
    void emailsAreStoredLowercased() throws Exception {
        String email = uniqueEmail();
        call("/api/auth/register", email.toUpperCase(), PASSWORD)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(email));
    }

    @Test
    void loginSetsTheCookieAndLogoutClearsIt() throws Exception {
        String email = register();

        MvcResult login = call("/api/auth/login", email, PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andReturn();
        assertThat(login.getResponse().getHeader(HttpHeaders.SET_COOKIE)).contains("Max-Age=86400");

        String cleared = mvc.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent())
                .andReturn()
                .getResponse()
                .getHeader(HttpHeaders.SET_COOKIE);
        assertThat(cleared).startsWith("kts_session=").contains("Max-Age=0");
    }

    @Test
    void aDuplicateEmailIsAConflictEvenInAnotherCase() throws Exception {
        String email = register();

        call("/api/auth/register", email, PASSWORD)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("conflict"))
                .andExpect(jsonPath("$.message").value("An account with that email already exists."));
        call("/api/auth/register", email.toUpperCase(), PASSWORD).andExpect(status().isConflict());
    }

    @Test
    void wrongPasswordAndUnknownEmailLookIdentical() throws Exception {
        String email = register();

        String wrongPassword = call("/api/auth/login", email, "not-the-password")
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
        String unknownEmail = call("/api/auth/login", uniqueEmail(), PASSWORD)
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        assertThat(withoutTimestamp(wrongPassword))
                .isEqualTo(withoutTimestamp(unknownEmail))
                .containsEntry("error", "unauthorized")
                .containsEntry("message", "Email or password is incorrect.");
    }

    @Test
    void registerRejectsASevenCharacterPassword() throws Exception {
        call("/api/auth/register", uniqueEmail(), "1234567")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid"))
                .andExpect(jsonPath("$.message").value("password: size must be between 8 and 72"));
    }

    @Test
    void registerRejectsA73BytePassword() throws Exception {
        call("/api/auth/register", uniqueEmail(), "a".repeat(73)).andExpect(status().isBadRequest());
    }

    @Test
    void registerRejectsAShortPasswordThatIsOver72Bytes() throws Exception {
        // 37 characters, 74 bytes: passes @Size, and bcrypt would silently truncate it.
        call("/api/auth/register", uniqueEmail(), "é".repeat(37))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid"))
                .andExpect(jsonPath("$.message").value("password: must be at most 72 bytes"));
    }

    @Test
    void registerRejectsAMalformedEmail() throws Exception {
        call("/api/auth/register", "not-an-email", PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid"));
    }

    @Test
    void loginNeverRevealsPasswordRules() throws Exception {
        String email = register();
        call("/api/auth/login", email, "1234567").andExpect(status().isUnauthorized());
        call("/api/auth/login", email, "a".repeat(80)).andExpect(status().isUnauthorized());
    }

    @Test
    void meWithoutASessionIsUnauthorized() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Log in to continue."));
    }

    @Test
    void meWithATamperedTokenIsUnauthorized() throws Exception {
        String token = tokens.issue(UUID.randomUUID());
        mvc.perform(get("/api/auth/me").cookie(new Cookie(AuthCookies.NAME, AuthTestSupport.tampered(token, UUID.randomUUID()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meForADeletedAccountIsUnauthorized() throws Exception {
        UUID id = AuthTestSupport.createUser(users);
        Cookie session = AuthTestSupport.sessionFor(tokens, id);
        users.deleteById(id);

        mvc.perform(get("/api/auth/me").cookie(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Log in to continue."));
    }

    private String register() throws Exception {
        String email = uniqueEmail();
        call("/api/auth/register", email, PASSWORD).andExpect(status().isCreated());
        return email;
    }

    private ResultActions call(String path, String email, String password) throws Exception {
        return mvc.perform(post(path)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)));
    }

    private static Cookie sessionFrom(MvcResult result) {
        String header = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        return new Cookie(AuthCookies.NAME, header.substring(header.indexOf('=') + 1, header.indexOf(';')));
    }

    private static Map<String, Object> withoutTimestamp(String json) {
        Map<String, Object> body = JsonPath.parse(json).read("$");
        body.remove("at");
        return body;
    }

    private static String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }
}
