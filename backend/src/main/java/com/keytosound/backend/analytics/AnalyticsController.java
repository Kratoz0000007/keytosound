package com.keytosound.backend.analytics;

import com.keytosound.backend.composition.CompositionService;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Typing stats for one saved composition. Computed on every request rather
 * than stored, so they always follow the current rules. Ownership comes from
 * CompositionService: anyone else's composition is a 404.
 */
@RestController
@RequestMapping("/api/compositions")
public class AnalyticsController {

    private final CompositionService compositions;

    public AnalyticsController(CompositionService compositions) {
        this.compositions = compositions;
    }

    @GetMapping("/{id}/analytics")
    public Analytics analytics(@AuthenticationPrincipal UUID userId, @PathVariable UUID id) {
        return SessionAnalyzer.analyze(compositions.get(userId, id).keystrokes());
    }
}
