package com.keytosound.backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class EmbeddedPostgresConfigTest {

    @Test
    void keepsDataAcrossRestartsWhenGivenADataDirectory(@TempDir Path dir) throws Exception {
        Path data = dir.resolve("pgdata");

        try (EmbeddedPostgres first = EmbeddedPostgresConfig.start(data);
                Connection c = first.getPostgresDatabase().getConnection();
                Statement s = c.createStatement()) {
            s.execute("CREATE TABLE survivor (x INT)");
            s.execute("INSERT INTO survivor VALUES (42)");
        }

        try (EmbeddedPostgres second = EmbeddedPostgresConfig.start(data);
                Connection c = second.getPostgresDatabase().getConnection();
                Statement s = c.createStatement();
                ResultSet rs = s.executeQuery("SELECT x FROM survivor")) {
            assertThat(rs.next()).isTrue();
            assertThat(rs.getInt(1)).isEqualTo(42);
        }
    }

    @Test
    void startsAThrowawayDatabaseWithoutADataDirectory() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgresConfig.start(null);
                Connection c = pg.getPostgresDatabase().getConnection();
                Statement s = c.createStatement();
                ResultSet rs = s.executeQuery("SELECT 1")) {
            assertThat(rs.next()).isTrue();
        }
    }
}
