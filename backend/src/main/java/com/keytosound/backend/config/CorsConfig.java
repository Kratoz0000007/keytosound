package com.keytosound.backend.config;

import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * The frontend is served by Vite on 5173 while the API runs on 8080, so the
 * browser treats every call as cross-origin. Spring Security applies this
 * (a WebMvcConfigurer mapping would be ignored by the security chain).
 *
 * <p>localhost only. 127.0.0.1 is a different site to the browser, so the
 * SameSite session cookie set by localhost:8080 would never reach it.
 */
@Configuration
public class CorsConfig {

    /** The bean name matters: http.cors(withDefaults()) looks it up by name. */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "DELETE"));
        config.setAllowedHeaders(List.of("Content-Type"));
        // Without this the browser hides the header, and the download cannot
        // learn the file name the server chose.
        config.setExposedHeaders(List.of("Content-Disposition"));
        // The session cookie is a credential; without this the browser drops it.
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
