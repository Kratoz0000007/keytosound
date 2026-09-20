package com.keytosound.backend.composition;

import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
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
class CompositionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String KEYS =
            "[{\"key\":\"t\",\"timestampMs\":0},"
                    + "{\"key\":\"h\",\"timestampMs\":142.5},"
                    + "{\"key\":\"e\",\"timestampMs\":290}]";

    /**
     * Built by formatting rather than by string-replacing a text block: a
     * replace has to match the block's exact indentation, which silently stops
     * matching the moment anyone reformats the file.
     */
    private static String body(String title, String keystrokesJson) {
        return "{\"title\":\"%s\",\"genreId\":\"lofi\",\"seed\":20260919,"
                        .formatted(title)
                + "\"settings\":{\"genreId\":\"lofi\"},\"keystrokes\":%s}".formatted(keystrokesJson);
    }

    private static final String VALID = body("the quick brown fox", KEYS);

    private String saveAndReturnId() throws Exception {
        String response = mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asString();
    }

    @Test
    void savesACompositionAndReturnsItsLocation() throws Exception {
        mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.keystrokes", hasSize(3)))
                .andExpect(jsonPath("$.keystrokes[1].timestampMs").value(142.5));
    }

    @Test
    void loadsASavedComposition() throws Exception {
        String id = saveAndReturnId();

        mockMvc.perform(get("/api/compositions/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seed").value(20260919))
                .andExpect(jsonPath("$.settings.genreId").value("lofi"))
                .andExpect(jsonPath("$.keystrokes", hasSize(3)));
    }

    @Test
    void listsSavedCompositions() throws Exception {
        saveAndReturnId();

        mockMvc.perform(get("/api/compositions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].keystrokeCount").value(greaterThan(0)));
    }

    @Test
    void deletesAComposition() throws Exception {
        String id = saveAndReturnId();

        mockMvc.perform(delete("/api/compositions/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/compositions/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void returns404ForAnUnknownComposition() throws Exception {
        mockMvc.perform(get("/api/compositions/" + UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsACompositionWithNoKeystrokes() throws Exception {
        mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("empty", "[]")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsABlankTitle() throws Exception {
        mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("", KEYS)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAKeystrokeWithNoKey() throws Exception {
        mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("blank key", "[{\"key\":\"\",\"timestampMs\":0}]")))
                .andExpect(status().isBadRequest());
    }
}
