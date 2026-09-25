package com.keytosound.backend.config;

import com.keytosound.backend.auth.JwtCookieAuthenticationFilter;
import com.keytosound.backend.auth.TokenService;
import com.keytosound.backend.error.InvalidCredentialsException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * One stateless chain: no HTTP session, no JSESSIONID. The session cookie is
 * the only credential.
 *
 * <p>No CSRF token, because a forged request from another site is already
 * blocked twice. The SameSite=Lax cookie is not attached to a cross-site POST
 * or DELETE. And every mutating call sends Content-Type: application/json,
 * which forces a CORS preflight that fails for any origin outside the
 * allowlist. This holds only while the frontend and API share a site, i.e.
 * the same hostname (the browser ignores the port for this).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain apiSecurity(HttpSecurity http, TokenService tokens) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                // Picks up the corsConfigurationSource bean from CorsConfig.
                .cors(Customizer.withDefaults())
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login", "/api/auth/logout")
                        .permitAll()
                        // Boot forwards unhandled failures here. Guarding it would
                        // turn a 500 into a 401, which the frontend reads as "session expired".
                        .requestMatchers("/error")
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                .exceptionHandling(e -> e.authenticationEntryPoint(SecurityConfig::unauthorized))
                .addFilterBefore(new JwtCookieAuthenticationFilter(tokens), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** A 401 in the same {error, message, at} shape ApiExceptionHandler uses, never a redirect. */
    private static void unauthorized(
            HttpServletRequest request, HttpServletResponse response, AuthenticationException e) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"unauthorized\",\"message\":\"%s\",\"at\":\"%s\"}"
                .formatted(InvalidCredentialsException.NOT_LOGGED_IN, Instant.now()));
    }
}
