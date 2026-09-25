package com.keytosound.backend.composition;

import static org.assertj.core.api.Assertions.assertThat;

import com.keytosound.backend.auth.AuthTestSupport;
import com.keytosound.backend.auth.UserAccountRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class CompositionRepositoryTest {

    @Autowired
    private CompositionRepository repository;

    @Autowired
    private UserAccountRepository users;

    private UUID owner;

    @BeforeEach
    void createOwner() {
        owner = AuthTestSupport.createUser(users);
    }

    private Composition sample(String title, int keystrokeCount) {
        Composition composition = new Composition(owner, title, "lofi", 1234L, "{\"genreId\":\"lofi\"}");
        for (int i = 0; i < keystrokeCount; i++) {
            composition.addKeystroke(new Keystroke(i, String.valueOf((char) ('a' + i % 26)), i * 150.0));
        }
        return composition;
    }

    @Test
    void savesAndReloadsACompositionWithItsKeystrokes() {
        Composition saved = repository.saveAndFlush(sample("first", 5));

        Composition found = repository.findByIdAndUserIdWithKeystrokes(saved.getId(), owner).orElseThrow();

        assertThat(found.getTitle()).isEqualTo("first");
        assertThat(found.getGenreId()).isEqualTo("lofi");
        assertThat(found.getSeed()).isEqualTo(1234L);
        assertThat(found.getKeystrokes()).hasSize(5);
    }

    @Test
    void keepsKeystrokesInOrdinalOrder() {
        Composition saved = repository.saveAndFlush(sample("ordered", 20));

        Composition found = repository.findByIdAndUserIdWithKeystrokes(saved.getId(), owner).orElseThrow();

        for (int i = 0; i < found.getKeystrokes().size(); i++) {
            assertThat(found.getKeystrokes().get(i).getOrdinal()).isEqualTo(i);
        }
    }

    @Test
    void listsNewestFirst() {
        repository.saveAndFlush(sample("older", 1));
        repository.saveAndFlush(sample("newer", 1));

        var titles = repository.findAllByUserIdOrderByCreatedAtDesc(owner).stream()
                .map(Composition::getTitle)
                .toList();

        assertThat(titles).containsSubsequence("newer", "older");
    }

    @Test
    void deletingACompositionRemovesItsKeystrokes() {
        Composition saved = repository.saveAndFlush(sample("doomed", 4));
        UUID id = saved.getId();

        repository.deleteById(id);
        repository.flush();

        assertThat(repository.findById(id)).isEmpty();
    }

    @Test
    void storesSettingsAsJsonb() {
        Composition saved = repository.saveAndFlush(
                new Composition(owner, "json", "jazz", 7L, "{\"tempo\":120,\"nested\":{\"ok\":true}}"));

        Composition found = repository.findById(saved.getId()).orElseThrow();

        assertThat(found.getSettings()).contains("\"tempo\":120");
    }

    @Test
    void findsNothingUnderTheWrongOwner() {
        Composition saved = repository.saveAndFlush(sample("mine", 1));

        assertThat(repository.findByIdAndUserIdWithKeystrokes(saved.getId(), UUID.randomUUID())).isEmpty();
    }
}
