package com.keytosound.backend.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.WebUtils;

/**
 * Turns a valid session cookie into an authenticated request. A missing or
 * bad token leaves the request anonymous, and the endpoint's rule decides:
 * 401 on a protected endpoint, and nothing changes on a public one.
 *
 * <p>Deliberately not a {@code @Component}. Boot would also register a
 * component filter with the servlet container, where it would run outside the
 * security chain.
 */
public class JwtCookieAuthenticationFilter extends OncePerRequestFilter {

    private final TokenService tokens;

    public JwtCookieAuthenticationFilter(TokenService tokens) {
        this.tokens = tokens;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Cookie cookie = WebUtils.getCookie(request, AuthCookies.NAME);
        if (cookie != null) {
            tokens.verify(cookie.getValue()).ifPresent(JwtCookieAuthenticationFilter::authenticate);
        }
        chain.doFilter(request, response);
    }

    private static void authenticate(UUID userId) {
        // The principal is the user id itself, so controllers take it as
        // @AuthenticationPrincipal UUID, and getName() is the id string.
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(userId, null, List.of()));
        SecurityContextHolder.setContext(context);
    }
}
