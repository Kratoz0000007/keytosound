package com.keytosound.backend.auth;

import com.keytosound.backend.auth.dto.LoginRequest;
import com.keytosound.backend.auth.dto.RegisterRequest;
import com.keytosound.backend.auth.dto.UserView;
import com.keytosound.backend.error.ConflictException;
import com.keytosound.backend.error.InvalidCredentialsException;
import com.keytosound.backend.error.InvalidRequestException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Accounts. Free of web and cookie types; AuthController turns results into HTTP. */
@Service
public class AuthService {

    /** bcrypt ignores everything past 72 bytes, so a longer password is rejected rather than truncated. */
    static final int MAX_PASSWORD_BYTES = 72;

    private final UserAccountRepository users;
    private final PasswordEncoder passwords;
    /** Compared against when the email is unknown, so that path costs one bcrypt run too. */
    private final String dummyHash;

    public AuthService(UserAccountRepository users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
        this.dummyHash = passwords.encode("timing-equaliser-not-a-real-password");
    }

    @Transactional
    public UserView register(RegisterRequest request) {
        if (!fitsBcrypt(request.password())) {
            throw new InvalidRequestException("password: must be at most " + MAX_PASSWORD_BYTES + " bytes");
        }
        String email = normalise(request.email());
        if (users.existsByEmail(email)) {
            throw new ConflictException("An account with that email already exists.");
        }
        return view(users.save(new UserAccount(email, passwords.encode(request.password()))));
    }

    /**
     * Exactly one bcrypt comparison on every path. Otherwise "no such email"
     * returns measurably faster than "wrong password" and reveals which emails
     * are registered.
     */
    @Transactional(readOnly = true)
    public UserView login(LoginRequest request) {
        Optional<UserAccount> user = users.findByEmail(normalise(request.email()));
        boolean fits = fitsBcrypt(request.password());
        // Spring's bcrypt throws on input over 72 bytes; such a password can never match anyway.
        boolean matches = passwords.matches(
                fits ? request.password() : "", user.map(UserAccount::getPasswordHash).orElse(dummyHash));
        if (user.isEmpty() || !fits || !matches) {
            throw InvalidCredentialsException.wrongEmailOrPassword();
        }
        return view(user.get());
    }

    /** A valid token for a deleted account is treated exactly like an expired one. */
    @Transactional(readOnly = true)
    public UserView me(UUID userId) {
        return users.findById(userId).map(AuthService::view).orElseThrow(InvalidCredentialsException::notLoggedIn);
    }

    static String normalise(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean fitsBcrypt(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length <= MAX_PASSWORD_BYTES;
    }

    private static UserView view(UserAccount user) {
        return new UserView(user.getId(), user.getEmail());
    }
}
