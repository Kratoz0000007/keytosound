package com.keytosound.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.util.UUID;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/** Runs V1, plants the data V2 has to deal with, then runs V2 on its own database. */
class V2MigrationTest {

    private static EmbeddedPostgres postgres;
    private static JdbcTemplate jdbc;
    private static final UUID OWNERLESS = UUID.randomUUID();

    @BeforeAll
    static void migrateAcrossV2() throws Exception {
        postgres = EmbeddedPostgres.builder().start();
        DataSource dataSource = postgres.getPostgresDatabase();
        jdbc = new JdbcTemplate(dataSource);

        flyway(dataSource).target("1").load().migrate();
        jdbc.update("INSERT INTO compositions (id, user_id, title, genre_id, seed, settings) "
                + "VALUES (?, NULL, 'old', 'lofi', 1, '{}'::jsonb)", OWNERLESS);
        jdbc.update("INSERT INTO keystrokes (id, composition_id, ordinal, key_value, timestamp_ms) "
                + "VALUES (1, ?, 0, 'a', 0)", OWNERLESS);

        flyway(dataSource).load().migrate();
    }

    @AfterAll
    static void stop() throws Exception {
        postgres.close();
    }

    @Test
    void ownerlessCompositionsAndTheirKeystrokesAreGone() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM compositions", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM keystrokes", Integer.class)).isZero();
    }

    @Test
    void aCompositionNowNeedsAnOwner() {
        assertThatThrownBy(() -> jdbc.update("INSERT INTO compositions (id, user_id, title, genre_id, seed, settings) "
                        + "VALUES (?, NULL, 't', 'lofi', 1, '{}'::jsonb)", UUID.randomUUID()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void theOwnerMustBeARealUser() {
        assertThatThrownBy(() -> jdbc.update("INSERT INTO compositions (id, user_id, title, genre_id, seed, settings) "
                        + "VALUES (?, ?, 't', 'lofi', 1, '{}'::jsonb)", UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void emailsAreUniqueRegardlessOfCase() {
        jdbc.update("INSERT INTO users (id, email, password_hash) VALUES (?, 'a@x.com', 'h')", UUID.randomUUID());
        assertThatThrownBy(() -> jdbc.update(
                        "INSERT INTO users (id, email, password_hash) VALUES (?, 'A@x.com', 'h')", UUID.randomUUID()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private static FluentConfiguration flyway(DataSource dataSource) {
        return Flyway.configure().dataSource(dataSource).locations("classpath:db/migration");
    }
}
