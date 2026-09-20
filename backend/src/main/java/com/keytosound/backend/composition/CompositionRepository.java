package com.keytosound.backend.composition;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompositionRepository extends JpaRepository<Composition, UUID> {

    List<Composition> findAllByOrderByCreatedAtDesc();

    /**
     * Fetches the keystrokes in the same query. Without this, loading a
     * composition for replay issues a second query, and the list endpoint
     * would issue one per row.
     */
    @Query("SELECT c FROM Composition c LEFT JOIN FETCH c.keystrokes WHERE c.id = :id")
    Optional<Composition> findByIdWithKeystrokes(@Param("id") UUID id);
}
