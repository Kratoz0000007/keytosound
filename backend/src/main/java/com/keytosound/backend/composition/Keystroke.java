package com.keytosound.backend.composition;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;

/** One keypress. Thousands of these belong to a single composition. */
@Entity
@Table(name = "keystrokes")
public class Keystroke {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "keystroke_gen")
    @SequenceGenerator(name = "keystroke_gen", sequenceName = "keystroke_seq", allocationSize = 50)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "composition_id", nullable = false)
    private Composition composition;

    @Column(nullable = false)
    private int ordinal;

    @Column(name = "key_value", nullable = false, length = 16)
    private String keyValue;

    @Column(name = "timestamp_ms", nullable = false)
    private double timestampMs;

    protected Keystroke() {
        // required by JPA
    }

    public Keystroke(int ordinal, String keyValue, double timestampMs) {
        this.ordinal = ordinal;
        this.keyValue = keyValue;
        this.timestampMs = timestampMs;
    }

    void setComposition(Composition composition) {
        this.composition = composition;
    }

    public Long getId() {
        return id;
    }

    public int getOrdinal() {
        return ordinal;
    }

    public String getKeyValue() {
        return keyValue;
    }

    public double getTimestampMs() {
        return timestampMs;
    }
}
