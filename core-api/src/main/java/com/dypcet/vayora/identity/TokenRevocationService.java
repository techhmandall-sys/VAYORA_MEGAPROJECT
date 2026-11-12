package com.dypcet.vayora.identity;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

/**
 * Blacklists revoked JWT access tokens in Redis until their natural expiration.
 * An outage must not take down the entire API, so when Redis cannot be reached,
 * revocation checks fall back to allowing requests.
 */
@Service
public class TokenRevocationService {

    private static final Logger log = LoggerFactory.getLogger(TokenRevocationService.class);
    private static final String PREFIX = "token:revoked:";

    private final StringRedisTemplate redis;
    private final Clock clock;

    public TokenRevocationService(StringRedisTemplate redis, Clock clock) {
        this.redis = redis;
        this.clock = clock;
    }

    /**
     * Revokes the given JWT until its expiration time.
     */
    public void revoke(Jwt jwt) {
        if (jwt == null) {
            return;
        }
        Instant expiresAt = jwt.getExpiresAt();
        Instant now = clock.instant();
        Duration ttl = expiresAt != null ? Duration.between(now, expiresAt) : Duration.ofHours(24);
        if (ttl.isNegative() || ttl.isZero()) {
            return;
        }
        String key = key(jwt.getTokenValue());
        try {
            redis.opsForValue().set(key, "revoked", ttl);
        } catch (RuntimeException e) {
            log.warn("Token revocation failed: {}", e.getMessage());
        }
    }

    /**
     * Checks whether the given JWT has been revoked.
     */
    public boolean isRevoked(Jwt jwt) {
        if (jwt == null) {
            return false;
        }
        return isRevoked(jwt.getTokenValue());
    }

    /**
     * Checks whether the raw token string has been revoked.
     */
    public boolean isRevoked(String tokenValue) {
        if (tokenValue == null || tokenValue.isBlank()) {
            return false;
        }
        String key = key(tokenValue);
        try {
            return Boolean.TRUE.equals(redis.hasKey(key));
        } catch (RuntimeException e) {
            log.warn("Token revocation check unavailable: {}", e.getMessage());
            return false;
        }
    }

    public static String key(String tokenValue) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(tokenValue.getBytes(StandardCharsets.UTF_8));
            return PREFIX + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}

