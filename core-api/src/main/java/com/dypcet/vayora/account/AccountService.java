package com.dypcet.vayora.account;

import com.dypcet.vayora.account.MessageSender.Channel;
import com.dypcet.vayora.check.DocumentCheckService;
import com.dypcet.vayora.identity.Phones;
import com.dypcet.vayora.notification.NotificationService;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** A member's own profile, the proof that their email and phone are theirs, and their emergency contacts. */
@Service
public class AccountService {

    public enum Gender {
        FEMALE,
        MALE,
        OTHER
    }

    public enum Chattiness {
        QUIET,
        MODERATE,
        TALKATIVE
    }

    /** An identity document a driver may say they hold. Only the kind, never a number. */
    public enum IdDocument {
        AADHAAR,
        PAN,
        DRIVING_LICENCE,
        PASSPORT,
        VOTER_ID
    }

    /**
     * Everything a member may see and change about themselves. Null means not said.
     *
     * @param declaredId the identity document a driver says they hold; declared, never checked
     */
    public record MyProfile(String email, boolean emailVerified, String phone, boolean phoneVerified,
            String bio, Integer birthYear, Gender gender, Boolean smoking, Boolean pets,
            Boolean music, Chattiness chattiness, IdDocument declaredId) {
    }

    public record ProfileUpdate(String phone, String bio, Integer birthYear, Gender gender,
            Boolean smoking, Boolean pets, Boolean music, Chattiness chattiness) {
    }

    public record EmergencyContact(long id, String name, String phone, String relation) {
    }

    private record Code(long id, String destination, String hash, Instant expiresAt, int attempts,
            Instant createdAt) {
    }

    private static final int MAX_CONTACTS = 3;

    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final MessageSender sender;
    private final Clock clock;
    private final DocumentCheckService checks;
    private final NotificationService notifications;
    private final Duration codeTtl;
    private final Duration resendAfter;
    private final int maxAttempts;
    private final int maxCodesPerDay;
    private final SecureRandom random = new SecureRandom();

