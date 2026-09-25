package com.keytosound.backend.composition;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompositionRepository extends JpaRepository<Composition, UUID> {

    List<Composition> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

    /**
     * Owner-scoped, so "no such id" and "not yours" are the same empty result.
     * Fetches the keystrokes in the same query; without that, loading a
     * composition for replay issues a second query.
     */
    @Query("SELECT c FROM Composition c LEFT JOIN FETCH c.keystrokes WHERE c.id = :id AND c.userId = :userId")
    Optional<Composition> findByIdAndUserIdWithKeystrokes(@Param("id") UUID id, @Param("userId") UUID userId);
}
