package com.dypcet.vayora.booking;

import com.dypcet.vayora.eventlog.EventLogService;
import com.dypcet.vayora.eventlog.EventType;
import com.dypcet.vayora.eventlog.HasActor;
import com.dypcet.vayora.hazard.HazardFeatures;
import com.dypcet.vayora.hold.SeatHolds;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.Text;
import com.dypcet.vayora.audit.AuditService;
import com.dypcet.vayora.payment.PaymentService;
import com.dypcet.vayora.ride.DetourService;
import com.dypcet.vayora.routing.RouteService.Point;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Owns the booking state machine and the seat inventory it moves.
 *
 * <p>Every method that touches seats locks the ride row first, then the booking row, then
 * updates segments. One lock order everywhere means concurrent requests on a ride queue
 * up instead of deadlocking, and the last seat goes to exactly one of them.
 */
@Service
public class BookingService {

    /**
     * @param price        the fare: what the driver is owed if the trip runs
     * @param boardingTime   when the ride leaves the passenger's boarding stop
     * @param passengerRated whether the passenger has rated the driver for this trip
     * @param driverRated    whether the driver has rated the passenger for this trip
     * @param passengerConfirmed the passenger's answer to whether a completed trip
     *                           happened; null until they answer
     * @param paymentStatus  {@code DEFERRED} while live, then {@code DUE}, {@code VOID} if it
     *                       owed nothing, or {@code SETTLED} once paid. Null for a free ride
     * @param amountDue      what it owed the driver when it ended; null until then, and if nothing
     * @param paymentMethod  how the driver says it was paid, {@code CASH} or {@code UPI}; null until then
     */
    public record Booking(long id, long rideId, long passengerId, String passengerName,
            int fromSeq, int toSeq, String fromStop, String toStop, int seats, BigDecimal price,
            BookingStatus status, Instant boardingTime, Instant createdAt,
            boolean passengerRated, boolean driverRated, Boolean passengerConfirmed, FlexTier flexTier,
            long driverId, String driverName, String vehicle, Double pickupLat, Double pickupLon,
            Integer detourMinutes, String paymentStatus, BigDecimal amountDue, String paymentMethod) {
    }

    /**
     * How long a driver has to answer a request, for telling passengers.
     *
     * @param closesMinutesBeforeBoarding an unanswered request is closed this long before
     *                                    the passenger would board, however recent it is
     */
    public record RequestTerms(long answerWithinMinutes, long closesMinutesBeforeBoarding) {
    }

    /** A request closed by the platform because the driver did not answer in time. */
    record Expired(long bookingId, long rideId, long driverId, String reason) implements HasActor {
        @Override
        public String actorType() {
            return "platform";
        }

        @Override
        public Long actorId() {
            return null;
        }
    }

    /** The passenger's choice of what happens if the driver withdraws. */
    record TierSelected(long bookingId, long passengerId, String tier) implements HasActor {
        @Override
        public String actorType() {
            return "passenger";
        }

        @Override
        public Long actorId() {
            return passengerId;
        }
    }

    /**
     * @param lastMileDistanceM straight-line metres from the passenger's start to the
     *                          boarding stop, as shown on the candidate booked; null
     *                          when the search did not carry one
     * @param lastMileModeAvailable whether a non-walk access option (rickshaw or bus)
     *                              was shown for that candidate; null with the distance
     */
    record Requested(long bookingId, long rideId, long passengerId, int fromSeq, int toSeq,
            int seats, Instant departureTime, Integer lastMileDistanceM, Boolean lastMileModeAvailable)
            implements HasActor {
        @Override
        public String actorType() {
            return "passenger";
        }

        @Override
        public Long actorId() {
            return passengerId;
        }
    }

    /** @param instant true when the ride confirms bookings without the driver deciding */
    record Decided(long bookingId, long rideId, long driverId, boolean instant) implements HasActor {
        @Override
        public String actorType() {
            return "driver";
        }

        @Override
        public Long actorId() {
            return driverId;
        }
    }

