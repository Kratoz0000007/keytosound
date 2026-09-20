package com.keytosound.backend.composition;

import com.keytosound.backend.composition.dto.CompositionDetail;
import com.keytosound.backend.composition.dto.CompositionSummary;
import com.keytosound.backend.composition.dto.SaveCompositionRequest;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP only. All behaviour lives in CompositionService so it can be tested
 * without standing up a web layer.
 */
@RestController
@RequestMapping("/api/compositions")
public class CompositionController {

    private final CompositionService service;

    public CompositionController(CompositionService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<CompositionDetail> save(@Valid @RequestBody SaveCompositionRequest request) {
        CompositionDetail saved = service.save(request);
        return ResponseEntity.created(URI.create("/api/compositions/" + saved.id())).body(saved);
    }

    @GetMapping
    public List<CompositionSummary> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public CompositionDetail get(@PathVariable UUID id) {
        return service.get(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
