package com.keytosound.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * The frontend is served by Vite on 5173 while the API runs on 8080, so the
 * browser treats every call as cross-origin. Scoped to localhost only.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:5173", "http://127.0.0.1:5173")
                .allowedMethods("GET", "POST", "DELETE")
                .allowedHeaders("Content-Type")
                // Without this the browser hides the header, and the download
                // cannot learn the file name the server chose.
                .exposedHeaders("Content-Disposition");
    }
}
