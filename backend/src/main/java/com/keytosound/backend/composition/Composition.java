package com.keytosound.backend.composition;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A saved performance, stored as the input that produced it rather than as
 * audio or notes. Because the engine is deterministic, the keystroke stream
 * plus the seed regenerates the identical music for kilobytes instead of
 * megabytes.
 */
@Entity
@Table(name = "compositions")
public class Composition {

    @Id
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "genre_id", nullable = false, length = 32)
    private String genreId;

    @Column(nullable = false)
    private long seed;

    /**
     * The engine's settings object, stored verbatim as jsonb. The backend
     * deliberately does not model its shape: the frontend engine types are the
     * source of truth, and mirroring them in Java would guarantee drift.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String settings;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @OneToMany(
            mappedBy = "composition",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY)
    @OrderBy("ordinal ASC")
    private List<Keystroke> keystrokes = new ArrayList<>();

    protected Composition() {
        // required by JPA
    }

    public Composition(String title, String genreId, long seed, String settings) {
        this.id = UUID.randomUUID();
        this.title = title;
        this.genreId = genreId;
        this.seed = seed;
        this.settings = settings;
        this.createdAt = Instant.now();
    }

    public void addKeystroke(Keystroke keystroke) {
        keystroke.setComposition(this);
        this.keystrokes.add(keystroke);
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getTitle() {
        return title;
    }

    public String getGenreId() {
        return genreId;
    }

    public long getSeed() {
        return seed;
    }

    public String getSettings() {
        return settings;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<Keystroke> getKeystrokes() {
        return keystrokes;
    }
}
