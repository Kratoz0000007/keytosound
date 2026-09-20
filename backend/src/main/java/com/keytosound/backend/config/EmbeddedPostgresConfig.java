package com.keytosound.backend.config;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Runs a real PostgreSQL server as a child process. The target machine has
 * neither Docker nor an installed PostgreSQL, and this needs no admin rights.
 *
 * <p>It is genuinely PostgreSQL, not a compatibility layer, so jsonb, Flyway
 * migrations and PostgreSQL-specific SQL all behave exactly as they would in
 * production.
 *
 * <p>To use an installed or hosted PostgreSQL instead, run with the
 * {@code external-db} profile and supply {@code spring.datasource.url}.
 */
@Configuration
@Profile("!external-db")
public class EmbeddedPostgresConfig {

    @Bean(destroyMethod = "close")
    public EmbeddedPostgres embeddedPostgres() throws IOException {
        return EmbeddedPostgres.builder().start();
    }

    @Bean
    public DataSource dataSource(EmbeddedPostgres postgres) {
        return postgres.getPostgresDatabase();
    }
}
