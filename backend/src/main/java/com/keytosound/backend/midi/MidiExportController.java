package com.keytosound.backend.midi;

import com.keytosound.backend.composition.CompositionService;
import com.keytosound.backend.composition.dto.CompositionDetail;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exports a saved composition as MIDI. The browser sends the rendered score,
 * because the engine that turns keystrokes into notes runs in the browser.
 *
 * <p>Deliberately no {@code produces = "audio/midi"}: it would make the 404
 * and 400 error bodies (JSON) unacceptable and turn them into 406s.
 */
@RestController
@RequestMapping("/api/compositions")
public class MidiExportController {

    private static final MediaType AUDIO_MIDI = MediaType.parseMediaType("audio/midi");

    private final CompositionService compositions;
    private final MidiWriter writer;

    public MidiExportController(CompositionService compositions, MidiWriter writer) {
        this.compositions = compositions;
        this.writer = writer;
    }

    @PostMapping("/{id}/midi")
    public ResponseEntity<byte[]> export(@PathVariable UUID id, @Valid @RequestBody Score score) {
        CompositionDetail composition = compositions.get(id);
        byte[] midi = writer.write(composition.title(), score);
        String filename = MidiFilenames.slug(composition.title()) + ".mid";
        return ResponseEntity.ok()
                .contentType(AUDIO_MIDI)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(midi);
    }
}
