package com.keytosound.backend;

import static org.assertj.core.api.Assertions.assertThat;

import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Proves the database actually starts before anything is built on top of it.
 * This is the riskiest dependency in the whole plan: no Docker and no
 * installed PostgreSQL on the target machine.
 */
@SpringBootTest
class DatabaseSmokeTest {

    @Autowired
    private DataSource dataSource;

    @Test
    void postgresStartsAndIsReallyPostgres() {
        String version = new JdbcTemplate(dataSource).queryForObject("SELECT version()", String.class);
        assertThat(version).contains("PostgreSQL");
    }

    @Test
    void jsonbIsSupported() {
        // Proves this is genuine PostgreSQL rather than a compatibility mode:
        // composition settings are stored as jsonb.
        Integer length = new JdbcTemplate(dataSource)
                .queryForObject("SELECT jsonb_array_length('[1,2,3]'::jsonb)", Integer.class);
        assertThat(length).isEqualTo(3);
    }
}