    public AccountService(JdbcTemplate jdbc, PasswordEncoder encoder, MessageSender sender,
            Clock clock, DocumentCheckService checks, NotificationService notifications,
            @Value("${vayora.verification.code-ttl}") Duration codeTtl,
            @Value("${vayora.verification.resend-after}") Duration resendAfter,
            @Value("${vayora.verification.max-attempts}") int maxAttempts,
            @Value("${vayora.verification.max-codes-per-day}") int maxCodesPerDay) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.sender = sender;
        this.clock = clock;
        this.checks = checks;
        this.notifications = notifications;
        this.codeTtl = codeTtl;
        this.resendAfter = resendAfter;
        this.maxAttempts = maxAttempts;
        this.maxCodesPerDay = maxCodesPerDay;
    }

    public MyProfile profile(long userId) {
        return jdbc.queryForObject("""
                SELECT u.email, u.email_verified_at, u.phone, u.phone_verified_at, u.id_document,
                       p.bio, p.birth_year, p.gender, p.smoking, p.pets, p.music, p.chattiness
                FROM users u LEFT JOIN profiles p ON p.user_id = u.id
                WHERE u.id = ?""",
                (rs, n) -> new MyProfile(rs.getString("email"),
                        rs.getObject("email_verified_at") != null, rs.getString("phone"),
                        rs.getObject("phone_verified_at") != null, rs.getString("bio"),
                        (Integer) rs.getObject("birth_year"),
                        rs.getString("gender") == null ? null : Gender.valueOf(rs.getString("gender")),
                        (Boolean) rs.getObject("smoking"), (Boolean) rs.getObject("pets"),
                        (Boolean) rs.getObject("music"),
                        rs.getString("chattiness") == null ? null
                                : Chattiness.valueOf(rs.getString("chattiness")),
                        rs.getString("id_document") == null ? null
                                : IdDocument.valueOf(rs.getString("id_document"))),
                userId);
    }

    /**
     * Records which identity document a driver says they hold (feature 7, a labelled mock).
     * Only the kind is kept: no number and no copy is asked for. Nothing checks it, and it
     * makes nobody verified: it earns no level and passes no filter.
     */
    @Transactional
    public MyProfile declareId(long userId, IdDocument document) {
        if (jdbc.update("UPDATE users SET id_document = ? WHERE id = ? AND role = 'DRIVER'",
                document.name(), userId) == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only a driver can declare an identity document");
        }
        // Whatever staff saw was the document declared before.
        checks.withdrawIdentity(userId);
        return profile(userId);
    }

    @Transactional
    public MyProfile withdrawId(long userId) {
        jdbc.update("UPDATE users SET id_document = NULL WHERE id = ?", userId);
        checks.withdrawIdentity(userId);
        return profile(userId);
    }

    /** Replaces the whole profile. A changed phone number is unverified until proved again. */
    @Transactional
    public MyProfile update(long userId, ProfileUpdate update) {
        String phone = Phones.normalise(update.phone());
        if (phone == null && jdbc.queryForObject("SELECT email IS NULL FROM users WHERE id = ?", Boolean.class, userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You sign in with your phone number, so it cannot be removed");
        }
        try {
            jdbc.update("""
                UPDATE users
                SET phone_verified_at = CASE WHEN phone IS NOT DISTINCT FROM ?
                                             THEN phone_verified_at END,
                    phone = ?
                WHERE id = ?""",
                phone, phone, userId);
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That phone number belongs to another account");
        }
        jdbc.update("""
                INSERT INTO profiles (user_id, bio, birth_year, gender, smoking, pets, music, chattiness)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_id) DO UPDATE
                SET bio = EXCLUDED.bio, birth_year = EXCLUDED.birth_year, gender = EXCLUDED.gender,
                    smoking = EXCLUDED.smoking, pets = EXCLUDED.pets, music = EXCLUDED.music,
                    chattiness = EXCLUDED.chattiness, updated_at = now()""",
                userId, blankToNull(update.bio()), update.birthYear(),
                update.gender() == null ? null : update.gender().name(), update.smoking(),
                update.pets(), update.music(),
                update.chattiness() == null ? null : update.chattiness().name());
        return profile(userId);
    }

    // ---- verification -----------------------------------------------------------

    /**
     * Sends a fresh code to the member's email or phone. Any earlier code for that channel
     * stops working. If the code cannot be sent, nothing changes: the earlier code still
     * works and the member may ask again at once.
     */
    @Transactional
    public void requestCode(long userId, Channel channel) {
        MyProfile profile = profile(userId);
        String destination = channel == Channel.EMAIL ? profile.email() : profile.phone();
        if (destination == null && channel == Channel.EMAIL) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This account has no email address");
        }
        if (destination == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Add a phone number first");
        }
        if (channel == Channel.EMAIL ? profile.emailVerified() : profile.phoneVerified()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This is already verified");
        }
        Instant now = clock.instant();
        Code latest = latest(userId, channel);
        if (latest != null && latest.createdAt().plus(resendAfter).isAfter(now)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "A code was sent a moment ago. Wait before asking for another.");
        }
        Integer sentToday = jdbc.queryForObject("""
                SELECT count(*) FROM verification_codes
                WHERE user_id = ? AND channel = ? AND created_at > ?""",
                Integer.class, userId, channel.name(), utc(now.minus(Duration.ofDays(1))));
        if (sentToday != null && sentToday >= maxCodesPerDay) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "That is as many codes as one day allows. Try again tomorrow.");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        jdbc.update("""
                UPDATE verification_codes SET consumed_at = ?
                WHERE user_id = ? AND channel = ? AND consumed_at IS NULL""",
                utc(now), userId, channel.name());
        jdbc.update("""
                INSERT INTO verification_codes (user_id, channel, destination, code_hash, expires_at,
                                                created_at)
                VALUES (?, ?, ?, ?, ?, ?)""",
                userId, channel.name(), destination, encoder.encode(code), utc(now.plus(codeTtl)),
                utc(now));
        sender.send(channel, destination, "Your VAYORA verification code is " + code
                + ". It works for " + codeTtl.toMinutes() + " minutes. Do not share it.");
    }

    /**
     * Checks a code. Deliberately not one transaction: a wrong guess must be counted even
     * though the request then fails.
     */
    public void confirmCode(long userId, Channel channel, String code) {
        Code latest = latest(userId, channel);
        if (latest == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Request a code first");
        }
        Instant now = clock.instant();
        if (!latest.expiresAt().isAfter(now)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "That code has expired. Request a new one.");
        }
        if (latest.attempts() >= maxAttempts) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many wrong attempts. Request a new code.");
        }
        if (!encoder.matches(code, latest.hash())) {
            jdbc.update("UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?",
                    latest.id());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That code is not right");
        }
        // Only if the address the code went to is still the member's: the unconsumed
        // check makes a code single-use even if two confirmations race.
        String column = channel == Channel.EMAIL ? "email" : "phone";
        int used = jdbc.update(
                "UPDATE verification_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL",
                utc(now), latest.id());
        int verified = used == 0 ? 0 : jdbc.update(
                "UPDATE users SET " + column + "_verified_at = ? WHERE id = ? AND " + column + " = ?",
                utc(now), userId, latest.destination());
        if (verified == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "That code is no longer valid. Request a new one.");
        }
    }

    private Code latest(long userId, Channel channel) {
        List<Code> found = jdbc.query("""
                SELECT id, destination, code_hash, expires_at, attempts, created_at
                FROM verification_codes
                WHERE user_id = ? AND channel = ? AND consumed_at IS NULL
                ORDER BY id DESC LIMIT 1""",
                (rs, n) -> new Code(rs.getLong("id"), rs.getString("destination"),
                        rs.getString("code_hash"),
                        rs.getObject("expires_at", OffsetDateTime.class).toInstant(),
                        rs.getInt("attempts"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant()),
                userId, channel.name());
        return found.isEmpty() ? null : found.get(0);
    }

    // ---- emergency contacts -----------------------------------------------------

    public List<EmergencyContact> contacts(long userId) {
        return jdbc.query("""
                SELECT id, name, phone, relation FROM emergency_contacts
                WHERE user_id = ? ORDER BY id""",
                (rs, n) -> new EmergencyContact(rs.getLong("id"), rs.getString("name"),
                        rs.getString("phone"), rs.getString("relation")),
                userId);
    }

    @Transactional
    public EmergencyContact addContact(long userId, String name, String phone, String relation) {
        // Locks the member's row so two requests cannot both squeeze under the limit.
        jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", Long.class, userId);
        if (contacts(userId).size() >= MAX_CONTACTS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You can have at most " + MAX_CONTACTS + " emergency contacts");
        }
        Long id = jdbc.queryForObject("""
                INSERT INTO emergency_contacts (user_id, name, phone, relation)
                VALUES (?, ?, ?, ?) RETURNING id""",
                Long.class, userId, name.strip(), phone, blankToNull(relation));
        return new EmergencyContact(id, name.strip(), phone, blankToNull(relation));
    }

    public void removeContact(long userId, long contactId) {
        if (jdbc.update("DELETE FROM emergency_contacts WHERE id = ? AND user_id = ?",
                contactId, userId) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found");
        }
    }

    // ---- the member's own data ---------------------------------------------------

    /**
     * Everything VAYORA keeps about the member, as one document they can save (their right of
     * access). Rides and bookings are listed as the member's own records: what another member
     * entered about themselves is not included.
     */
    public Map<String, Object> export(long userId) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("exportedAt", clock.instant().toString());
        data.put("account", jdbc.queryForMap("""
                SELECT id, full_name, email, email_verified_at, phone, phone_verified_at, role, status,
                       referral_code, id_document, google_sub IS NOT NULL AS signs_in_with_google, created_at
                FROM users WHERE id = ?""", userId));
        data.put("profile", profile(userId));
        data.put("emergencyContacts", contacts(userId));
        data.put("notificationChoices", jdbc.queryForList(
                "SELECT email, sms, updated_at FROM notification_preferences WHERE user_id = ?", userId));
        data.put("vehicles", jdbc.queryForList("""
                SELECT id, make, model, year, colour, seats, comfort, luggage, electric, battery_kwh,
                       consumption_kwh_per_100km, insurer, insured_until, created_at
                FROM vehicles WHERE owner_id = ? ORDER BY id""", userId));
        data.put("paymentDetails", jdbc.queryForList("""
                SELECT upi_id, qr_png IS NOT NULL AS has_qr_code, updated_at
                FROM driver_payment_details WHERE user_id = ?""", userId));
        data.put("documentChecks", jdbc.queryForList("""
                SELECT kind, vehicle_id, status, requested_at, decided_at, note
                FROM document_checks WHERE driver_id = ? ORDER BY id""", userId));
        data.put("ridesOffered", jdbc.queryForList("""
                SELECT r.id, r.departure_time, r.status, r.seats_offered, r.notes, r.created_at,
                       (SELECT name FROM ride_stops WHERE ride_id = r.id ORDER BY seq LIMIT 1) AS from_stop,
                       (SELECT name FROM ride_stops WHERE ride_id = r.id ORDER BY seq DESC LIMIT 1) AS to_stop
                FROM rides r WHERE r.driver_id = ? ORDER BY r.id""", userId));
        data.put("bookings", jdbc.queryForList("""
                SELECT b.id, b.ride_id, s.name AS from_stop, t.name AS to_stop, b.seats, b.price, b.status,
                       b.created_at
                FROM bookings b
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                JOIN ride_stops t ON t.ride_id = b.ride_id AND t.seq = b.to_seq
                WHERE b.passenger_id = ? ORDER BY b.id""", userId));
        data.put("ratingsGiven", jdbc.queryForList(
                "SELECT booking_id, stars, comment, created_at FROM ratings WHERE rater_id = ? ORDER BY id", userId));
        data.put("ratingsReceived", jdbc.queryForList(
                "SELECT booking_id, stars, comment, created_at FROM ratings WHERE ratee_id = ? ORDER BY id", userId));
        data.put("emergencyAlerts", jdbc.queryForList("""
                SELECT id, ride_id, status, contacts_told, contacts_missed, created_at
                FROM sos_alerts WHERE user_id = ? ORDER BY id""", userId));
        data.put("notifications", notifications.everyFor(userId));
        return data;
    }

    /**
     * Deletes the member's account (their right to erasure). Whatever identifies them goes: name,
     * email, phone, password, Google link, referral code, declared document, profile, photo,
     * emergency contacts, codes, notification choices, push subscriptions, payment details,
     * vehicle photos and in-app notifications. Checks of their documents are withdrawn. The row
     * stays, marked deleted, because rides, bookings, ratings, reports and the event log refer to
     * it; there the member appears as "Deleted member". Refused while the member drives or holds a
     * seat on a ride that is still to come, since other people are counting on it.
     */
    @Transactional
    public void delete(long userId) {
        // Taken first, so the checks below and the erasure see the same account.
        jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", Long.class, userId);
        boolean committed = jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM rides WHERE driver_id = ? AND status IN ('SCHEDULED', 'IN_PROGRESS'))
                    OR EXISTS (SELECT 1 FROM bookings WHERE passenger_id = ? AND status IN ('PENDING', 'CONFIRMED'))""",
                Boolean.class, userId, userId);
        if (committed) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cancel your rides and bookings still to come, or let them finish, before deleting your account");
        }
        jdbc.update("""
                UPDATE users
                SET full_name = 'Deleted member', email = NULL, email_verified_at = NULL, phone = NULL,
                    phone_verified_at = NULL, password_hash = '!', google_sub = NULL, referral_code = NULL,
                    id_document = NULL, status = 'DELETED', deleted_at = ?
                WHERE id = ?""", utc(clock.instant()), userId);
        for (String table : List.of("profiles", "emergency_contacts", "verification_codes",
                "password_reset_codes", "user_photos", "notification_preferences", "push_subscriptions",
                "driver_payment_details")) {
            jdbc.update("DELETE FROM " + table + " WHERE user_id = ?", userId);
        }
        jdbc.update("DELETE FROM vehicle_photos WHERE vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = ?)",
                userId);
        checks.withdrawIdentity(userId);
        for (long vehicleId : jdbc.queryForList("SELECT id FROM vehicles WHERE owner_id = ?", Long.class, userId)) {
            checks.withdrawInsurance(vehicleId);
        }
        notifications.forget(userId);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
