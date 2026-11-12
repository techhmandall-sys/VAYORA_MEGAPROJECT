package com.dypcet.vayora.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Access tokens are revoked upon explicit logout or account deletion, and cannot be reused
 * even while their cryptographic lifetime remains unexpired.
 */
@AutoConfigureMockMvc
class TokenRevocationIntegrationTest extends PostgresIntegrationTest {

    private static final String PASSWORD = "horse-battery-correct-token";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private IdentityService identity;

    @Autowired
    private TokenRevocationService tokenRevocations;

    @Autowired
    private StringRedisTemplate redis;

    @Autowired
    private ObjectMapper json;

    @Test
    void loggingOutRevokesTokenAndBlocksSubsequentRequests() throws Exception {
        String email = "revocation-" + UUID.randomUUID() + "@example.test";
        identity.register(email, PASSWORD, "Sneha More", UserRole.PASSENGER);

        String loginResponse = mvc.perform(post("/api/v1/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode node = json.readTree(loginResponse);
        String token = node.get("accessToken").asText();

        // 1. Token works normally
        mvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));

        // 2. Logging out succeeds
        mvc.perform(post("/api/v1/auth/logout").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNoContent());

        // 3. Token is now blacklisted in Redis
        assertThat(tokenRevocations.isRevoked(token)).isTrue();
        assertThat(redis.hasKey(TokenRevocationService.key(token))).isTrue();

        // 4. Any subsequent requests with this token are rejected with 401 Unauthorized
        mvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Your session has ended. Sign in again."));

        // 5. Subsequent logout with revoked token is also rejected
        mvc.perform(post("/api/v1/auth/logout").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deletingAccountRevokesTokenImmediately() throws Exception {
        String email = "delete-revoke-" + UUID.randomUUID() + "@example.test";
        identity.register(email, PASSWORD, "Omkar Gaikwad", UserRole.PASSENGER);

        String loginResponse = mvc.perform(post("/api/v1/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String token = json.readTree(loginResponse).get("accessToken").asText();

        // Deleting the account also revokes the bearer token
        mvc.perform(delete("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(tokenRevocations.isRevoked(token)).isTrue();

        // Submitting that token returns 401 Unauthorized
        mvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Your session has ended. Sign in again."));
    }

    @Test
    void unauthenticatedLogoutIsRejected() throws Exception {
        mvc.perform(post("/api/v1/auth/logout"))
                .andExpect(status().isUnauthorized());
    }
}

