# Accounts (Plan 3b) — Design

**Status:** approved in brainstorming, 2026-09-24
**Parent spec:** `2026-09-19-typing-to-music-design.md` §2 ("Accounts: Email + password"; "JWT; no refresh-token rotation, no email verification") and §6 item 4 ("Auth and composition persistence. Deliberately lean.")
**Plan 3 split:** 3a MIDI export (done) → 3b accounts (this) → 3c analytics.

## 1. Goal

Each saved composition belongs to an account. Anyone can open the app and play. Saving, the library and MIDI export need a login, and you only ever see your own compositions.

## 2. Decisions

| Question | Decision | Why |
|---|---|---|
| What needs a login? | **Play free, log in to save.** Typing, music and the beat editor stay open. Save, list, load, delete and export require an account. | A grader or recruiter can open the link and hear it immediately. The library is what needs an owner. |
| Where does the browser keep the token? | **An `HttpOnly` cookie** | Page JavaScript can never read it, so an injected script cannot steal it. |
| What happens to existing ownerless compositions? | **The migration deletes them** | They are throwaway dev saves. Keeping them would leave a nullable column and a dead code path forever. |
| Credentials | Email + password (parent spec) | User requirement, chosen over share links. |
| Token lifetime | 24h, no refresh token (parent spec) | Expiry means logging in again. |
| CSRF token | **None.** See §5. | `SameSite=Lax` plus a strict CORS allowlist already block cross-site requests. |

## 3. Schema — `V2__users.sql`

```sql
CREATE TABLE users (
    id            UUID         PRIMARY KEY,
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_users_email ON users (lower(email));

DELETE FROM compositions WHERE user_id IS NULL;
ALTER TABLE compositions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE compositions ADD CONSTRAINT fk_compositions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
CREATE INDEX idx_compositions_user_created ON compositions (user_id, created_at DESC);
```

- Email is lowercased (and trimmed) before it is stored. The `lower(email)` unique index is a second line of defence against a code path that skips that step.
- `password_hash` is 100 characters, not bcrypt's 60, because the hash carries its algorithm prefix (`{bcrypt}$2a$10$…`). That prefix is what lets a later algorithm change happen without a data migration.
- Deleting a user cascades to their compositions, which already cascade to keystrokes.
- `V1`'s comment promised this: adding the FK is a pure `ALTER`.

## 4. Tokens

**Dependencies:** `spring-boot-starter-security` and `org.springframework.security:spring-security-oauth2-jose`, both version-managed by the Boot 4.1.1 BOM. The second is there only for Nimbus, the JWT library Spring itself uses. Nimbus has **no Jackson dependency**, so it cannot collide with Boot 4's Jackson 3 (`tools.jackson.*`). jjwt and java-jwt both bring in Jackson 2 and are rejected for that reason. No resource-server starter is used.

**Signing:** HS256 with a secret from `keytosound.auth.secret`, which must be at least 32 bytes. `application-dev.yml` supplies a dev-only value, and tests supply their own. With no secret configured, the app **fails at startup** rather than running with a guessable key.

**Claims:**

| Claim | Value |
|---|---|
| `sub` | user id |
| `iss` | `keytosound` |
| `iat` | issue time |
| `exp` | `iat` + 24h |

Beans come from `NimbusJwtEncoder` and `NimbusJwtDecoder`, and the decoder validates the signature, `exp` and `iss`.

**Password hashing:** `PasswordEncoderFactories.createDelegatingPasswordEncoder()`, which uses bcrypt.

**The cookie, `kts_session`:**

| Attribute | Value |
|---|---|
| `HttpOnly` | set |
| `SameSite` | `Lax` |
| `Path` | `/` |
| `Max-Age` | 86400 |
| `Secure` | from `keytosound.auth.cookie-secure` (`false` in dev, `true` by default) |

Logout sends the same cookie with `Max-Age=0`.

**`JwtCookieAuthenticationFilter`** (a `OncePerRequestFilter`) runs on every request:
- With no cookie, it does nothing.
- With a cookie, it decodes the token via `JwtDecoder` and sets an authenticated principal whose name is the user id.
- If decoding fails (tampered, expired or wrong issuer), it leaves the request unauthenticated. The endpoint's rule then decides the response: 401 on a protected endpoint, and nothing changes on a public one.

## 5. Security configuration, CORS and CSRF

`SecurityConfig` builds one stateless `SecurityFilterChain`:

