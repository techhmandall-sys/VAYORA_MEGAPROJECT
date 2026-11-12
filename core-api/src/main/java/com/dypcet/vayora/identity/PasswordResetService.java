package com.dypcet.vayora.identity;

import com.dypcet.vayora.account.MessageSender;
import com.dypcet.vayora.account.MessageSender.Channel;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * A forgotten password, reset with a six-digit code sent to the account's email address or phone
 * number (to the simulated outbox unless a real email or SMS service is configured). Passengers and
 * drivers only: an administrator's password comes from configuration.
 *
 * <p>Neither step says whether an account exists. Asking for a code always gets the same answer:
 * when a code is sent, when the address is unknown or the account suspended, and when a code was
 * sent too recently or too often. Every failed reset gets the same answer too. Codes are kept only as
 * hashes, last as long as confirmation codes, are spent by as many wrong guesses, and a new one
 * replaces the last. How long an answer takes is not made fully equal: a real email or SMS service
 * takes longer to send than to send nothing.
 */
@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private record ResetCode(long id, String hash, Instant expiresAt, int attempts) {
    }

    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final MessageSender sender;
    private final SignInThrottle throttle;
    private final Clock clock;
    private final Duration codeTtl;
    private final Duration resendAfter;
    private final int maxAttempts;
    private final int maxCodesPerDay;
    private final SecureRandom random = new SecureRandom();
    /** Compared against when there is no code, so that a failure costs the same either way. */
    private final String noCode;

    public PasswordResetService(JdbcTemplate jdbc, PasswordEncoder encoder, MessageSender sender,
            SignInThrottle throttle, Clock clock,
            @Value("${vayora.verification.code-ttl}") Duration codeTtl,
            @Value("${vayora.verification.resend-after}") Duration resendAfter,
            @Value("${vayora.verification.max-attempts}") int maxAttempts,
            @Value("${vayora.verification.max-codes-per-day}") int maxCodesPerDay) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.sender = sender;
        this.throttle = throttle;
        this.clock = clock;
        this.codeTtl = codeTtl;
        this.resendAfter = resendAfter;
        this.maxAttempts = maxAttempts;
        this.maxCodesPerDay = maxCodesPerDay;
        this.noCode = encoder.encode("no code was sent");
    }

    /**
     * Sends a fresh code to the address given, if it is a passenger's or driver's in good standing
     * and no code went to it too recently or too often; any earlier code stops working. Returns the
     * same way in every case.
     */
    @Transactional
    public void requestReset(String login) {
        String destination = destination(login);
        String code = String.format("%06d", random.nextInt(1_000_000));
        // Hashed before the account is looked up, so an unknown address costs as much.
        String hash = encoder.encode(code);
        Long userId = destination == null ? null : member(destination);
        if (userId == null) {
            return;
        }
        Instant now = clock.instant();
        List<Instant> last = jdbc.query(
                "SELECT created_at FROM password_reset_codes WHERE user_id = ? ORDER BY id DESC LIMIT 1",
                (rs, n) -> rs.getObject("created_at", OffsetDateTime.class).toInstant(), userId);
        Integer today = jdbc.queryForObject(
                "SELECT count(*) FROM password_reset_codes WHERE user_id = ? AND created_at > ?",
                Integer.class, userId, utc(now.minus(Duration.ofDays(1))));
        // Too soon after the last code, or too many today: nothing is sent, and the earlier code still works.
        if ((!last.isEmpty() && last.get(0).plus(resendAfter).isAfter(now)) || today >= maxCodesPerDay) {
            return;
        }
        jdbc.update("UPDATE password_reset_codes SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL",
                utc(now), userId);
        Channel channel = channel(destination);
        jdbc.update("""
                INSERT INTO password_reset_codes (user_id, channel, destination, code_hash, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?)""",
                userId, channel.name(), destination, hash, utc(now.plus(codeTtl)), utc(now));
        try {
            sender.send(channel, destination, "Your VAYORA password reset code is " + code
                    + ". It works for " + codeTtl.toMinutes() + " minutes. Do not share it.");
        } catch (RuntimeException e) {
            // Not said to the caller, whose answer would then differ for a real account. They ask again.
            log.warn("A password reset code could not be sent: {}", e.getMessage());
        }
    }

    /**
     * Sets the new password if the code is the latest one sent to that address, unspent and still in
     * time. Deliberately not one transaction: a wrong guess must be counted although the request fails.
     */
    public void resetPassword(String login, String code, String newPassword) {
        String destination = destination(login);
        Long userId = destination == null ? null : member(destination);
        ResetCode latest = userId == null ? null : latest(userId);
        Instant now = clock.instant();
        boolean live = latest != null && latest.expiresAt().isAfter(now) && latest.attempts() < maxAttempts;
        boolean matches = encoder.matches(code, live ? latest.hash() : noCode);
        if (!live || !matches) {
            if (live) {
                jdbc.update("UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = ?", latest.id());
            }
            throw wrong();
        }
        // Spent once only, even when two resets race.
        if (jdbc.update("UPDATE password_reset_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL",
                utc(now), latest.id()) == 0) {
            throw wrong();
        }
        jdbc.update("UPDATE users SET password_hash = ? WHERE id = ?", encoder.encode(newPassword), userId);
        // The owner has proved who they are: wrong passwords before no longer lock them out.
        throttle.succeeded((channel(destination) == Channel.EMAIL ? "email:" : "phone:") + destination);
    }

    /** The one answer to every failed reset. */
    private static ResponseStatusException wrong() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "That code is wrong or has expired. Request a new one.");
    }

    /** A passenger's or driver's account in good standing with this address, or null. */
    private Long member(String destination) {
        String column = channel(destination) == Channel.EMAIL ? "email" : "phone";
        List<Long> found = jdbc.queryForList("SELECT id FROM users WHERE " + column
                + " = ? AND status = 'ACTIVE' AND role <> 'ADMIN'", Long.class, destination);
        return found.isEmpty() ? null : found.get(0);
    }

    private ResetCode latest(long userId) {
        List<ResetCode> found = jdbc.query("""
                SELECT id, code_hash, expires_at, attempts FROM password_reset_codes
                WHERE user_id = ? AND consumed_at IS NULL
                ORDER BY id DESC LIMIT 1""",
                (rs, n) -> new ResetCode(rs.getLong("id"), rs.getString("code_hash"),
                        rs.getObject("expires_at", OffsetDateTime.class).toInstant(), rs.getInt("attempts")),
                userId);
        return found.isEmpty() ? null : found.get(0);
    }

    /** The address a login names, as accounts store it, or null if it is neither an email nor a phone. */
    private static String destination(String login) {
        if (login == null || login.isBlank()) {
            return null;
        }
        String stripped = login.strip();
        if (stripped.contains("@")) {
            return stripped.toLowerCase(Locale.ROOT);
        }
        String phone = Phones.normalise(stripped);
        return phone != null && phone.matches("\\+?[0-9]{10,15}") ? phone : null;
    }

    private static Channel channel(String destination) {
        return destination.contains("@") ? Channel.EMAIL : Channel.PHONE;
    }

    private static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
