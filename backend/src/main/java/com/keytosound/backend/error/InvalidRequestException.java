package com.keytosound.backend.error;

/** A 400 for a rule Bean Validation cannot express, reported like a field error. */
public class InvalidRequestException extends RuntimeException {
    public InvalidRequestException(String message) {
        super(message);
    }
}
