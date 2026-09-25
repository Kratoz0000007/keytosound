package com.keytosound.backend.composition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.keytosound.backend.ApiBodies;
import com.keytosound.backend.auth.AuthTestSupport;
import com.keytosound.backend.auth.TokenService;
import com.keytosound.backend.auth.UserAccountRepository;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class CompositionOwnershipTest {

    @Autowired private MockMvc mvc;
    @Autowired private TokenService tokens;
    @Autowired private UserAccountRepository users;
    @Autowired private CompositionRepository compositions;

    private UUID alice;
    private Cookie aliceSession;
    private Cookie bobSession;

    @BeforeEach
    void signIn() {
        alice = AuthTestSupport.createUser(users);
        aliceSession = AuthTestSupport.sessionFor(tokens, alice);
        bobSession = AuthTestSupport.sessionFor(tokens, AuthTestSupport.createUser(users));
    }

    @Test
    void aSavedCompositionBelongsToTheCaller() throws Exception {
        String id = saveAs(aliceSession);
        assertThat(compositions.findById(UUID.fromString(id)).orElseThrow().getUserId()).isEqualTo(alice);
    }

    @Test
    void anotherUsersCompositionIsNotFoundEverywhere() throws Exception {
        String id = saveAs(aliceSession);

        mvc.perform(get("/api/compositions/" + id).cookie(bobSession))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("not_found"));
        mvc.perform(delete("/api/compositions/" + id).cookie(bobSession))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/compositions/" + id + "/midi")
                        .cookie(bobSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ApiBodies.SCORE))
                .andExpect(status().isNotFound());

        // Bob's delete must not have touched it.
        mvc.perform(get("/api/compositions/" + id).cookie(aliceSession)).andExpect(status().isOk());
    }

    @Test
    void theListHoldsOnlyTheCallersCompositions() throws Exception {
        String mine = saveAs(aliceSession);
        String theirs = saveAs(bobSession);

        mvc.perform(get("/api/compositions").cookie(aliceSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(mine)))
                .andExpect(jsonPath("$[*].id", not(hasItem(theirs))));
    }

    @Test
    void deletingAUserDeletesTheirCompositions() throws Exception {
        UUID id = UUID.fromString(saveAs(aliceSession));

        users.deleteById(alice);

        assertThat(compositions.findById(id)).isEmpty();
    }

    private String saveAs(Cookie session) throws Exception {
        String body = mvc.perform(post("/api/compositions")
                        .cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ApiBodies.SAVE))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.id");
    }
}
