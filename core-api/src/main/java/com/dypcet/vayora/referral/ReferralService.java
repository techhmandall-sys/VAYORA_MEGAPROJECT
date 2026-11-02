package com.dypcet.vayora.referral;

import java.security.SecureRandom;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Who brought whom. A member shares a code; someone who signs up with it is recorded as
 * referred, and counts as qualified once they complete a first trip, as passenger or driver.
 * VAYORA charges nothing, so it has nothing to give up as a reward: this is only the count.
 */
@Service
public class ReferralService {

    /** @param qualified of those signed up, how many have completed a trip */
    public record Summary(String code, int signedUp, int qualified) {
    }

    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
    private static final int CODE_LENGTH = 6;

    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();

    public ReferralService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The member's code, made the first time it is asked for. */
    public String codeFor(long userId) {
        for (int attempt = 0; attempt < 5; attempt++) {
            String existing = jdbc.queryForObject("SELECT referral_code FROM users WHERE id = ?", String.class, userId);
            if (existing != null) {
                return existing;
            }
            try {
                jdbc.update("UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL",
                        newCode(), userId);
            } catch (org.springframework.dao.DuplicateKeyException e) {
                // Another member already has that code: try another.
            }
        }
        throw new IllegalStateException("Could not make a unique referral code");
    }

    /** The member a code belongs to. 400 if it belongs to nobody. */
    public long referrerOf(String code) {
        List<Long> found = jdbc.queryForList("SELECT id FROM users WHERE referral_code = ?", Long.class,
                code.strip().toUpperCase(Locale.ROOT));
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That referral code does not exist");
        }
        return found.get(0);
    }

    public void recordSignUp(long referrerId, long refereeId) {
        jdbc.update("INSERT INTO referrals (referrer_id, referee_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                referrerId, refereeId);
    }

    /** Marks as qualified any of these members who were referred and had not yet completed a trip. */
    public void qualify(Collection<Long> userIds) {
        if (userIds.isEmpty()) {
            return;
        }
        jdbc.update("UPDATE referrals SET qualified_at = now() WHERE qualified_at IS NULL AND referee_id = ANY (?)",
                (Object) userIds.toArray(Long[]::new));
    }

    public Summary summary(long userId) {
        String code = codeFor(userId);
        return jdbc.queryForObject("""
                SELECT COUNT(*) AS signed_up, COUNT(qualified_at) AS qualified
                FROM referrals WHERE referrer_id = ?""",
                (rs, n) -> new Summary(code, rs.getInt("signed_up"), rs.getInt("qualified")), userId);
    }

    private String newCode() {
        StringBuilder code = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            code.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }
}
