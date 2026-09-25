package com.keytosound.backend.error;

/**
 * A 401. Our own type rather than Spring Security's BadCredentialsException,
 * so ApiExceptionHandler never catches a framework-internal failure by accident.
 */
public class InvalidCredentialsException extends RuntimeException {

    public static final String NOT_LOGGED_IN = "Log in to continue.";
    public static final String WRONG_EMAIL_OR_PASSWORD = "Email or password is incorrect.";

    private InvalidCredentialsException(String message) {
        super(message);
    }

    /** Wrong password and unknown email share this, byte for byte. */
    public static InvalidCredentialsException wrongEmailOrPassword() {
        return new InvalidCredentialsException(WRONG_EMAIL_OR_PASSWORD);
    }

    /** A valid token for an account that no longer exists: treated like an expired token. */
    public static InvalidCredentialsException notLoggedIn() {
        return new InvalidCredentialsException(NOT_LOGGED_IN);
    }
}
