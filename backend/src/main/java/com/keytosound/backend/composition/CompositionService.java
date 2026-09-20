package com.keytosound.backend.composition;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.keytosound.backend.composition.dto.CompositionDetail;
import com.keytosound.backend.composition.dto.CompositionSummary;
import com.keytosound.backend.composition.dto.KeystrokeDto;
import com.keytosound.backend.composition.dto.SaveCompositionRequest;
import com.keytosound.backend.error.NotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** All composition behaviour lives here, so it is testable without a web layer. */
@Service
public class CompositionService {

    private final CompositionRepository repository;
    private final ObjectMapper objectMapper;

    public CompositionService(CompositionRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public CompositionDetail save(SaveCompositionRequest request) {
        Composition composition = new Composition(
                request.title(), request.genreId(), request.seed(), writeJson(request.settings()));

        List<KeystrokeDto> keys = request.keystrokes();
        for (int i = 0; i < keys.size(); i++) {
            composition.addKeystroke(new Keystroke(i, keys.get(i).key(), keys.get(i).timestampMs()));
        }

        return toDetail(repository.save(composition));
    }

    @Transactional(readOnly = true)
    public List<CompositionSummary> list() {
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .map(c -> new CompositionSummary(
                        c.getId(), c.getTitle(), c.getGenreId(), c.getKeystrokes().size(), c.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public CompositionDetail get(UUID id) {
        return repository
                .findByIdWithKeystrokes(id)
                .map(this::toDetail)
                .orElseThrow(() -> new NotFoundException("No composition " + id));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new NotFoundException("No composition " + id);
        }
        repository.deleteById(id);
    }

    private CompositionDetail toDetail(Composition composition) {
        List<KeystrokeDto> keys = composition.getKeystrokes().stream()
                .map(k -> new KeystrokeDto(k.getKeyValue(), k.getTimestampMs()))
                .toList();
        return new CompositionDetail(
                composition.getId(),
                composition.getTitle(),
                composition.getGenreId(),
                composition.getSeed(),
                readJson(composition.getSettings()),
                keys,
                composition.getCreatedAt());
    }

    // Jackson 3 made its exceptions unchecked, so these catches are for
    // translating the failure into something meaningful rather than because
    // the compiler demands them.
    private String writeJson(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JacksonException e) {
            throw new IllegalArgumentException("settings is not serialisable JSON", e);
        }
    }

    private JsonNode readJson(String raw) {
        try {
            return objectMapper.readTree(raw);
        } catch (JacksonException e) {
            throw new IllegalStateException("stored settings is not valid JSON", e);
        }
    }
}
