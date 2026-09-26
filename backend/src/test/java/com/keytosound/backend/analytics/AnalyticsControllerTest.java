package com.keytosound.backend.analytics;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.keytosound.backend.auth.AuthTestSupport;
import com.keytosound.backend.auth.TokenService;
import com.keytosound.backend.auth.UserAccountRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
// Spring Boot 4 moved this out of boot.test.autoconfigure.web.servlet.
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class AnalyticsControllerTest {

    private static final String COMPOSITION =
            "{\"title\":\"hi\",\"genreId\":\"lofi\",\"seed\":1,\"settings\":{\"genreId\":\"lofi\"},"
                    + "\"keystrokes\":[{\"key\":\"h\",\"timestampMs\":0},{\"key\":\"i\",\"timestampMs\":100}]}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TokenService tokens;

    @Autowired
    private UserAccountRepository users;

    private Cookie session;

    @BeforeEach
    void signIn() {
        session = AuthTestSupport.sessionFor(tokens, AuthTestSupport.createUser(users));
    }

    private String save() throws Exception {
        String response = mockMvc.perform(post("/api/compositions")
                        .cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(COMPOSITION))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asString();
    }

    @Test
    void returnsTheStatsForTheOwner() throws Exception {
        String id = save();

        mockMvc.perform(get("/api/compositions/" + id + "/analytics").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.keyCount").value(2))
                .andExpect(jsonPath("$.summary.durationMs").value(100.0))
                .andExpect(jsonPath("$.rhythm.bands.length()").value(6))
                .andExpect(jsonPath("$.rhythm.medianGapMs").value(100.0))
                .andExpect(jsonPath("$.sentences[0].label").value("hi"))
                .andExpect(jsonPath("$.pauses.byKind.hesitation").value(0))
                .andExpect(jsonPath("$.pauses.segments[0].text").value("hi"))
                .andExpect(jsonPath("$.pauses.segments[0].pauseAfterMs").isEmpty())
                .andExpect(jsonPath("$.keys.top[0].key").value("h"))
                .andExpect(jsonPath("$.keys.drums").value(0));
    }

    @Test
    void anotherUsersCompositionIsNotFound() throws Exception {
        String id = save();
        Cookie stranger = AuthTestSupport.sessionFor(tokens, AuthTestSupport.createUser(users));

        mockMvc.perform(get("/api/compositions/" + id + "/analytics").cookie(stranger))
                .andExpect(status().isNotFound());
    }

    @Test
    void needsASession() throws Exception {
        String id = save();

        mockMvc.perform(get("/api/compositions/" + id + "/analytics"))
                .andExpect(status().isUnauthorized());
    }
}
