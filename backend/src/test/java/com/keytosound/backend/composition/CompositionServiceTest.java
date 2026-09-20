package com.keytosound.backend.composition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import tools.jackson.databind.ObjectMapper;
import com.keytosound.backend.composition.dto.CompositionDetail;
import com.keytosound.backend.composition.dto.CompositionSummary;
import com.keytosound.backend.composition.dto.KeystrokeDto;
import com.keytosound.backend.composition.dto.SaveCompositionRequest;
import com.keytosound.backend.error.NotFoundException;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class CompositionServiceTest {

    @Autowired
    private CompositionService service;

    @Autowired
    private ObjectMapper objectMapper;

    private SaveCompositionRequest request(String title, int keystrokes) throws Exception {
        List<KeystrokeDto> keys = IntStream.range(0, keystrokes)
                .mapToObj(i -> new KeystrokeDto(String.valueOf((char) ('a' + i % 26)), i * 137.0))
                .toList();
        return new SaveCompositionRequest(
                title, "lofi", 4242L, objectMapper.readTree("{\"genreId\":\"lofi\"}"), keys);
    }

    @Test
    void savesAndReturnsTheStoredComposition() throws Exception {
        CompositionDetail saved = service.save(request("hello world", 12));

        assertThat(saved.id()).isNotNull();
        assertThat(saved.title()).isEqualTo("hello world");
        assertThat(saved.seed()).isEqualTo(4242L);
        assertThat(saved.keystrokes()).hasSize(12);
    }

    @Test
    void roundTripsTheKeystrokeStreamExactly() throws Exception {
        SaveCompositionRequest req = request("exact", 200);

        CompositionDetail loaded = service.get(service.save(req).id());

        // The determinism contract depends on this being exact: a lost or
        // reordered keystroke produces different music on replay.
        assertThat(loaded.keystrokes()).isEqualTo(req.keystrokes());
    }

    @Test
    void preservesSettingsJsonVerbatim() throws Exception {
        var settings = objectMapper.readTree("{\"genreId\":\"jazz\",\"nested\":{\"a\":[1,2,3]}}");
        var req = new SaveCompositionRequest(
                "json", "jazz", 9L, settings, List.of(new KeystrokeDto("x", 0.0)));

        CompositionDetail loaded = service.get(service.save(req).id());

        assertThat(loaded.settings()).isEqualTo(settings);
    }

    @Test
    void listsSummariesWithKeystrokeCounts() throws Exception {
        service.save(request("counted", 7));

        List<CompositionSummary> all = service.list();

        assertThat(all).isNotEmpty();
        assertThat(all.get(0).keystrokeCount()).isPositive();
    }

    @Test
    void deletesAComposition() throws Exception {
        UUID id = service.save(request("doomed", 3)).id();

        service.delete(id);

        assertThatThrownBy(() -> service.get(id)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void reportsMissingCompositions() {
        assertThatThrownBy(() -> service.get(UUID.randomUUID())).isInstanceOf(NotFoundException.class);
    }

    @Test
    void rejectsDeletingSomethingThatIsNotThere() {
        assertThatThrownBy(() -> service.delete(UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
    }
}
