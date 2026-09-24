package com.keytosound.backend.config;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
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
 *
 * <p>By default the database lives in a temporary directory and is gone on
 * shutdown, which is what tests want. The {@code dev} profile sets
 * {@code keytosound.db.data-dir}, and the same directory is then reused, so
 * saved compositions survive a restart of {@code spring-boot:run}.
 */
@Configuration
@Profile("!external-db")
public class EmbeddedPostgresConfig {

    @Value("${keytosound.db.data-dir:}")
    private String dataDir;

    @Bean(destroyMethod = "close")
    public EmbeddedPostgres embeddedPostgres() throws IOException {
        return start(dataDir.isBlank() ? null : Path.of(dataDir));
    }

    @Bean
    public DataSource dataSource(EmbeddedPostgres postgres) {
        return postgres.getPostgresDatabase();
    }

    /**
     * Starts PostgreSQL, reusing {@code dataDir} when given. Zonky only runs
     * initdb when the directory holds no cluster yet, so a second start finds
     * the data the first one wrote.
     */
    static EmbeddedPostgres start(Path dataDir) throws IOException {
        EmbeddedPostgres.Builder builder = EmbeddedPostgres.builder();
        if (dataDir != null) {
            Files.createDirectories(dataDir);
            builder.setDataDirectory(dataDir).setCleanDataDirectory(false);
        }
        return builder.start();
    }
}
