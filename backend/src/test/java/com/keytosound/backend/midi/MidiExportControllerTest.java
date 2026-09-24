package com.keytosound.backend.midi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
class MidiExportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String COMPOSITION =
            "{\"title\":\"Rain at Night!\",\"genreId\":\"lofi\",\"seed\":1,"
                    + "\"settings\":{\"genreId\":\"lofi\"},"
                    + "\"keystrokes\":[{\"key\":\"a\",\"timestampMs\":0}]}";

    private static String score(int pitch, String voice) {
        return ("{\"bpm\":75,\"leadInstrument\":\"electricPiano\","
                        + "\"lead\":[{\"pitch\":%d,\"start\":0.4,\"duration\":0.3,\"velocity\":0.7}],"
                        + "\"pad\":[{\"pitch\":57,\"start\":0,\"duration\":3.2,\"velocity\":0.5}],"
                        + "\"bass\":[],"
                        + "\"drums\":[{\"voice\":\"%s\",\"start\":0,\"velocity\":0.8}]}")
                .formatted(pitch, voice);
    }

    private String saveComposition() throws Exception {
        String response = mockMvc.perform(post("/api/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(COMPOSITION))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asString();
    }

    @Test
    void returnsAMidiFileNamedAfterTheTitle() throws Exception {
        String id = saveComposition();
        byte[] body = mockMvc.perform(post("/api/compositions/" + id + "/midi")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(score(69, "kick")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "audio/midi"))
                .andExpect(header().string("Content-Disposition",
                        containsString("filename=\"rain-at-night.mid\"")))
                .andReturn()
                .getResponse()
                .getContentAsByteArray();
        // Every Standard MIDI File starts with the "MThd" header chunk.
        assertThat(new String(body, 0, 4, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("MThd");
    }

    @Test
    void returns404ForAnUnknownComposition() throws Exception {
        mockMvc.perform(post("/api/compositions/" + UUID.randomUUID() + "/midi")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(score(69, "kick")))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsAPitchOutsideTheMidiRange() throws Exception {
        String id = saveComposition();
        mockMvc.perform(post("/api/compositions/" + id + "/midi")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(score(200, "kick")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAnUnknownDrumVoice() throws Exception {
        String id = saveComposition();
        mockMvc.perform(post("/api/compositions/" + id + "/midi")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(score(69, "cowbell")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAnAbsurdlyLargeStart() throws Exception {
        String id = saveComposition();
        String body = "{\"bpm\":75,\"leadInstrument\":\"electricPiano\","
                + "\"lead\":[{\"pitch\":69,\"start\":1e300,\"duration\":0.3,\"velocity\":0.7}],"
                + "\"pad\":[],\"bass\":[],\"drums\":[]}";
        mockMvc.perform(post("/api/compositions/" + id + "/midi")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void letsTheBrowserReadTheFileName() throws Exception {
        String id = saveComposition();
        mockMvc.perform(post("/api/compositions/" + id + "/midi")
                        .header("Origin", "http://localhost:5173")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(score(69, "kick")))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Expose-Headers",
                        containsString("Content-Disposition")));
    }
}