    /**
     * {@code departureTime} is required by the late-cancellation metric.
     *
     * @param cancelledBy "passenger", or "driver" when the driver withdrew the whole ride
     */
    record Cancelled(long bookingId, long rideId, long passengerId, int seats,
            Instant departureTime, String cancelledBy, long cancelledById) implements HasActor {
        @Override
        public String actorType() {
            return cancelledBy;
        }

        @Override
        public Long actorId() {
            return cancelledById;
        }
    }

    record LockedRide(long driverId, boolean instantBooking, String status,
            Instant departureTime, boolean womenOnly, int maxDetourMinutes) {
    }

    private static final String SELECT_BOOKING = """
            SELECT b.*, u.full_name AS passenger_name, s.name AS from_stop, t.name AS to_stop,
                   r.driver_id, d.full_name AS driver_name,
                   concat_ws(', ', v.make || ' ' || v.model, v.colour) AS vehicle,
                   r.departure_time + make_interval(mins => s.offset_minutes
                                                         + COALESCE(b.pickup_offset_minutes, 0)) AS boarding,
                   ST_Y(b.pickup_location::geometry) AS pickup_lat,
                   ST_X(b.pickup_location::geometry) AS pickup_lon,
                   p.status AS payment_status, p.amount_due, p.method AS payment_method,
                   EXISTS (SELECT 1 FROM ratings g WHERE g.booking_id = b.id
                             AND g.rater_id = b.passenger_id) AS passenger_rated,
                   EXISTS (SELECT 1 FROM ratings g WHERE g.booking_id = b.id
                             AND g.rater_id = r.driver_id) AS driver_rated
            FROM bookings b
            JOIN rides r ON r.id = b.ride_id
            JOIN users u ON u.id = b.passenger_id
            JOIN users d ON d.id = r.driver_id
            JOIN vehicles v ON v.id = r.vehicle_id
            JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
            JOIN ride_stops t ON t.ride_id = b.ride_id AND t.seq = b.to_seq
            LEFT JOIN payment_intents p ON p.booking_id = b.id
            """;

    private static final RowMapper<Booking> MAPPER = (rs, n) -> new Booking(
            rs.getLong("id"), rs.getLong("ride_id"), rs.getLong("passenger_id"),
            rs.getString("passenger_name"), rs.getInt("from_seq"), rs.getInt("to_seq"),
            rs.getString("from_stop"), rs.getString("to_stop"), rs.getInt("seats"),
            rs.getBigDecimal("price"),
            BookingStatus.valueOf(rs.getString("status")),
            rs.getObject("boarding", OffsetDateTime.class).toInstant(),
            rs.getObject("created_at", OffsetDateTime.class).toInstant(),
            rs.getBoolean("passenger_rated"), rs.getBoolean("driver_rated"),
            (Boolean) rs.getObject("passenger_confirmed"), FlexTier.valueOf(rs.getString("flex_tier")),
            rs.getLong("driver_id"), rs.getString("driver_name"), rs.getString("vehicle"),
            (Double) rs.getObject("pickup_lat"), (Double) rs.getObject("pickup_lon"),
            (Integer) rs.getObject("detour_minutes"),
            rs.getString("payment_status"), rs.getBigDecimal("amount_due"), rs.getString("payment_method"));

    private final JdbcTemplate jdbc;
    private final EventLogService events;
    private final HazardFeatures hazardFeatures;
    private final PaymentService payments;
    private final NotificationService notifications;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final SeatHolds holds;
    private final BoardingService boardingCodes;
    private final Duration answerWithin;
    private final Duration closeBeforeBoarding;
    private final Duration midRouteLead;
    private final DetourService detours;
    private final AuditService audit;

    public BookingService(JdbcTemplate jdbc, EventLogService events,
            HazardFeatures hazardFeatures, PaymentService payments,
            NotificationService notifications, ObjectMapper mapper, Clock clock,
            SeatHolds holds, BoardingService boardingCodes,
            @Value("${vayora.booking.answer-within}") Duration answerWithin,
            @Value("${vayora.booking.close-before-boarding}") Duration closeBeforeBoarding,
            @Value("${vayora.booking.mid-route-lead}") Duration midRouteLead, DetourService detours,
            AuditService audit) {
        this.audit = audit;
        this.detours = detours;
        this.answerWithin = answerWithin;
        this.closeBeforeBoarding = closeBeforeBoarding;
        this.midRouteLead = midRouteLead;
        this.holds = holds;
        this.boardingCodes = boardingCodes;
        this.jdbc = jdbc;
        this.events = events;
        this.hazardFeatures = hazardFeatures;
        this.payments = payments;
        this.notifications = notifications;
        this.mapper = mapper;
        this.clock = clock;
    }

