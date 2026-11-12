package com.dypcet.vayora.notification;

import com.dypcet.vayora.account.MessageSender;
import com.dypcet.vayora.account.MessageSender.Channel;
import com.dypcet.vayora.push.PushService;
import jakarta.annotation.PostConstruct;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * In-app notifications, kept in MongoDB.
 *
 * <p>Sending never fails its caller: a notification is a courtesy, a booking is not. When
 * called inside a database transaction the notification is written only after that
 * transaction commits, so nobody is told about something that was rolled back.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final String COLLECTION = "notifications";
    private static final int LISTED = 50;

    /** The kinds of thing a member is told about. Stored with each notification. */
    public enum Type {
        BOOKING_REQUESTED,
        BOOKING_CONFIRMED,
        BOOKING_DECLINED,
        BOOKING_CANCELLED,
        RIDE_CANCELLED,
        TRIP_COMPLETED,
        MARKED_NO_SHOW,
        ACCOUNT_NOTICE,
        SOS_RAISED,
        REQUEST_EXPIRED,
        TRIP_DISPUTED,
        RATING_REMINDER,
        SUPPLY_NUDGE,
        CALL_REQUESTED,
        // No longer sent; notifications already stored still carry it.
        REFERRAL_REWARD,
        RELEASE_REMINDER,
        PAYMENT_RECEIVED
    }

    /**
     * @param message the English, as sent in any email or SMS copy
     * @param text    the same as a template and its values, for the app to translate; null
     *                on notifications written before there were templates
     */
    public record Notification(String id, Type type, String message, Text text, Long bookingId,
            Instant createdAt, boolean read) {
    }

    /** Copies wanted besides the in-app notification, which is always kept. */
    public record Preferences(boolean email, boolean sms) {
    }

    private record Copy(Channel channel, String to) {
    }

    private final MongoTemplate mongo;
    private final Clock clock;

    private final JdbcTemplate jdbc;
    private final MessageSender sender;
    private final PushService push;

    public NotificationService(MongoTemplate mongo, Clock clock, JdbcTemplate jdbc, MessageSender sender,
            PushService push) {
        this.push = push;
        this.mongo = mongo;
        this.clock = clock;
        this.jdbc = jdbc;
        this.sender = sender;
    }

    @PostConstruct
    void ensureIndex() {
        try {
            mongo.indexOps(COLLECTION).createIndex(
                    new Index().on("userId", Sort.Direction.ASC).on("createdAt", Sort.Direction.DESC));
        } catch (RuntimeException e) {
            log.warn("Could not create the notifications index: {}", e.getMessage());
        }
    }

    public void send(long userId, Type type, Text text, Long bookingId) {
        String message = text.render();
        Document document = new Document("userId", userId)
                .append("type", type.name())
                .append("message", message)
                .append("text", text.toDocument())
                .append("bookingId", bookingId)
                .append("createdAt", Date.from(clock.instant()))
                .append("readAt", null);
        List<Copy> copies = copiesFor(userId);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    write(document);
                    deliver(copies, message);
                    pushTo(userId, message);
                }
            });
        } else {
            write(document);
            deliver(copies, message);
            pushTo(userId, message);
        }
    }

    public Preferences preferences(long userId) {
        List<Preferences> found = jdbc.query(
                "SELECT email, sms FROM notification_preferences WHERE user_id = ?",
                (rs, n) -> new Preferences(rs.getBoolean("email"), rs.getBoolean("sms")), userId);
        return found.isEmpty() ? new Preferences(false, false) : found.get(0);
    }

    public Preferences setPreferences(long userId, Preferences preferences) {
        jdbc.update("""
                INSERT INTO notification_preferences (user_id, email, sms) VALUES (?, ?, ?)
                ON CONFLICT (user_id) DO UPDATE
                SET email = EXCLUDED.email, sms = EXCLUDED.sms, updated_at = now()""",
                userId, preferences.email(), preferences.sms());
        return preferences(userId);
    }

    /**
     * Where copies go: each channel the member turned on, to an address they confirmed.
     * Worked out before the transaction ends, and never allowed to fail the caller.
     */
    private List<Copy> copiesFor(long userId) {
        try {
            List<Copy> found = jdbc.query("""
                    SELECT u.email, u.email_verified_at IS NOT NULL AS email_ok,
                           u.phone, u.phone_verified_at IS NOT NULL AS phone_ok,
                           COALESCE(p.email, FALSE) AS wants_email, COALESCE(p.sms, FALSE) AS wants_sms
                    FROM users u LEFT JOIN notification_preferences p ON p.user_id = u.id
                    WHERE u.id = ?""",
                    rs -> {
                        List<Copy> copies = new ArrayList<>();
                        if (rs.next()) {
                            if (rs.getBoolean("wants_email") && rs.getBoolean("email_ok")) {
                                copies.add(new Copy(Channel.EMAIL, rs.getString("email")));
                            }
                            if (rs.getBoolean("wants_sms") && rs.getBoolean("phone_ok")) {
                                copies.add(new Copy(Channel.PHONE, rs.getString("phone")));
                            }
                        }
                        return copies;
                    },
                    userId);
            return found == null ? List.of() : found;
        } catch (RuntimeException e) {
            log.warn("Notification copies skipped for user {}: {}", userId, e.getMessage());
            return List.of();
        }
    }

    /**
     * To the member's browsers, off the request: a slow push service must not hold up the
     * person who caused the notification. The push carries the English, as copies do.
     */
    private void pushTo(long userId, String message) {
        Thread.ofVirtual().name("push-" + userId).start(() -> push.send(userId, message));
    }

    private void deliver(List<Copy> copies, String message) {
        for (Copy copy : copies) {
            try {
                sender.send(copy.channel(), copy.to(), "VAYORA: " + message);
            } catch (RuntimeException e) {
                log.warn("Notification copy not sent by {}: {}", copy.channel(), e.getMessage());
            }
        }
    }

    private void write(Document document) {
        try {
            mongo.insert(document, COLLECTION);
        } catch (RuntimeException e) {
            log.warn("Notification not delivered to user {}: {}", document.get("userId"),
                    e.getMessage());
        }
    }

    /** The member's newest notifications. */
    public List<Notification> forUser(long userId) {
        Query query = new Query(Criteria.where("userId").is(userId))
                .with(Sort.by(Sort.Direction.DESC, "createdAt", "_id")).limit(LISTED);
        return mongo.find(query, Document.class, COLLECTION).stream()
                .map(NotificationService::toNotification).toList();
    }

    /** Every notification the member has, newest first, for their copy of their own data. */
    public List<Notification> everyFor(long userId) {
        Query query = new Query(Criteria.where("userId").is(userId))
                .with(Sort.by(Sort.Direction.DESC, "createdAt", "_id"));
        return mongo.find(query, Document.class, COLLECTION).stream()
                .map(NotificationService::toNotification).toList();
    }

    /**
     * Removes every notification of a member whose account is being deleted: once the deletion
     * commits, if called inside its transaction. Never fails its caller; a failure is logged.
     */
    public void forget(long userId) {
        Runnable remove = () -> {
            try {
                mongo.remove(new Query(Criteria.where("userId").is(userId)), COLLECTION);
            } catch (RuntimeException e) {
                log.warn("Notifications of deleted user {} not removed: {}", userId, e.getMessage());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    remove.run();
                }
            });
        } else {
            remove.run();
        }
    }

    public long unreadCount(long userId) {
        return mongo.count(new Query(unreadOf(userId)), COLLECTION);
    }

    /** Returns false if the member has no such notification. */
    public boolean markRead(long userId, String id) {
        if (!ObjectId.isValid(id)) {
            return false;
        }
        Query one = new Query(Criteria.where("_id").is(new ObjectId(id)).and("userId").is(userId));
        Document found = mongo.findOne(one, Document.class, COLLECTION);
        if (found == null) {
            return false;
        }
        if (found.get("readAt") == null) {
            mongo.updateFirst(one, Update.update("readAt", Date.from(clock.instant())), COLLECTION);
        }
        return true;
    }

    public void markAllRead(long userId) {
        mongo.updateMulti(new Query(unreadOf(userId)),
                Update.update("readAt", Date.from(clock.instant())), COLLECTION);
    }

    private static Criteria unreadOf(long userId) {
        return Criteria.where("userId").is(userId).and("readAt").is(null);
    }

    private static Notification toNotification(Document document) {
        Number booking = (Number) document.get("bookingId");
        return new Notification(
                document.getObjectId("_id").toHexString(),
                Type.valueOf(document.getString("type")),
                document.getString("message"),
                document.get("text") instanceof Document text ? Text.fromDocument(text) : null,
                booking == null ? null : booking.longValue(),
                document.getDate("createdAt").toInstant(),
                document.get("readAt") != null);
    }
}