- `sessionManagement` is `STATELESS`. There is no HTTP session and no `JSESSIONID`.
- **Public:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`.
- **Authenticated:** everything else under `/api/**`, including `GET /api/auth/me` and every `/api/compositions` endpoint.
- An unauthenticated request to an authenticated endpoint gets **401** (never a redirect or a login page). The body is `{ "error": "unauthorized", "message": "Log in to continue.", "at": … }`, the same shape `ApiExceptionHandler` already uses.
- CSRF protection is disabled, for the reasons below.

**CORS moves into Spring Security.** Spring Security does not read the current `CorsConfig implements WebMvcConfigurer`. It becomes a `CorsConfigurationSource` bean:
- origin `http://localhost:5173` only
- methods `GET`, `POST`, `DELETE`
- header `Content-Type`
- exposed header `Content-Disposition`
- **`allowCredentials(true)`**

**`http://127.0.0.1:5173` is dropped from the allowlist.** Browsers treat `127.0.0.1` and `localhost` as different sites, so a `SameSite=Lax` cookie set by `localhost:8080` never goes to a page on `127.0.0.1`. You use `localhost`.

**Why this works on plain `http://localhost`.** A browser decides "same site" by hostname and ignores the port. So `localhost:5173` → `localhost:8080` is same-site, and the `Lax` cookie is sent. It is still cross-origin, which is why credentialed CORS is needed.

**Why there is no CSRF token.** A forged request from another site is blocked twice:
1. The `SameSite=Lax` cookie is not attached to a cross-site `POST` or `DELETE`.
2. Every mutating call sends `Content-Type: application/json`, which forces a CORS preflight, and the preflight fails for any origin outside the allowlist.

This only holds while the frontend and API share a site. A deployment that splits them across domains would need `SameSite=None; Secure` and a CSRF token (§10).

## 6. API

```
POST   /api/auth/register   {email, password} -> 201 {id, email} + cookie
POST   /api/auth/login      {email, password} -> 200 {id, email} + cookie
POST   /api/auth/logout                       -> 204, cookie cleared
GET    /api/auth/me                           -> 200 {id, email} | 401
```

- Registering logs the new user straight in.
- Page JavaScript cannot read an `HttpOnly` cookie, so `/me` is the only way the app can learn, on load, whether the user is still logged in.

**Validation.** `RegisterRequest` uses the rules below. `LoginRequest` only requires both fields `@NotBlank`, so a short or malformed attempt gets the same 401 as any other failed login:
- `email`: `@NotBlank @Email @Size(max = 254)`
- `password`: `@NotBlank @Size(min = 8, max = 72)`

Bcrypt silently ignores input past 72 **bytes**, so a longer password is **rejected rather than quietly truncated**. `@Size` counts characters, not bytes, so `AuthService.register` also rejects a password whose UTF-8 encoding exceeds 72 bytes (400, `password: must be at most 72 bytes`). Login applies no length check, so it can never reveal anything about stored passwords.

**Composition endpoints now take an owner.** The existing endpoints keep their paths and bodies.
- Each controller reads the user id from the security context and passes it into `CompositionService`: `save(userId, request)`, `list(userId)`, `get(userId, id)`, `delete(userId, id)`. The service stays free of web and Spring Security types, as its class comment requires.
- `MidiExportController` calls `get(userId, id)`.
- `CompositionRepository` gains:
  - `findAllByUserIdOrderByCreatedAtDesc`
  - an owner-scoped `findByIdAndUserIdWithKeystrokes`
  - no new delete method: `delete(userId, id)` does the owner-scoped find (404 if absent or not owned), then deletes that entity

**Ownership rule: a composition that exists but belongs to another user is a 404, never a 403.** A 403 would confirm the id exists. The same `NotFoundException` is used for both "no such id" and "not yours".

**`/api/auth/me` returns 401 for a user id that no longer exists.** That happens when the token is valid but the account was deleted, so the frontend treats it exactly like an expired token.

## 7. Errors

| Case | Status | `message` |
|---|---|---|
| Register: invalid email, or password shorter than 8 or longer than 72 bytes | 400 | The first field error, e.g. `password: size must be between 8 and 72` |
| Wrong password, **or** unknown email | 401 | `Email or password is incorrect.`, byte-identical in both cases |
| Email already registered (any case) | 409 | `An account with that email already exists.` |
| Not logged in, token expired or tampered | 401 | `Log in to continue.` |

`ApiExceptionHandler` gains handlers for:
- `MethodArgumentNotValidException` → 400 `invalid`
- a new `ConflictException` → 409 `conflict`
- a new `InvalidCredentialsException` in `error/` → 401 `unauthorized` (our own class, not Spring Security's `BadCredentialsException`, so the handler never catches framework-internal failures)

All three use the existing `{error, message, at}` shape.

**Timing leak on login.** An unknown email must still run one bcrypt comparison against a fixed dummy hash. Otherwise "no such user" returns measurably faster than "wrong password" and reveals which emails are registered.

## 8. Frontend

**New files:**
- **`session/auth.ts`**: `register(email, password)`, `login(email, password)`, `logout()` and `me()`. Every call sends `credentials: 'include'`. Failures throw the existing `ApiError`.
- **`ui/useAuth.ts`**: a hook holding `{ user: {id, email} | null, status: 'loading' | 'in' | 'out' }`.
  - It calls `me()` once on mount. 200 means `in`. 401 means `out`. A network failure also means `out`, and the existing "backend isn't running" message is kept.
  - It exposes `login`, `register`, `logout`, and `expire()`, which switches to `out` without a network call.
- **`ui/AuthPanel.tsx`**: an email and password form that toggles between **Log in** and **Create account**. The server's `message` shows inline, and the submit button is disabled while a request is in flight. **White background**, like the rest of the app.

**Changes:**
- **`session/api.ts`**: `request()` and `exportMidi` send `credentials: 'include'`.
- **`ui/TypingSurface.tsx`**: typing, playback and the beat editor work in every auth state.
  - While `loading`, the save area renders nothing.
  - While `out`, it shows a **Log in to save** button that opens `AuthPanel`.
  - While `in`, it shows today's Save, Library and Export controls, plus `Signed in as <email> · Log out`.
  - `CompositionList` only renders while `in`.

**When the session expires.** Any compositions or export call that fails with `ApiError` status 401 calls `expire()` and opens `AuthPanel`. **The current unsaved recording is kept**, so the user can log back in and save what they just typed. An expired token must never silently discard a performance.

## 9. Testing

**Backend** (MockMvc, embedded Postgres, as today):
- Register returns 201, sets an `HttpOnly` `SameSite=Lax` cookie, and `/me` then returns the user.
- Login returns 200 and sets the cookie. Logout returns 204 and sets `Max-Age=0`.
- Registering a duplicate email returns 409, including a duplicate that differs only in case (`A@x.com` after `a@x.com`).
- A wrong password and an unknown email return **identical** 401 bodies (ignoring `at`).
- Register with a 7-character password, a 73-byte password, a 72-character password that is over 72 bytes (e.g. multibyte characters), or a malformed email returns 400. Login with a 7-character password returns 401, not 400.
- A tampered token, an expired token and a wrong-issuer token each return 401 on `/me`.
- Every `/api/compositions` endpoint, including `/{id}/midi`, returns 401 when logged out.
- **User B gets a 404 for user A's composition** on GET, DELETE and `POST /{id}/midi`, and A's composition still exists afterward.
- `list` returns only the caller's compositions.
- **Migration:** an ownerless composition present before `V2` is gone afterward. After `V2`, `user_id` is `NOT NULL` and the FK rejects an unknown user id.
- The existing `CompositionControllerTest` and `MidiExportControllerTest` are updated to authenticate. A shared test helper registers a user and returns the cookie. Their assertions are otherwise unchanged.

**Frontend** (Vitest):
- `auth.ts`: request method, path and body, and `credentials: 'include'` on every call.
- `api.ts`: `credentials: 'include'` on `request()` and `exportMidi`.
- `useAuth`: mount with 200 → `in`, with 401 → `out`, with a network error → `out`. `logout` → `out`.
- A 401 from save or export → `out`, with the panel open and the recording still present.
- `TypingSurface`: shows the right save area for `out` and `in`, and typing still produces notes while `out`.
- The purity test is unaffected. `auth.ts` sits beside `api.ts` in `session/`, and the purity test covers only `engine/`, `typing/` and `session/score.ts`.

## 10. Out of scope, and known gaps

**Not built:**
- password reset or change
- email verification
- refresh tokens and remember-me
- account deletion UI
- roles and admin
- OAuth providers

**Known gaps:** each is deliberate and written down rather than hidden.
- **No rate limiting on login.** Password guessing is unmitigated. Any public deployment would need it first.
- **Register reveals whether an email is registered**, through its 409. This can't be avoided without the email verification the parent spec excluded.
- **Same-site deployment assumed.** Splitting frontend and API across domains needs `SameSite=None; Secure` and a CSRF token (§5).
- **The token cannot be revoked before it expires.** Logout clears the browser's cookie, but a copied token stays valid for the rest of its 24h. That is inherent to stateless JWT without a denylist.