    /**
     * Takes seats on every leg from stop {@code fromSeq} to stop {@code toSeq}, or none.
     * Confirms at once on an instant-booking ride; otherwise the seats are held while the
     * driver decides. Nothing is paid now: the passenger pays the driver once the booking ends.
     *
     * @param idempotencyKey if not null, a repeat of an earlier request with the same key
     *                       returns that booking instead of making another
     */
    @Transactional
    public Booking request(long passengerId, long rideId, int fromSeq, int toSeq, int seats, String idempotencyKey) {
        return request(passengerId, rideId, fromSeq, toSeq, seats, idempotencyKey, FlexTier.EXACT);
    }

    /** @param tier what the passenger agrees to should the driver withdraw this ride */
    @Transactional
    public Booking request(long passengerId, long rideId, int fromSeq, int toSeq, int seats,
            String idempotencyKey, FlexTier tier) {
        return request(passengerId, rideId, fromSeq, toSeq, seats, idempotencyKey, tier, null);
    }

    /**
     * @param pickup where to be picked up instead of stop {@code fromSeq}, on the leg after
     *               it, if the driver offered detours (feature 28); null to board at the stop.
     *               Its cost is worked out here by road, whatever the search said.
     */
    @Transactional
    public Booking request(long passengerId, long rideId, int fromSeq, int toSeq, int seats,
            String idempotencyKey, FlexTier tier, Point pickup) {
        return request(passengerId, rideId, fromSeq, toSeq, seats, idempotencyKey, tier, pickup, null, null);
    }

    /**
     * @param lastMileDistanceM straight-line metres from the passenger's start to the
     *                          boarding stop, as shown on the candidate they are booking
     *                          (feature 91); null if the client sent none
     * @param lastMileModeShown the access option shown alongside that stop: "walk",
     *                          "rickshaw" or "bus"; null with the distance
     */
    @Transactional
    public Booking request(long passengerId, long rideId, int fromSeq, int toSeq, int seats,
            String idempotencyKey, FlexTier tier, Point pickup,
            Integer lastMileDistanceM, String lastMileModeShown) {
        if (toSeq <= fromSeq) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "toSeq must come after fromSeq");
        }
        // A pickup's cost is asked of the routing service before the ride is locked: a slow
        // routing service must not hold the lock. It depends on nothing the lock protects.
        DetourService.Pickup away = null;
        if (pickup != null) {
            try {
                away = detours.on(rideId, pickup, fromSeq);
            } catch (IllegalArgumentException e) {
                // No such leg, or no such ride: the checks below say which.
            }
        }
        LockedRide ride = lockRide(rideId);
        if (ride == null) {
            throw notFound("Ride not found");
        }
        // Checked under the ride lock, so two copies of one request cannot both get here.
        if (idempotencyKey != null) {
            Booking repeat = repeatOf(passengerId, idempotencyKey, rideId, fromSeq, toSeq, seats);
            if (repeat != null) {
                return repeat;
            }
        }
        boolean underWay = "IN_PROGRESS".equals(ride.status());
        if (!"SCHEDULED".equals(ride.status()) && !underWay) {
            throw conflict("This ride is not open for booking");
        }
        // What an earlier booking owes is settled before anything new is booked.
        if (payments.owes(passengerId)) {
            throw conflict("You still owe a driver for an earlier booking. You can book again once they mark it paid: see My bookings.");
        }
        // A driver at the wheel cannot answer a request.
        if (underWay && !ride.instantBooking()) {
            throw conflict("This ride is already on the road, and its driver approves each request");
        }
        // As declared on the passenger's own profile; nothing stronger is available.
        if (ride.womenOnly() && !Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = ? AND gender = 'FEMALE')",
                Boolean.class, passengerId))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This ride is for women only");
        }
        int legs = toSeq - fromSeq;
        Integer legsOnRide = jdbc.queryForObject("""
                SELECT COUNT(*) FROM ride_segments WHERE ride_id = ? AND seq >= ? AND seq < ?""",
                Integer.class, rideId, fromSeq, toSeq);
        if (legsOnRide != legs) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Those stops are not on this ride");
        }
        // A pickup away from the stops is weighed against what is left under the ride lock, so
        // two passengers cannot both spend the driver's last minutes.
        if (pickup != null) {
            if (underWay || ride.maxDetourMinutes() == 0) {
                throw conflict("This ride picks up only at its stops");
            }
            if (away == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Those stops are not on this ride");
            }
            if (away.detourMinutes() > detours.minutesLeft(rideId)) {
                throw conflict("That pickup would take the driver further out of their way than they offered");
            }
        }
        Instant boarding = jdbc.queryForObject("""
                SELECT r.departure_time + make_interval(mins => s.offset_minutes)
                FROM rides r JOIN ride_stops s ON s.ride_id = r.id AND s.seq = ?
                WHERE r.id = ?""",
                OffsetDateTime.class, fromSeq, rideId).toInstant();
        if (away != null) {
            boarding = boarding.plus(Duration.ofMinutes(away.offsetMinutes()));
        }
        Instant now = clock.instant();
        if (!boarding.isAfter(now)) {
            throw conflict("This ride has already left that stop");
        }
        // A ride started early may be ahead of its timetable by as much: judged by whichever
        // puts it at the stop sooner.
        if (underWay && !jdbc.queryForObject("""
                SELECT LEAST(r.departure_time, r.started_at) + make_interval(mins => s.offset_minutes)
                FROM rides r JOIN ride_stops s ON s.ride_id = r.id AND s.seq = ?
                WHERE r.id = ?""",
                OffsetDateTime.class, fromSeq, rideId).toInstant().isAfter(now.plus(midRouteLead))) {
            throw conflict("This ride is on the road and due at that stop too soon to book");
        }

        // A request that would be closed unanswered at the next check is not taken at all.
        if (!ride.instantBooking() && !boarding.minus(closeBeforeBoarding).isAfter(now)) {
            throw conflict("This driver approves each request, and it is too close to "
                    + "departure for an answer. Choose a ride that confirms instantly.");
        }

        // Seats another passenger is holding for a few minutes are left alone. The
        // passenger's own hold is not in this count, so it never stands in their way.
        Map<Integer, Integer> held = holds.heldByOthers(rideId, passengerId);
        if (!held.isEmpty()) {
            jdbc.query("""
                    SELECT seq, seats_available FROM ride_segments
                    WHERE ride_id = ? AND seq >= ? AND seq < ?""",
                    rs -> {
                        if (rs.getInt("seats_available") - held.getOrDefault(rs.getInt("seq"), 0) < seats) {
                            throw conflict("Not enough seats left on that part of the ride: some are "
                                    + "being held for another passenger for a few minutes");
                        }
                    }, rideId, fromSeq, toSeq);
        }

        // Only legs that still have the seats are decremented. If any leg is short the
        // count comes up short and the rollback puts the others back.
        int taken = jdbc.update("""
                UPDATE ride_segments SET seats_available = seats_available - ?
                WHERE ride_id = ? AND seq >= ? AND seq < ? AND seats_available >= ?""",
                seats, rideId, fromSeq, toSeq, seats);
        if (taken != legs) {
            throw conflict("Not enough seats left on that part of the ride");
        }

        BookingStatus status = ride.instantBooking() ? BookingStatus.CONFIRMED : BookingStatus.PENDING;
        // Taken before the row exists: a booking is not part of its own history.
        String features = featuresJson(passengerId, seats, now, boarding, lastMileDistanceM, lastMileModeShown);
        Long bookingId;
        try {
            bookingId = jdbc.queryForObject("""
                    INSERT INTO bookings (ride_id, passenger_id, from_seq, to_seq, seats, price,
                                          status, hazard_features, accepted_at, idempotency_key,
                                          boarding_code, flex_tier, last_mile_distance_m, last_mile_mode_shown)
                    SELECT ?, ?, ?, ?, ?, SUM(price) * ?, ?, CAST(? AS jsonb), ?, ?, ?, ?, ?, ?
                    FROM ride_segments WHERE ride_id = ? AND seq >= ? AND seq < ?
                    RETURNING id""",
                    Long.class, rideId, passengerId, fromSeq, toSeq, seats, seats, status.name(),
                    features, status == BookingStatus.CONFIRMED ? utc(now) : null, idempotencyKey,
                    boardingCodes.newCode(), tier.name(), lastMileDistanceM, lastMileModeShown,
                    rideId, fromSeq, toSeq);
        } catch (DuplicateKeyException e) {
            // The same key, sent for a different ride at the same moment.
            throw conflict("This request was already submitted");
        }
        BigDecimal fare = jdbc.queryForObject(
                "SELECT price FROM bookings WHERE id = ?", BigDecimal.class, bookingId);
        payments.open(bookingId, passengerId, fare);
        if (away != null) {
            jdbc.update("""
                    UPDATE bookings SET pickup_location = ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
                                        pickup_offset_minutes = ?, detour_minutes = ?
                    WHERE id = ?""",
                    pickup.lon(), pickup.lat(), away.offsetMinutes(), away.detourMinutes(), bookingId);
        }

        // The seats are theirs now, so a hold on this ride has done its job.
        holds.of(passengerId).filter(hold -> hold.rideId() == rideId)
                .ifPresent(hold -> holds.release(passengerId));

        events.write(EventType.BOOKING_REQUESTED,
                new Requested(bookingId, rideId, passengerId, fromSeq, toSeq, seats, boarding,
                        lastMileDistanceM,
                        lastMileModeShown == null ? null : !"walk".equals(lastMileModeShown)));
        // Only a choice is logged: exact is what every booking was before tiers existed.
        if (tier != FlexTier.EXACT) {
            events.write(EventType.TIER_SELECTED,
                    new TierSelected(bookingId, passengerId, tier.name().toLowerCase(java.util.Locale.ROOT)));
        }
        if (status == BookingStatus.CONFIRMED) {
            events.write(EventType.BOOKING_ACCEPTED,
                    new Decided(bookingId, rideId, ride.driverId(), true));
        }
        // The ride's trip has begun for this booking too, as it did for those on board at
        // the start: every trip_completed or trip_failed then has its trip_started.
        if (underWay) {
            events.write(EventType.TRIP_STARTED,
                    new TripService.Trip(bookingId, rideId, passengerId, ride.driverId()));
        }
        Booking booking = load(bookingId);
        notifications.send(ride.driverId(), Type.BOOKING_REQUESTED,
                status == BookingStatus.CONFIRMED
                        ? Text.of("{passenger} booked {seats}.", "passenger", booking.passengerName(),
                                "seats", seatsText(booking))
                        : Text.of("{passenger} asked for {seats}.", "passenger", booking.passengerName(),
                                "seats", seatsText(booking)),
                bookingId);
        return booking;
    }

    @Transactional
    public Booking accept(long driverId, long bookingId) {
        Booking booking = lockForDriver(driverId, bookingId);
        move(booking, BookingStatus.CONFIRMED);
        jdbc.update("UPDATE bookings SET accepted_at = ? WHERE id = ?", utc(clock.instant()),
                bookingId);
        events.write(EventType.BOOKING_ACCEPTED,
                new Decided(bookingId, booking.rideId(), driverId, false));
        notifications.send(booking.passengerId(), Type.BOOKING_CONFIRMED,
                Text.of("The driver accepted your booking for {seats}.", "seats", seatsText(booking)), bookingId);
        return load(bookingId);
    }

    @Transactional
    public Booking reject(long driverId, long bookingId) {
        Booking booking = lockForDriver(driverId, bookingId);
        move(booking, BookingStatus.REJECTED);
        recordRejectedBy(bookingId, "driver");
        payments.oweNothing(bookingId);
        events.write(EventType.BOOKING_REJECTED,
                new Decided(bookingId, booking.rideId(), driverId, false));
        notifyDeclined(booking);
        return load(bookingId);
    }

    /** The driver says the passenger paid them what the booking owes. Only they can know. */
    @Transactional
    public Booking paymentReceived(long driverId, long bookingId, PaymentService.Method method) {
        Booking booking = lockForDriver(driverId, bookingId);
        BigDecimal amount = payments.due(bookingId).orElseThrow(() -> conflict("Nothing is due on this booking"));
        payments.paid(bookingId, method);
        notifications.send(booking.passengerId(), Type.PAYMENT_RECEIVED,
                Text.of(method == PaymentService.Method.CASH
                                ? "Your driver recorded Rs {amount} paid in cash for {seats}."
                                : "Your driver recorded Rs {amount} paid by UPI for {seats}.",
                        "amount", amount.toPlainString(), "seats", seatsText(booking)), bookingId);
        return load(bookingId);
    }

    /**
     * Staff let a passenger off what a booking owes: a driver who was paid and will not say so
     * must not stop them booking for ever. The reason goes in the audit log, not to either side.
     */
    @Transactional
    public Booking clearDue(long adminId, long bookingId, String reason) {
        Long rideId = rideOf(bookingId);
        if (rideId == null) {
            throw notFound("Booking not found");
        }
        LockedRide ride = lockRide(rideId);
        Booking booking = lockBooking(bookingId);
        BigDecimal amount = payments.due(bookingId).orElseThrow(() -> conflict("Nothing is due on this booking"));
        payments.clear(bookingId);
        audit.record(adminId, "PAYMENT_DUE_CLEARED", "booking", bookingId,
                Map.of("amount", amount.toPlainString(), "passenger_id", booking.passengerId(), "reason", reason));
        notifications.send(booking.passengerId(), Type.PAYMENT_RECEIVED,
                Text.of("VAYORA staff cleared what you owed for {seats}, so you can book again.",
                        "seats", seatsText(booking)), bookingId);
        notifications.send(ride.driverId(), Type.PAYMENT_RECEIVED,
                Text.of("VAYORA staff cleared what {passenger} owed you for {seats}.",
                        "passenger", booking.passengerName(), "seats", seatsText(booking)), bookingId);
        return load(bookingId);
    }

    public RequestTerms requestTerms() {
        return new RequestTerms(answerWithin.toMinutes(), closeBeforeBoarding.toMinutes());
    }

    /** Pending requests whose time for an answer has run out, oldest first. */
    public List<Long> unanswered() {
        Instant now = clock.instant();
        return jdbc.queryForList("""
                SELECT b.id
                FROM bookings b
                JOIN rides r ON r.id = b.ride_id
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                WHERE b.status = 'PENDING'
                  AND (b.created_at <= ?
                       OR r.departure_time + make_interval(mins => s.offset_minutes) <= ?)
                ORDER BY b.id""",
                Long.class, utc(now.minus(answerWithin)), utc(now.plus(closeBeforeBoarding)));
    }

    /**
     * Closes a request the driver has not answered in time: the seats go back and the
     * passenger owes nothing. Checked again under the lock, so a request the driver
     * answered a moment ago is left alone.
     *
     * @return whether the request was closed
     */
    @Transactional
    public boolean expire(long bookingId) {
        Long rideId = rideOf(bookingId);
        if (rideId == null) {
            return false;
        }
        LockedRide ride = lockRide(rideId);
        Booking booking = lockBooking(bookingId);
        Instant now = clock.instant();
        boolean due = !booking.createdAt().plus(answerWithin).isAfter(now)
                || !booking.boardingTime().minus(closeBeforeBoarding).isAfter(now);
        if (booking.status() != BookingStatus.PENDING || !due) {
            return false;
        }
        move(booking, BookingStatus.REJECTED);
        recordRejectedBy(bookingId, "platform");
        payments.oweNothing(bookingId);
        events.write(EventType.BOOKING_REJECTED,
                new Expired(bookingId, rideId, ride.driverId(), "not_answered_in_time"));
        notifications.send(booking.passengerId(), Type.REQUEST_EXPIRED,
                Text.of("The driver did not answer your request for {seats} in time, so it has been closed."
                        + " You owe nothing.", "seats", seatsText(booking)),
                bookingId);
        notifications.send(ride.driverId(), Type.REQUEST_EXPIRED,
                Text.of("{passenger}'s request for {seats} was closed because it was not answered in time.",
                        "passenger", booking.passengerName(), "seats", seatsText(booking)), bookingId);
        return true;
    }

    @Transactional
    public Booking cancel(long passengerId, long bookingId) {
        Long rideId = rideOf(bookingId);
        if (rideId == null) {
            throw notFound("Booking not found");
        }
        LockedRide ride = lockRide(rideId);
        Booking booking = lockBooking(bookingId);
        // Someone else's booking looks the same as one that does not exist.
        if (booking.passengerId() != passengerId) {
            throw notFound("Booking not found");
        }
        Instant now = clock.instant();
        if ("IN_PROGRESS".equals(ride.status()) || !booking.boardingTime().isAfter(now)) {
            throw conflict("This ride has already left; the booking can no longer be cancelled");
        }
        move(booking, BookingStatus.CANCELLED);
        recordCancelledBy(bookingId, "passenger");
        payments.settlePassengerCancellation(bookingId, booking.price(),
                booking.status() == BookingStatus.CONFIRMED, booking.boardingTime(), now);
        events.write(EventType.BOOKING_CANCELLED, new Cancelled(bookingId, booking.rideId(),
                passengerId, booking.seats(), booking.boardingTime(), "passenger", passengerId));
        notifications.send(ride.driverId(), Type.BOOKING_CANCELLED, payments.due(bookingId)
                .map(owed -> Text.of("{passenger} cancelled {seats}, late enough to owe you Rs {amount}.",
                        "passenger", booking.passengerName(), "seats", seatsText(booking), "amount", owed.toPlainString()))
                .orElseGet(() -> Text.of("{passenger} cancelled {seats}.", "passenger", booking.passengerName(),
                        "seats", seatsText(booking))), bookingId);
        return load(bookingId);
    }

    /**
     * Locks and returns the ride's bookings in one status, oldest first. The caller must
     * already hold the ride lock.
     */
    List<Booking> lockAll(long rideId, BookingStatus status) {
        return jdbc.query(SELECT_BOOKING + "WHERE b.ride_id = ? AND b.status = ? "
                + "ORDER BY b.id FOR UPDATE OF b", MAPPER, rideId, status.name());
    }

    public List<Booking> forPassenger(long passengerId) {
        return jdbc.query(SELECT_BOOKING + "WHERE b.passenger_id = ? ORDER BY b.id DESC",
                MAPPER, passengerId);
    }

    /** Bookings on a ride, visible only to the driver who published it. */
    public List<Booking> forRide(long driverId, long rideId) {
        Integer owned = jdbc.queryForObject(
                "SELECT COUNT(*) FROM rides WHERE id = ? AND driver_id = ?",
                Integer.class, rideId, driverId);
        if (owned == 0) {
            throw notFound("Ride not found");
        }
        return jdbc.query(SELECT_BOOKING + "WHERE b.ride_id = ? ORDER BY b.id", MAPPER, rideId);
    }

    /** Applies a status change and returns the seats when the booking stops holding them. */
    void move(Booking booking, BookingStatus next) {
        if (!booking.status().canTransitionTo(next)) {
            throw conflict("A " + booking.status() + " booking cannot become " + next);
        }
        jdbc.update("UPDATE bookings SET status = ?, updated_at = now() WHERE id = ?",
                next.name(), booking.id());
        if (booking.status().holdsSeats() && !next.holdsSeats()) {
            jdbc.update("""
                    UPDATE ride_segments SET seats_available = seats_available + ?
                    WHERE ride_id = ? AND seq >= ? AND seq < ?""",
                    booking.seats(), booking.rideId(), booking.fromSeq(), booking.toSeq());
        }
    }

    private Booking lockForDriver(long driverId, long bookingId) {
        Long rideId = rideOf(bookingId);
        if (rideId == null) {
            throw notFound("Booking not found");
        }
        LockedRide ride = lockRide(rideId);
        if (ride.driverId() != driverId) {
            throw notFound("Booking not found");
        }
        return lockBooking(bookingId);
    }

    /**
     * The booking an earlier request with this key made, or null if there was none.
     * A key reused for a different request is refused, not silently answered.
     */
    private Booking repeatOf(long passengerId, String key, long rideId, int fromSeq, int toSeq,
            int seats) {
        List<Long> found = jdbc.queryForList(
                "SELECT id FROM bookings WHERE passenger_id = ? AND idempotency_key = ?",
                Long.class, passengerId, key);
        if (found.isEmpty()) {
            return null;
        }
        Booking earlier = load(found.get(0));
        if (earlier.rideId() != rideId || earlier.fromSeq() != fromSeq
                || earlier.toSeq() != toSeq || earlier.seats() != seats) {
            throw conflict("This idempotency key was already used for a different booking");
        }
        return earlier;
    }

    void notifyDeclined(Booking booking) {
        notifications.send(booking.passengerId(), Type.BOOKING_DECLINED,
                Text.of("The driver did not accept your request for {seats}. You owe nothing.",
                        "seats", seatsText(booking)), booking.id());
    }

    /** "2 seats, Kolhapur to Pune", for messages. */
    static String seatsOn(Booking booking) {
        return seatsText(booking).render();
    }

    /** "2 seats, Kolhapur to Pune", to be translated. */
    static Text seatsText(Booking booking) {
        String n = String.valueOf(booking.seats());
        return booking.seats() == 1
                ? Text.of("{n} seat, {from} to {to}", "n", n, "from", booking.fromStop(), "to", booking.toStop())
                : Text.of("{n} seats, {from} to {to}", "n", n, "from", booking.fromStop(), "to", booking.toStop());
    }

    void recordRejectedBy(long bookingId, String who) {
        jdbc.update("UPDATE bookings SET rejected_by = ? WHERE id = ?", who, bookingId);
    }

    void recordCancelledBy(long bookingId, String who) {
        jdbc.update("UPDATE bookings SET cancelled_by = ? WHERE id = ?", who, bookingId);
    }

    /** Null if the features cannot be written; the booking goes ahead unscored. */
    private String featuresJson(long passengerId, int seats, Instant now, Instant boarding,
            Integer lastMileDistanceM, String lastMileModeShown) {
        try {
            return mapper.writeValueAsString(hazardFeatures.snapshot(
                    passengerId, seats, now, boarding, lastMileDistanceM, lastMileModeShown));
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    Long rideOf(long bookingId) {
        List<Long> found = jdbc.queryForList(
                "SELECT ride_id FROM bookings WHERE id = ?", Long.class, bookingId);
        return found.isEmpty() ? null : found.get(0);
    }

    /** Returns null when there is no such ride. */
    LockedRide lockRide(long rideId) {
        List<LockedRide> found = jdbc.query("""
                SELECT driver_id, instant_booking, status, departure_time, women_only, max_detour_minutes
                FROM rides WHERE id = ? FOR UPDATE""",
                (rs, n) -> new LockedRide(rs.getLong("driver_id"),
                        rs.getBoolean("instant_booking"), rs.getString("status"),
                        rs.getObject("departure_time", OffsetDateTime.class).toInstant(),
                        rs.getBoolean("women_only"), rs.getInt("max_detour_minutes")),
                rideId);
        return found.isEmpty() ? null : found.get(0);
    }

    Booking lockBooking(long bookingId) {
        jdbc.queryForObject("SELECT id FROM bookings WHERE id = ? FOR UPDATE", Long.class,
                bookingId);
        return load(bookingId);
    }

    Booking load(long bookingId) {
        return jdbc.queryForObject(SELECT_BOOKING + "WHERE b.id = ?", MAPPER, bookingId);
    }

    static ResponseStatusException notFound(String reason) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, reason);
    }

    static ResponseStatusException conflict(String reason) {
        return new ResponseStatusException(HttpStatus.CONFLICT, reason);
    }
}
