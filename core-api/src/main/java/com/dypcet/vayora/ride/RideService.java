package com.dypcet.vayora.ride;

import com.dypcet.vayora.eventlog.EventLogService;
import com.dypcet.vayora.eventlog.EventType;
import com.dypcet.vayora.eventlog.HasActor;
import com.dypcet.vayora.hold.SeatHolds;
import com.dypcet.vayora.pass.PassService;
import com.dypcet.vayora.payment.KeptRides;
import com.dypcet.vayora.payment.ServiceFee;
import com.dypcet.vayora.routing.RouteService;
import com.dypcet.vayora.routing.RouteService.Leg;
import com.dypcet.vayora.routing.RouteService.Point;
import com.dypcet.vayora.routing.RouteService.Route;
import com.dypcet.vayora.routing.Rickshaws;
import com.dypcet.vayora.routing.WalkingRoutes;
import com.dypcet.vayora.stopover.StopoverService;
import com.dypcet.vayora.supply.SupplyGapService;
import com.dypcet.vayora.vehicle.VehicleService;
import com.dypcet.vayora.vehicle.VehicleService.Comfort;
import com.dypcet.vayora.vehicle.VehicleService.Luggage;
import com.dypcet.vayora.vehicle.VehicleService.Vehicle;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.UUID;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RideService {

    /** A search date is a calendar day in India, which has one time zone. */
    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");
    private static final String BOARDING = "r.departure_time + make_interval(mins => o.offset_minutes)";
    private static final int MAX_REPEAT_WEEKS = 8;
    // Matches the web card's "x km to pickup" hint: below this, feature 91's plain walk
    // is not worth a last-mile event of its own.
    private static final long LAST_MILE_SHOWN_METRES = 1000;
    private static final String PASSENGER_SAYS_WOMAN =
            "EXISTS (SELECT 1 FROM profiles w WHERE w.user_id = :passenger AND w.gender = 'FEMALE')";
    private static final String DRIVER_CONFIRMED =
            "(u.email_verified_at IS NOT NULL OR u.phone_verified_at IS NOT NULL)";
    private static final String DRIVER_ID_CHECKED = """
            EXISTS (SELECT 1 FROM document_checks c
                    WHERE c.driver_id = u.id AND c.kind = 'IDENTITY' AND c.status = 'CHECKED')""";

    /** @param offsetMinutes minutes after the ride's departure at which it leaves this stop */
    public record StopInput(String name, double lat, double lon, int offsetMinutes) {
    }

    /**
     * @param segmentPrices       price per seat of each leg; one fewer than the stops
     * @param notes               anything the driver wants passengers to know; may be null
     * @param maxTwoInBack        the driver promises at most two passengers on the back seat
     * @param returnDepartureTime when the same stops are driven in reverse, with the same
     *                            prices and intervals; null for no return ride
     * @param repeatWeeks         how many further weeks the ride, and its return, are
     *                            published for at the same time of day
     * @param payAfterRide        passengers may book without paying and pay once the
     *                            booking ends, in the app or in cash to the driver
     */
    public record PublishRide(long vehicleId, Instant departureTime, int seatsOffered,
            boolean instantBooking, List<StopInput> stops, List<BigDecimal> segmentPrices,
            String notes, boolean maxTwoInBack, Instant returnDepartureTime, int repeatWeeks,
            boolean womenOnly, int maxDetourMinutes, boolean payAfterRide) {

        /** Paid when booking. */
        public PublishRide(long vehicleId, Instant departureTime, int seatsOffered,
                boolean instantBooking, List<StopInput> stops, List<BigDecimal> segmentPrices,
                String notes, boolean maxTwoInBack, Instant returnDepartureTime, int repeatWeeks,
                boolean womenOnly, int maxDetourMinutes) {
            this(vehicleId, departureTime, seatsOffered, instantBooking, stops, segmentPrices,
                    notes, maxTwoInBack, returnDepartureTime, repeatWeeks, womenOnly, maxDetourMinutes, false);
        }

        /** No detours: passengers board only at the stops. */
        public PublishRide(long vehicleId, Instant departureTime, int seatsOffered,
                boolean instantBooking, List<StopInput> stops, List<BigDecimal> segmentPrices,
                String notes, boolean maxTwoInBack, Instant returnDepartureTime, int repeatWeeks,
                boolean womenOnly) {
            this(vehicleId, departureTime, seatsOffered, instantBooking, stops, segmentPrices,
                    notes, maxTwoInBack, returnDepartureTime, repeatWeeks, womenOnly, 0);
        }

        /** One ride, once, with nothing said about it. */
        public PublishRide(long vehicleId, Instant departureTime, int seatsOffered,
                boolean instantBooking, List<StopInput> stops, List<BigDecimal> segmentPrices) {
            this(vehicleId, departureTime, seatsOffered, instantBooking, stops, segmentPrices,
                    null, false, null, 0, false);
        }

        /** Open to everyone. */
        public PublishRide(long vehicleId, Instant departureTime, int seatsOffered,
                boolean instantBooking, List<StopInput> stops, List<BigDecimal> segmentPrices,
                String notes, boolean maxTwoInBack, Instant returnDepartureTime, int repeatWeeks) {
            this(vehicleId, departureTime, seatsOffered, instantBooking, stops, segmentPrices,
                    notes, maxTwoInBack, returnDepartureTime, repeatWeeks, false);
        }
    }

    public record Stop(int seq, String name, double lat, double lon, Instant departureTime) {
    }

    /** Segment {@code seq} runs from stop {@code seq} to stop {@code seq + 1}. */
    public record Segment(int seq, BigDecimal price, int seatsTotal, int seatsAvailable) {
    }

    /**
     * @param distanceKm      length of the route; null on a ride with no recorded route
     * @param durationMinutes driving time of the route; null as above
     * @param routeSource     {@code OSRM} for a road route, {@code STRAIGHT_LINE} when the
     *                        stops were only joined up; null as above
     * @param path            the route to draw, as [lat, lon] pairs; empty as above
     * @param seriesSize      how many rides were published together with this one,
     *                        itself included; 1 for a ride published alone
     * @param payAfterRide    passengers may pay once their booking ends instead of when booking
     */
    public record Ride(long id, long driverId, String driverName, long vehicleId,
            Instant departureTime, int seatsOffered, boolean instantBooking, String status,
            List<Stop> stops, List<Segment> segments, Double distanceKm, Integer durationMinutes,
            String routeSource, List<double[]> path, String notes, boolean maxTwoInBack,
            int seriesSize, boolean womenOnly, int maxDetourMinutes, boolean payAfterRide) {
    }

    /**
     * One search result: a ride and the stretch of it the passenger would travel.
     *
     * @param fare              for the seats searched for
     * @param serviceFee        the platform's fee on that fare
     * @param total             fare plus fee: what booking it would hold
     * @param driverRating      mean of the stars the driver has received; null if none
     * @param driverRatingCount how many ratings that mean is over
     * @param pickupDistanceM   straight-line metres from where the passenger starts to the
     *                          boarding stop
     * @param dropoffDistanceM  straight-line metres from the alighting stop to where the
     *                          passenger is going
     * @param driverConfirmed   the driver has confirmed an email address or a phone number;
     *                          not an identity check
     * @param vehicle           make and model, as the driver entered them
     * @param comfort           the driver's own description of the car; null, like luggage,
     *                          if not said
     * @param payAfterRide      the driver lets passengers pay once the booking ends
     * @param driverIdChecked   VAYORA staff have seen the identity document the driver declared
     * @param insuranceChecked  VAYORA staff have seen the policy for the insurance shown; neither
     *                          of these two is a check with the issuer
     */
    public record Candidate(long rideId, String driverName, boolean instantBooking,
            int fromSeq, int toSeq, String fromStop, String toStop, Instant boardingTime,
            Instant arrivalTime, BigDecimal pricePerSeat, int seatsAvailable, BigDecimal fare,
            BigDecimal serviceFee, BigDecimal total, long driverId, Double driverRating,
            int driverRatingCount, long pickupDistanceM, long dropoffDistanceM,
            boolean driverConfirmed, boolean maxTwoInBack, String vehicle, String comfort,
            String luggage, boolean electric, boolean womenOnly, int driverRidesCompleted,
            int driverRidesWithdrawn, int pickupWalkMinutes, int dropoffWalkMinutes, boolean suggestFlexible,
            boolean underWay, boolean keptRides, String insurer, LocalDate insuredUntil,
            int matchScore, List<MatchScore.Reason> matchReasons, Integer detourMinutes,
            boolean walkOnFootpaths, Rickshaws.Estimate pickupRickshaw, Rickshaws.Estimate dropoffRickshaw,
            boolean payAfterRide, boolean driverIdChecked, boolean insuranceChecked) {

        Candidate withSeatsAvailable(int seats) {
            return new Candidate(rideId, driverName, instantBooking, fromSeq, toSeq, fromStop, toStop,
                    boardingTime, arrivalTime, pricePerSeat, seats, fare, serviceFee, total, driverId,
                    driverRating, driverRatingCount, pickupDistanceM, dropoffDistanceM,
                    driverConfirmed, maxTwoInBack, vehicle, comfort, luggage, electric, womenOnly,
                    driverRidesCompleted, driverRidesWithdrawn, pickupWalkMinutes, dropoffWalkMinutes, suggestFlexible,
                    underWay, keptRides, insurer, insuredUntil, matchScore, matchReasons, detourMinutes,
                    walkOnFootpaths, pickupRickshaw, dropoffRickshaw, payAfterRide, driverIdChecked, insuranceChecked);
        }

        Candidate withMatch(MatchScore.Match match) {
            return new Candidate(rideId, driverName, instantBooking, fromSeq, toSeq, fromStop, toStop,
                    boardingTime, arrivalTime, pricePerSeat, seatsAvailable, fare, serviceFee, total, driverId,
                    driverRating, driverRatingCount, pickupDistanceM, dropoffDistanceM,
                    driverConfirmed, maxTwoInBack, vehicle, comfort, luggage, electric, womenOnly,
                    driverRidesCompleted, driverRidesWithdrawn, pickupWalkMinutes, dropoffWalkMinutes, suggestFlexible,
                    underWay, keptRides, insurer, insuredUntil, match.score(), match.reasons(), detourMinutes,
                    walkOnFootpaths, pickupRickshaw, dropoffRickshaw, payAfterRide, driverIdChecked, insuranceChecked);
        }

        /** Picked up at the passenger's own point: no walk, later than the stop, and a detour for the driver. */
        Candidate withPickup(DetourService.Pickup pickup) {
            return new Candidate(rideId, driverName, instantBooking, fromSeq, toSeq, fromStop, toStop,
                    boardingTime.plus(Duration.ofMinutes(pickup.offsetMinutes())), arrivalTime, pricePerSeat,
                    seatsAvailable, fare, serviceFee, total, driverId, driverRating, driverRatingCount, 0,
                    dropoffDistanceM, driverConfirmed, maxTwoInBack, vehicle, comfort, luggage, electric, womenOnly,
                    driverRidesCompleted, driverRidesWithdrawn, 0, dropoffWalkMinutes, suggestFlexible,
                    underWay, keptRides, insurer, insuredUntil, matchScore, matchReasons, pickup.detourMinutes(),
                    walkOnFootpaths, null, dropoffRickshaw, payAfterRide, driverIdChecked, insuranceChecked);
        }

        /** Walking times worked out on footpaths, in place of the straight-line estimates. */
        Candidate withWalks(int pickupMinutes, int dropoffMinutes) {
            return new Candidate(rideId, driverName, instantBooking, fromSeq, toSeq, fromStop, toStop,
                    boardingTime, arrivalTime, pricePerSeat, seatsAvailable, fare, serviceFee, total, driverId,
                    driverRating, driverRatingCount, pickupDistanceM, dropoffDistanceM,
                    driverConfirmed, maxTwoInBack, vehicle, comfort, luggage, electric, womenOnly,
                    driverRidesCompleted, driverRidesWithdrawn, pickupMinutes, dropoffMinutes, suggestFlexible,
                    underWay, keptRides, insurer, insuredUntil, matchScore, matchReasons, detourMinutes, true,
                    pickupRickshaw, dropoffRickshaw, payAfterRide, driverIdChecked, insuranceChecked);
        }

        /** An auto-rickshaw estimate for either end where the walk is long; null where not offered. */
        Candidate withRickshaws(Rickshaws.Estimate pickup, Rickshaws.Estimate dropoff) {
            return new Candidate(rideId, driverName, instantBooking, fromSeq, toSeq, fromStop, toStop,
                    boardingTime, arrivalTime, pricePerSeat, seatsAvailable, fare, serviceFee, total, driverId,
                    driverRating, driverRatingCount, pickupDistanceM, dropoffDistanceM,
                    driverConfirmed, maxTwoInBack, vehicle, comfort, luggage, electric, womenOnly,
                    driverRidesCompleted, driverRidesWithdrawn, pickupWalkMinutes, dropoffWalkMinutes, suggestFlexible,
                    underWay, keptRides, insurer, insuredUntil, matchScore, matchReasons, detourMinutes,
                    walkOnFootpaths, pickup, dropoff, payAfterRide, driverIdChecked, insuranceChecked);
        }
    }

    /**
     * A person's place on a ride: its driver, or a passenger with a live booking on it.
     * The gateway asks for this before letting someone into the ride's chat.
     */
    public record Membership(long rideId, long userId, String fullName, String role,
            String rideStatus) {
    }

    /** How search results are ordered. Ties fall back to boarding time. */
    public enum Sort {
        TIME("boarding, id"),
        PRICE("price, boarding, id"),
        RATING("driver_rating DESC NULLS LAST, boarding, id"),
        PROXIMITY("pickup_m, boarding, id"),
        /** By {@link MatchScore}, highest first; worked out after the query, so time is only its tie-break. */
        BEST_MATCH("boarding, id");

        private final String orderBy;

        Sort(String orderBy) {
            this.orderBy = orderBy;
        }
    }

    /**
     * What a passenger may narrow a search by. Null or false means "do not narrow".
     *
     * <p>The last three look at what the driver has said or proved. A driver who has not
     * said is left out by them: silence is not a promise of a smoke-free car.
     *
     * @param earliestHour    boarding at or after this hour of the day in India, 0 to 23
     * @param latestHour      boarding before this hour, 1 to 24
     * @param maxPricePerSeat for the stretch the passenger would travel
     * @param confirmedDriver the driver has confirmed an email address or a phone number
     * @param idCheckedDriver VAYORA staff have seen the identity document the driver declared
     */
    public record Filters(Integer earliestHour, Integer latestHour, BigDecimal maxPricePerSeat,
            boolean instantOnly, boolean confirmedDriver, boolean smokeFree, boolean petsWelcome,
            boolean maxTwoInBack, boolean womenOnly, BigDecimal minPricePerSeat, boolean musicWelcome,
            boolean quietRide, Comfort comfortAtLeast, Luggage luggageAtLeast, boolean idCheckedDriver) {

        public static final Filters NONE = new Filters(null, null, null, false, false, false, false);

        public Filters(Integer earliestHour, Integer latestHour, BigDecimal maxPricePerSeat,
                boolean instantOnly, boolean confirmedDriver, boolean smokeFree, boolean petsWelcome,
                boolean maxTwoInBack, boolean womenOnly, BigDecimal minPricePerSeat, boolean musicWelcome,
                boolean quietRide, Comfort comfortAtLeast, Luggage luggageAtLeast) {
            this(earliestHour, latestHour, maxPricePerSeat, instantOnly, confirmedDriver, smokeFree,
                    petsWelcome, maxTwoInBack, womenOnly, minPricePerSeat, musicWelcome, quietRide,
                    comfortAtLeast, luggageAtLeast, false);
        }

        public Filters(Integer earliestHour, Integer latestHour, BigDecimal maxPricePerSeat,
                boolean instantOnly, boolean confirmedDriver, boolean smokeFree,
                boolean petsWelcome, boolean maxTwoInBack, boolean womenOnly) {
            this(earliestHour, latestHour, maxPricePerSeat, instantOnly, confirmedDriver, smokeFree,
                    petsWelcome, maxTwoInBack, womenOnly, null, false, false, null, null, false);
        }

        public Filters(Integer earliestHour, Integer latestHour, BigDecimal maxPricePerSeat,
                boolean instantOnly, boolean confirmedDriver, boolean smokeFree,
                boolean petsWelcome, boolean maxTwoInBack) {
            this(earliestHour, latestHour, maxPricePerSeat, instantOnly, confirmedDriver,
                    smokeFree, petsWelcome, maxTwoInBack, false);
        }

        public Filters(Integer earliestHour, Integer latestHour, BigDecimal maxPricePerSeat,
                boolean instantOnly, boolean confirmedDriver, boolean smokeFree,
                boolean petsWelcome) {
            this(earliestHour, latestHour, maxPricePerSeat, instantOnly, confirmedDriver,
                    smokeFree, petsWelcome, false);
        }

        public Filters {
            if (earliestHour != null && latestHour != null && earliestHour >= latestHour) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "The earliest hour must be before the latest");
            }
            if (minPricePerSeat != null && maxPricePerSeat != null
                    && minPricePerSeat.compareTo(maxPricePerSeat) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "The lowest price must not be above the highest");
            }
        }
    }

    /** @param suggestedPrice a starting point for the per-seat price of this leg */
    public record LegPreview(double distanceKm, int durationMinutes, BigDecimal suggestedPrice) {
    }

    /** What a route through some stops would look like, before a ride is published. */
    /** @param alongRoute rest stops and chargers near the route, in the order they are reached */
    public record RoutePreview(double distanceKm, int durationMinutes, String source,
            List<LegPreview> legs, List<double[]> path, List<StopoverService.Along> alongRoute) {
    }

    record SearchIssued(long passengerId, double originLat, double originLon,
            double destinationLat, double destinationLon, String date, int seats) implements HasActor {
        @Override
        public String actorType() {
            return "passenger";
        }

        @Override
        public Long actorId() {
            return passengerId;
        }
    }

    record CandidatesReturned(long passengerId, int count, List<Long> rideIds) implements HasActor {
        @Override
        public String actorType() {
            return "passenger";
        }

        @Override
        public Long actorId() {
            return passengerId;
        }
    }

    /** @param mode the access option shown alongside the stop: "walk" or "rickshaw" */
    record LastMileShown(long passengerId, long rideId, long distanceM, String mode) implements HasActor {
        @Override
        public String actorType() {
            return "passenger";
        }

        @Override
        public Long actorId() {
            return passengerId;
        }
    }

    /** A UI-only signal that the passenger tapped an access option; nothing is booked. */
    record LastMileOptionSelected(long passengerId, long rideId, String mode) implements HasActor {
        @Override
        public String actorType() {
            return "passenger";
        }

        @Override
        public Long actorId() {
            return passengerId;
        }
    }

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final VehicleService vehicles;
    private final EventLogService events;
    private final ServiceFee serviceFee;
    private final RouteService routes;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final double maxAccessMetres;
    private final BigDecimal suggestedRupeesPerKm;
    private final double walkingKmh;
    private final Duration midRouteLead;
    private final KeptRides keptRides;
    private final MatchScore.Weights matchWeights;
    private final DetourService detours;
    private final int maxDetourMinutes;
    private final double detourReachMetres;
    private final WalkingRoutes walking;
    private final Rickshaws rickshaws;
    private final double suggestFlexibleBelow;
    private final SeatHolds holds;
    private final PassService passes;
    private final StopoverService stopovers;
    private final SupplyGapService supply;

    public RideService(JdbcTemplate jdbc, VehicleService vehicles, EventLogService events,
            ServiceFee serviceFee, RouteService routes, ObjectMapper mapper, Clock clock,
            @Value("${vayora.search.max-access-km}") double maxAccessKm,
            @Value("${vayora.pricing.suggested-rupees-per-km}") BigDecimal suggestedRupeesPerKm,
            @Value("${vayora.search.walking-kmh}") double walkingKmh,
            @Value("${vayora.tiers.suggest-below}") double suggestFlexibleBelow,
            @Value("${vayora.booking.mid-route-lead}") Duration midRouteLead,
            SeatHolds holds, PassService passes, StopoverService stopovers, SupplyGapService supply,
            KeptRides keptRides,
            @Value("${vayora.search.match.distance}") int matchDistance,
            @Value("${vayora.search.match.price}") int matchPrice,
            @Value("${vayora.search.match.record}") int matchRecord,
            @Value("${vayora.search.match.preference}") int matchPreference,
            DetourService detours,
            @Value("${vayora.detour.max-minutes}") int maxDetourMinutes,
            @Value("${vayora.detour.reach-km}") double detourReachKm,
            WalkingRoutes walking, Rickshaws rickshaws) {
        this.walking = walking;
        this.rickshaws = rickshaws;
        this.matchWeights = new MatchScore.Weights(matchDistance, matchPrice, matchRecord, matchPreference);
        this.detours = detours;
        this.maxDetourMinutes = maxDetourMinutes;
        this.detourReachMetres = detourReachKm * 1000.0;
        this.keptRides = keptRides;
        this.supply = supply;
        this.stopovers = stopovers;
        this.passes = passes;
        this.holds = holds;
        this.jdbc = jdbc;
        this.named = new NamedParameterJdbcTemplate(jdbc);
        this.vehicles = vehicles;
        this.events = events;
        this.serviceFee = serviceFee;
        this.routes = routes;
        this.mapper = mapper;
        this.clock = clock;
        this.maxAccessMetres = maxAccessKm * 1000.0;
        this.suggestedRupeesPerKm = suggestedRupeesPerKm;
        this.walkingKmh = walkingKmh;
        this.suggestFlexibleBelow = suggestFlexibleBelow;
        this.midRouteLead = midRouteLead;
    }

    @Transactional
    public Ride publish(long driverId, PublishRide ride) {
        Vehicle vehicle = validate(driverId, ride);
        // Asked before anything is written: a slow routing service must not hold locks.
        Route route = routes.through(points(ride.stops()));
        List<StopInput> stopsBack = ride.returnDepartureTime() == null ? null : reversed(ride.stops());
        Route routeBack = stopsBack == null ? null : routes.through(points(stopsBack));
        withinRange(vehicle, route);
        if (routeBack != null) {
            withinRange(vehicle, routeBack);
        }
        List<BigDecimal> pricesBack = new ArrayList<>(ride.segmentPrices());
        Collections.reverse(pricesBack);

        // Published together or not at all: a driver is never left with half a series.
        UUID seriesId = stopsBack != null || ride.repeatWeeks() > 0 ? UUID.randomUUID() : null;
        Long first = null;
        for (int week = 0; week <= ride.repeatWeeks(); week++) {
            long rideId = insert(driverId, ride, ride.stops(), ride.segmentPrices(),
                    weeksLater(ride.departureTime(), week), route, seriesId);
            first = first == null ? rideId : first;
            supply.published(driverId, rideId);
            if (stopsBack != null) {
                supply.published(driverId, insert(driverId, ride, stopsBack, pricesBack,
                        weeksLater(ride.returnDepartureTime(), week), routeBack, seriesId));
            }
        }
        return get(first);
    }

    private long insert(long driverId, PublishRide ride, List<StopInput> stops,
            List<BigDecimal> prices, Instant departure, Route route, UUID seriesId) {
        String notes = ride.notes() == null || ride.notes().isBlank() ? null : ride.notes().strip();
        Long rideId = jdbc.queryForObject("""
                INSERT INTO rides (driver_id, vehicle_id, departure_time, seats_offered,
                                   instant_booking, status, route, distance_m, duration_s,
                                   route_source, notes, max_two_in_back, series_id, women_only,
                                   max_detour_minutes, pay_after_ride)
                VALUES (?, ?, ?, ?, ?, 'SCHEDULED', ST_GeogFromText(?), ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id""",
                Long.class, driverId, ride.vehicleId(), utc(departure),
                ride.seatsOffered(), ride.instantBooking(), lineString(route.path()),
                route.distanceMetres(), route.durationSeconds(), route.source(), notes,
                ride.maxTwoInBack(), seriesId, ride.womenOnly(), ride.maxDetourMinutes(), ride.payAfterRide());

        for (int seq = 0; seq < stops.size(); seq++) {
            StopInput stop = stops.get(seq);
            jdbc.update("""
                    INSERT INTO ride_stops (ride_id, seq, name, location, offset_minutes)
                    VALUES (?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)""",
                    rideId, seq, stop.name().strip(), stop.lon(), stop.lat(), stop.offsetMinutes());
        }
        for (int seq = 0; seq < prices.size(); seq++) {
            jdbc.update("""
                    INSERT INTO ride_segments (ride_id, seq, price, seats_total, seats_available)
                    VALUES (?, ?, ?, ?, ?)""",
                    rideId, seq, prices.get(seq), ride.seatsOffered(), ride.seatsOffered());
        }
        return rideId;
    }

    /** The same stops driven the other way, each interval between stops kept as it was. */
    private static List<StopInput> reversed(List<StopInput> stops) {
        int total = stops.get(stops.size() - 1).offsetMinutes();
        List<StopInput> back = new ArrayList<>();
        for (int i = stops.size() - 1; i >= 0; i--) {
            StopInput stop = stops.get(i);
            back.add(new StopInput(stop.name(), stop.lat(), stop.lon(), total - stop.offsetMinutes()));
        }
        return back;
    }

    /** The same time of day in India, so many weeks on. */
    private static Instant weeksLater(Instant time, int weeks) {
        return time.atZone(INDIA_ZONE).plusWeeks(weeks).toInstant();
    }

    /**
     * Whether to suggest a flexible booking on this driver's ride: they have withdrawn rides,
     * and completed fewer than the configured share. From the driver's own record only.
     */
    private boolean weakRecord(int completed, int withdrawn) {
        return withdrawn > 0 && (double) completed / (completed + withdrawn) < suggestFlexibleBelow;
    }

    /** A rough walk, in a straight line at the configured pace, rounded up to the minute. */
    private int walkMinutes(double metres) {
        return (int) Math.ceil(metres / (walkingKmh * 1000.0) * 60.0);
    }

    /** The route through these stops, with a suggested price for each leg. */
    public RoutePreview preview(List<Point> stops) {
        Route route = routes.through(stops);
        List<LegPreview> legs = route.legs().stream()
                .map(leg -> new LegPreview(km(leg.distanceMetres()), minutes(leg.durationSeconds()),
                        suggestedPrice(leg)))
                .toList();
        double distanceKm = km(route.distanceMetres());
        int durationMinutes = minutes(route.durationSeconds());
        return new RoutePreview(distanceKm, durationMinutes, route.source(), legs, route.path(),
                stopovers.along(route.path(), distanceKm, durationMinutes));
    }

    /** Distance times the configured rate, to the nearest ten rupees. */
    private BigDecimal suggestedPrice(Leg leg) {
        return BigDecimal.valueOf(leg.distanceMetres() / 1000.0).multiply(suggestedRupeesPerKm)
                .divide(BigDecimal.TEN, 0, RoundingMode.HALF_UP).multiply(BigDecimal.TEN);
    }

    /** What the member chose on their profile. Nobody has checked it. */
    private boolean saysSheIsAWoman(long userId) {
        return jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = ? AND gender = 'FEMALE')",
                Boolean.class, userId);
    }

    /**
     * An electric car must cover each stretch between stops on one charge, by the driver's own
     * figures: it can charge at a stop, not between two. Compared to the tenth of a kilometre,
     * as the route preview shows it, so the two never disagree. Off the routing service's map,
     * or when it is down, the stretches are straight lines, shorter than the road, and this is
     * lenient.
     */
    private static void withinRange(Vehicle vehicle, Route route) {
        Integer range = vehicle.estimatedRangeKm();
        if (vehicle.electric() && range != null
                && route.legs().stream().anyMatch(leg -> km(leg.distanceMetres()) > range)) {
            throw badRequest("A stretch between two stops is longer than your vehicle covers on a full "
                    + "charge, by your own figures. Add a stop where you can charge.");
        }
    }

    private Vehicle validate(long driverId, PublishRide ride) {
        Vehicle vehicle = vehicles.findOwned(ride.vehicleId(), driverId);
        if (vehicle == null) {
            throw badRequest("Vehicle not found among your vehicles");
        }
        if (ride.womenOnly() && !saysSheIsAWoman(driverId)) {
            throw badRequest("Only a driver whose profile says she is a woman can offer a "
                    + "women-only ride. Set your gender on your account page first.");
        }
        if (ride.seatsOffered() > vehicle.seats() - 1) {
            throw badRequest("This vehicle can offer at most " + (vehicle.seats() - 1) + " seats");
        }
        if (ride.maxDetourMinutes() < 0 || ride.maxDetourMinutes() > maxDetourMinutes) {
            throw badRequest("That is more detour than a ride may offer");
        }
        if (!ride.departureTime().isAfter(clock.instant())) {
            throw badRequest("Departure time must be in the future");
        }
        if (ride.segmentPrices().size() != ride.stops().size() - 1) {
            throw badRequest("A ride needs exactly one price per leg between stops");
        }
        if (ride.stops().get(0).offsetMinutes() != 0) {
            throw badRequest("The first stop must have offsetMinutes 0");
        }
        for (int i = 1; i < ride.stops().size(); i++) {
            if (ride.stops().get(i).offsetMinutes() <= ride.stops().get(i - 1).offsetMinutes()) {
                throw badRequest("Stops must be in travel order with increasing offsetMinutes");
            }
        }
        if (ride.repeatWeeks() < 0 || ride.repeatWeeks() > MAX_REPEAT_WEEKS) {
            throw badRequest("A ride can repeat for at most " + MAX_REPEAT_WEEKS + " further weeks");
        }
        if (ride.returnDepartureTime() != null) {
            int lastOffset = ride.stops().get(ride.stops().size() - 1).offsetMinutes();
            Instant arrival = ride.departureTime().plus(Duration.ofMinutes(lastOffset));
            if (!ride.returnDepartureTime().isAfter(arrival)) {
                throw badRequest("The return must leave after the ride out has arrived");
            }
        }
        return vehicle;
    }

    public Ride get(long rideId) {
        List<Stop> stops = jdbc.query("""
                SELECT s.seq, s.name, ST_Y(s.location::geometry) AS lat,
                       ST_X(s.location::geometry) AS lon,
                       r.departure_time + make_interval(mins => s.offset_minutes) AS leaves_at
                FROM ride_stops s JOIN rides r ON r.id = s.ride_id
                WHERE s.ride_id = ? ORDER BY s.seq""",
                (rs, n) -> new Stop(rs.getInt("seq"), rs.getString("name"), rs.getDouble("lat"),
                        rs.getDouble("lon"),
                        rs.getObject("leaves_at", OffsetDateTime.class).toInstant()),
                rideId);
        List<Segment> segments = jdbc.query("""
                SELECT seq, price, seats_total, seats_available
                FROM ride_segments WHERE ride_id = ? ORDER BY seq""",
                (rs, n) -> new Segment(rs.getInt("seq"), rs.getBigDecimal("price"),
                        rs.getInt("seats_total"), rs.getInt("seats_available")),
                rideId);
        List<Ride> found = jdbc.query("""
                SELECT r.id, r.driver_id, r.vehicle_id, r.departure_time, r.seats_offered,
                       r.instant_booking, r.status, r.distance_m, r.duration_s, r.route_source,
                       ST_AsGeoJSON(r.route::geometry) AS route_json, u.full_name,
                       r.notes, r.max_two_in_back, r.women_only, r.max_detour_minutes, r.pay_after_ride,
                       CASE WHEN r.series_id IS NULL THEN 1
                            ELSE (SELECT COUNT(*) FROM rides s WHERE s.series_id = r.series_id)
                       END AS series_size
                FROM rides r JOIN users u ON u.id = r.driver_id
                WHERE r.id = ?""",
                (rs, n) -> new Ride(rs.getLong("id"), rs.getLong("driver_id"),
                        rs.getString("full_name"), rs.getLong("vehicle_id"),
                        rs.getObject("departure_time", OffsetDateTime.class).toInstant(),
                        rs.getInt("seats_offered"), rs.getBoolean("instant_booking"),
                        rs.getString("status"), stops, segments,
                        rs.getObject("distance_m") == null ? null : km(rs.getDouble("distance_m")),
                        rs.getObject("duration_s") == null ? null : minutes(rs.getDouble("duration_s")),
                        rs.getString("route_source"), path(rs.getString("route_json")),
                        rs.getString("notes"), rs.getBoolean("max_two_in_back"),
                        rs.getInt("series_size"), rs.getBoolean("women_only"),
                        rs.getInt("max_detour_minutes"), rs.getBoolean("pay_after_ride")),
                rideId);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ride not found");
        }
        return found.get(0);
    }

    /**
     * Whether this user is on the ride. A passenger counts while their booking is pending
     * or confirmed; one who cancelled or was declined does not. Someone not on the ride
     * and a ride that does not exist are the same 404.
     */
    public Membership membership(long userId, long rideId) {
        List<Membership> found = jdbc.query("""
                SELECT u.full_name, r.status,
                       CASE WHEN r.driver_id = u.id THEN 'DRIVER' ELSE 'PASSENGER' END AS role
                FROM rides r JOIN users u ON u.id = ?
                WHERE r.id = ?
                  AND (r.driver_id = u.id
                       OR EXISTS (SELECT 1 FROM bookings b
                                  WHERE b.ride_id = r.id AND b.passenger_id = u.id
                                    AND b.status IN ('PENDING', 'CONFIRMED')))""",
                (rs, n) -> new Membership(rideId, userId, rs.getString("full_name"),
                        rs.getString("role"), rs.getString("status")),
                userId, rideId);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ride not found");
        }
        return found.get(0);
    }

    /**
     * A UI-only signal that a passenger tapped a last-mile access option on a search
     * result (feature 91's walk, or a rickshaw estimate); nothing is booked by it.
     */
    public void lastMileOptionSelected(long passengerId, long rideId, String mode) {
        events.write(EventType.LAST_MILE_OPTION_SELECTED,
                new LastMileOptionSelected(passengerId, rideId, mode));
    }

    /** A driver's own rides, soonest departure first. */
    public List<Ride> publishedBy(long driverId) {
        return jdbc.queryForList(
                "SELECT id FROM rides WHERE driver_id = ? ORDER BY departure_time, id",
                Long.class, driverId)
                .stream().map(this::get).toList();
    }

    /**
     * Finds scheduled rides the passenger could take on the given day: one with a stop
     * within the access distance of where they start, a later stop within it of where they
     * are going, and the seats free on every leg in between.
     *
     * <p>The access distance is a hard limit, measured in a straight line. A ride outside it
     * is not returned however it would have ranked. When a ride has more than one stop in
     * range at either end, the pair nearest the passenger is used.
     */
    public List<Candidate> search(long passengerId, Point origin, Point destination,
            LocalDate date, int seats, Sort sort) {
        return search(passengerId, origin, destination, date, seats, sort, Filters.NONE);
    }

    /** As above, narrowed by the filters. A filter never widens what the search returns. */
    public List<Candidate> search(long passengerId, Point origin, Point destination,
            LocalDate date, int seats, Sort sort, Filters filters) {
        return find(passengerId, origin, destination, date, seats, sort, filters, true);
    }

    /**
     * Other rides that could take a passenger whose ride was withdrawn: the same stretch,
     * leaving within {@code window} of when they were to board, with the seats they had.
     * Not a search the passenger made, so nothing is written to the research log.
     */
    public List<Candidate> alternatives(long passengerId, long withdrawnRideId, Point origin,
            Point destination, Instant boarding, int seats, Duration window, int most) {
        return find(passengerId, origin, destination, boarding.atZone(INDIA_ZONE).toLocalDate(),
                seats, Sort.TIME, Filters.NONE, false).stream()
                .filter(c -> c.rideId() != withdrawnRideId)
                .filter(c -> Duration.between(boarding, c.boardingTime()).abs().compareTo(window) <= 0)
                .limit(most)
                .toList();
    }

    private List<Candidate> find(long passengerId, Point origin, Point destination,
            LocalDate date, int seats, Sort sort, Filters filters, boolean logged) {
        // Three decimals is about a hundred metres: enough for the research log, without
        // recording anyone's doorstep.
        if (logged) {
            events.write(EventType.SEARCH_ISSUED, new SearchIssued(passengerId,
                    coarse(origin.lat()), coarse(origin.lon()), coarse(destination.lat()),
                    coarse(destination.lon()), date.toString(), seats));
        }

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("olat", origin.lat()).addValue("olon", origin.lon())
                .addValue("dlat", destination.lat()).addValue("dlon", destination.lon())
                .addValue("radius", maxAccessMetres)
                .addValue("dayStart", utc(date.atStartOfDay(INDIA_ZONE).toInstant()))
                .addValue("dayEnd", utc(date.plusDays(1).atStartOfDay(INDIA_ZONE).toInstant()))
                .addValue("now", utc(clock.instant()))
                .addValue("midRouteCutoff", utc(clock.instant().plus(midRouteLead)))
                .addValue("keptSince", utc(keptRides.windowStart()))
                .addValue("seats", seats)
                .addValue("passenger", passengerId)
                .addValue("zone", INDIA_ZONE.getId())
                .addValue("earliestHour", filters.earliestHour())
                .addValue("latestHour", filters.latestHour())
                .addValue("maxPrice", filters.maxPricePerSeat())
                .addValue("minPrice", filters.minPricePerSeat())
                .addValue("comfort", filters.comfortAtLeast() == null ? null : filters.comfortAtLeast().name())
                .addValue("luggage", filters.luggageAtLeast() == null ? null : filters.luggageAtLeast().name());
        // Each fragment is a constant chosen by a flag; caller values are bound, never spliced.
        String boardingHour = "EXTRACT(HOUR FROM (" + BOARDING + ") AT TIME ZONE :zone)";
        String narrowed = (filters.earliestHour() == null ? "" : " AND " + boardingHour + " >= :earliestHour")
                + (filters.latestHour() == null ? "" : " AND " + boardingHour + " < :latestHour")
                + (filters.maxPricePerSeat() == null ? "" : " AND legs.price <= :maxPrice")
                + (filters.instantOnly() ? " AND r.instant_booking" : "")
                + (filters.confirmedDriver() ? " AND " + DRIVER_CONFIRMED : "")
                + (filters.idCheckedDriver() ? " AND " + DRIVER_ID_CHECKED : "")
                + (filters.smokeFree() ? " AND p.smoking IS FALSE" : "")
                + (filters.petsWelcome() ? " AND p.pets IS TRUE" : "")
                + (filters.maxTwoInBack() ? " AND r.max_two_in_back" : "")
                + (filters.womenOnly() ? " AND r.women_only" : "")
                + (filters.minPricePerSeat() == null ? "" : " AND legs.price >= :minPrice")
                + (filters.musicWelcome() ? " AND p.music IS TRUE" : "")
                + (filters.quietRide() ? " AND p.chattiness = 'QUIET'" : "")
                // An unstated class or allowance never meets a minimum.
                + (filters.comfortAtLeast() == null ? ""
                        : " AND array_position(ARRAY['BASIC','COMFORT','PREMIUM'], v.comfort)"
                          + " >= array_position(ARRAY['BASIC','COMFORT','PREMIUM'], :comfort)")
                + (filters.luggageAtLeast() == null ? ""
                        : " AND array_position(ARRAY['NONE','SMALL','MEDIUM','LARGE'], v.luggage)"
                          + " >= array_position(ARRAY['NONE','SMALL','MEDIUM','LARGE'], :luggage)")
                // Not a filter: a women-only ride is never offered to anyone else.
                + " AND (NOT r.women_only OR " + PASSENGER_SAYS_WOMAN + ")";
        // What the passenger would pay now: a running pass waives the fee.
        boolean covered = passes.covers(passengerId, clock.instant());
        // Each driver's stated preferences, read with the results, for the match score.
        Map<Long, MatchScore.Preferences> driverSays = new HashMap<>();
        // Where each result boards and alights, for walking times on footpaths.
        Map<Long, Point[]> stopsAt = new HashMap<>();
        // Which boarding stops to try: those near the passenger, or, for pickups away from the
        // stops, the stop before each pickup. Both are constants here, never caller text, as
        // is sort.orderBy.
        java.util.function.Function<String, List<Candidate>> boardingAt = originMatch -> named.query("""
                WITH want AS (
                    SELECT ST_SetSRID(ST_MakePoint(:olon, :olat), 4326)::geography AS origin,
                           ST_SetSRID(ST_MakePoint(:dlon, :dlat), 4326)::geography AS destination
                )
                SELECT * FROM (
                    SELECT DISTINCT ON (r.id)
                           r.id, u.full_name, r.instant_booking, r.driver_id, r.max_two_in_back, r.pay_after_ride,
                           r.women_only, r.status = 'IN_PROGRESS' AS under_way,
                           v.make || ' ' || v.model AS vehicle, v.comfort, v.luggage, v.electric,
                           -- Declared insurance, only while it covers the day the trip ends.
                           CASE WHEN v.insured_until >= ((r.departure_time + make_interval(mins => d.offset_minutes))
                                                         AT TIME ZONE :zone)::date
                                THEN v.insurer END AS insurer,
                           CASE WHEN v.insured_until >= ((r.departure_time + make_interval(mins => d.offset_minutes))
                                                         AT TIME ZONE :zone)::date
                                THEN v.insured_until END AS insured_until,
                           (SELECT AVG(stars)::float8 FROM ratings WHERE ratee_id = r.driver_id)
                               AS driver_rating,
                           (SELECT COUNT(*) FROM ratings WHERE ratee_id = r.driver_id)
                               AS driver_rating_count,
                           (SELECT COUNT(*) FROM rides x WHERE x.driver_id = r.driver_id AND x.status = 'COMPLETED')
                               AS driver_completed,
                           (SELECT COUNT(*) FROM rides x WHERE x.driver_id = r.driver_id AND x.status = 'CANCELLED')
                               AS driver_withdrawn,
                           (SELECT COUNT(*) FROM rides x WHERE x.driver_id = r.driver_id AND x.status = 'CANCELLED'
                                   AND x.departure_time >= :keptSince)
                               AS driver_withdrawn_lately,
                           o.seq AS from_seq, d.seq AS to_seq,
                           o.name AS from_stop, d.name AS to_stop,
                           r.departure_time + make_interval(mins => o.offset_minutes) AS boarding,
                           r.departure_time + make_interval(mins => d.offset_minutes) AS arrival,
                           ST_Distance(o.location, want.origin) AS pickup_m,
                           ST_Distance(d.location, want.destination) AS dropoff_m,
                           legs.price, legs.seats,
                           p.smoking AS driver_smoking, p.pets AS driver_pets, p.music AS driver_music,
                           p.chattiness AS driver_chattiness,
                           ST_Y(o.location::geometry) AS from_lat, ST_X(o.location::geometry) AS from_lon,
                           ST_Y(d.location::geometry) AS to_lat, ST_X(d.location::geometry) AS to_lon,
                           EXISTS (SELECT 1 FROM document_checks c
                                   WHERE c.vehicle_id = v.id AND c.status = 'CHECKED') AS insurance_checked,
                           """ + DRIVER_ID_CHECKED + """
                                AS driver_id_checked,
                           """ + DRIVER_CONFIRMED + """
                                AS driver_confirmed
                    FROM want
                    JOIN ride_stops o ON\s""" + originMatch + """

                    JOIN rides r ON r.id = o.ride_id
                    JOIN users u ON u.id = r.driver_id
                    JOIN vehicles v ON v.id = r.vehicle_id
                    LEFT JOIN profiles p ON p.user_id = r.driver_id
                    JOIN ride_stops d ON d.ride_id = r.id AND d.seq > o.seq
                                     AND ST_DWithin(d.location, want.destination, :radius)
                    CROSS JOIN LATERAL (
                        SELECT SUM(s.price) AS price, MIN(s.seats_available) AS seats
                        FROM ride_segments s
                        WHERE s.ride_id = r.id AND s.seq >= o.seq AND s.seq < d.seq
                    ) legs
                    -- A ride already on the road only from a stop it is not yet near, counted
                    -- from its start if that was early, and only if it confirms instantly.
                    -- BookingService.request and SeatHoldController apply the same rule.
                    WHERE (r.status = 'SCHEDULED'
                           OR r.status = 'IN_PROGRESS' AND r.instant_booking
                              AND LEAST(r.departure_time, r.started_at)
                                  + make_interval(mins => o.offset_minutes) > :midRouteCutoff)
                      AND r.departure_time + make_interval(mins => o.offset_minutes) >= :dayStart
                      AND r.departure_time + make_interval(mins => o.offset_minutes) < :dayEnd
                      AND r.departure_time + make_interval(mins => o.offset_minutes) > :now
                      AND legs.seats >= :seats
                    """ + narrowed + """
                    ORDER BY r.id,
                             ST_Distance(o.location, want.origin)
                                 + ST_Distance(d.location, want.destination)
                ) c
                ORDER BY\s""" + sort.orderBy,
                params,
                (rs, n) -> {
                    BigDecimal fare = rs.getBigDecimal("price").multiply(BigDecimal.valueOf(seats));
                    // The same rule PaymentService charges by: the fee shown is the fee held.
                    boolean kept = keptRides.qualifies(rs.getInt("driver_completed"), rs.getInt("driver_withdrawn_lately"));
                    BigDecimal fee = covered ? BigDecimal.ZERO.setScale(2) : serviceFee.on(fare, kept);
                    stopsAt.put(rs.getLong("id"), new Point[] {
                            new Point(rs.getDouble("from_lat"), rs.getDouble("from_lon")),
                            new Point(rs.getDouble("to_lat"), rs.getDouble("to_lon"))});
                    driverSays.put(rs.getLong("id"), new MatchScore.Preferences(
                            rs.getObject("driver_smoking", Boolean.class), rs.getObject("driver_pets", Boolean.class),
                            rs.getObject("driver_music", Boolean.class), rs.getString("driver_chattiness")));
                    return new Candidate(rs.getLong("id"), rs.getString("full_name"),
                            rs.getBoolean("instant_booking"), rs.getInt("from_seq"),
                            rs.getInt("to_seq"), rs.getString("from_stop"), rs.getString("to_stop"),
                            rs.getObject("boarding", OffsetDateTime.class).toInstant(),
                            rs.getObject("arrival", OffsetDateTime.class).toInstant(),
                            rs.getBigDecimal("price"), rs.getInt("seats"), fare, fee, fare.add(fee),
                            rs.getLong("driver_id"), (Double) rs.getObject("driver_rating"),
                            rs.getInt("driver_rating_count"),
                            Math.round(rs.getDouble("pickup_m")), Math.round(rs.getDouble("dropoff_m")),
                            rs.getBoolean("driver_confirmed"), rs.getBoolean("max_two_in_back"),
                            rs.getString("vehicle"), rs.getString("comfort"),
                            rs.getString("luggage"), rs.getBoolean("electric"),
                            rs.getBoolean("women_only"), rs.getInt("driver_completed"),
                            rs.getInt("driver_withdrawn"), walkMinutes(rs.getDouble("pickup_m")),
                            walkMinutes(rs.getDouble("dropoff_m")),
                            weakRecord(rs.getInt("driver_completed"), rs.getInt("driver_withdrawn")),
                            rs.getBoolean("under_way"), kept, rs.getString("insurer"),
                            rs.getObject("insured_until", LocalDate.class), 0, List.of(), null, false, null, null,
                            rs.getBoolean("pay_after_ride"), rs.getBoolean("driver_id_checked"),
                            rs.getBoolean("insurance_checked"));
                });

        List<Candidate> candidates = boardingAt.apply("ST_DWithin(o.location, want.origin, :radius)");
        List<Candidate> pickedUp = pickupsAway(params, origin, boardingAt);
        if (!pickedUp.isEmpty()) {
            candidates = java.util.stream.Stream.concat(candidates.stream(), pickedUp.stream())
                    .sorted(order(sort)).toList();
        }

        candidates = candidates.stream()
                .map(candidate -> lessHeld(candidate, passengerId)).filter(c -> c.seatsAvailable() >= seats)
                .toList();
        candidates = walked(candidates, origin, destination, stopsAt);
        candidates = rickshawed(candidates, origin, destination, stopsAt);
        if (logged) {
            for (Candidate candidate : candidates) {
                if (candidate.pickupDistanceM() >= LAST_MILE_SHOWN_METRES) {
                    events.write(EventType.LAST_MILE_SHOWN, new LastMileShown(passengerId,
                            candidate.rideId(), candidate.pickupDistanceM(),
                            candidate.pickupRickshaw() != null ? "rickshaw" : "walk"));
                }
            }
        }
        candidates = matched(candidates, preferencesOf(passengerId), driverSays);
        if (sort == Sort.BEST_MATCH) {
            candidates = candidates.stream()
                    .sorted(Comparator.comparingInt(Candidate::matchScore).reversed()
                            .thenComparing(Candidate::boardingTime).thenComparingLong(Candidate::rideId))
                    .toList();
        }

        if (logged) {
            events.write(EventType.CANDIDATES_RETURNED, new CandidatesReturned(passengerId,
                    candidates.size(), candidates.stream().map(Candidate::rideId).toList()));
        }
        return candidates;
    }

    /**
     * Rides with no stop near the passenger's start whose road passes near it, and whose
     * driver will still go far enough out of their way to pick the passenger up there
     * (feature 28). Each comes back as from the stop before the pickup, then moved to it.
     */
    private List<Candidate> pickupsAway(MapSqlParameterSource params, Point origin,
            java.util.function.Function<String, List<Candidate>> boardingAt) {
        params.addValue("reach", detourReachMetres);
        List<long[]> eligible = named.query("""
                WITH want AS (
                    SELECT ST_SetSRID(ST_MakePoint(:olon, :olat), 4326)::geography AS origin,
                           ST_SetSRID(ST_MakePoint(:dlon, :dlat), 4326)::geography AS destination
                )
                SELECT DISTINCT ON (r.id) r.id, d.seq AS to_seq
                FROM want
                JOIN rides r ON r.status = 'SCHEDULED' AND r.max_detour_minutes > 0
                            AND r.route IS NOT NULL AND ST_DWithin(r.route, want.origin, :reach)
                            AND r.departure_time >= CAST(:dayStart AS timestamptz) - interval '12 hours'
                            AND r.departure_time < :dayEnd
                JOIN ride_stops d ON d.ride_id = r.id AND d.seq > 0
                                 AND ST_DWithin(d.location, want.destination, :radius)
                WHERE NOT EXISTS (SELECT 1 FROM ride_stops o WHERE o.ride_id = r.id AND o.seq < d.seq
                                    AND ST_DWithin(o.location, want.origin, :radius))
                ORDER BY r.id, ST_Distance(d.location, want.destination)""",
                params, (rs, n) -> new long[] {rs.getLong("id"), rs.getInt("to_seq")});
        Map<Long, DetourService.Pickup> pickups = new HashMap<>();
        for (long[] ride : eligible) {
            int left = detours.minutesLeft(ride[0]);
            if (left > 0) {
                detours.cheapest(ride[0], origin, (int) ride[1], left).ifPresent(p -> pickups.put(ride[0], p));
            }
        }
        if (pickups.isEmpty()) {
            return List.of();
        }
        params.addValue("pickups", pickups.entrySet().stream()
                .map(e -> new Object[] {e.getKey(), e.getValue().fromSeq()}).toList());
        return boardingAt.apply("(o.ride_id, o.seq) IN (:pickups)").stream()
                .filter(c -> pickups.containsKey(c.rideId()))
                .map(c -> c.withPickup(pickups.get(c.rideId())))
                .toList();
    }

    /** The order {@code sort.orderBy} gives in SQL, for results put together from two queries. */
    private static Comparator<Candidate> order(Sort sort) {
        Comparator<Candidate> byTime = Comparator.comparing(Candidate::boardingTime)
                .thenComparingLong(Candidate::rideId);
        return switch (sort) {
            case PRICE -> Comparator.comparing(Candidate::pricePerSeat).thenComparing(byTime);
            case RATING -> Comparator.comparing(Candidate::driverRating,
                    Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byTime);
            case PROXIMITY -> Comparator.comparingLong(Candidate::pickupDistanceM).thenComparing(byTime);
            case TIME, BEST_MATCH -> byTime;
        };
    }

    /**
     * Walking times on footpaths where the walking service gives them (feature 91): to the
     * boarding stop, unless the driver picks the passenger up, and from the alighting stop.
     * A result keeps its straight-line estimates unless both walks were routed.
     */
    private List<Candidate> walked(List<Candidate> candidates, Point origin, Point destination,
            Map<Long, Point[]> stopsAt) {
        return candidates.stream().map(c -> {
            Point[] stops = stopsAt.get(c.rideId());
            if (stops == null) {
                return c;
            }
            java.util.OptionalDouble pickup = c.detourMinutes() != null
                    ? java.util.OptionalDouble.of(0) : walking.seconds(origin, stops[0]);
            java.util.OptionalDouble dropoff = walking.seconds(stops[1], destination);
            if (pickup.isEmpty() || dropoff.isEmpty()) {
                return c;
            }
            return c.withWalks((int) Math.ceil(pickup.getAsDouble() / 60), (int) Math.ceil(dropoff.getAsDouble() / 60));
        }).toList();
    }

    /**
     * An auto-rickshaw to the boarding stop and from the alighting stop where the walk is long
     * (feature 91), with the meter fare of the stop's town where a published one is known.
     * None to the boarding stop when the driver picks the passenger up.
     */
    private List<Candidate> rickshawed(List<Candidate> candidates, Point origin, Point destination,
            Map<Long, Point[]> stopsAt) {
        return candidates.stream().map(c -> {
            Point[] stops = stopsAt.get(c.rideId());
            if (stops == null) {
                return c;
            }
            LocalDate day = c.boardingTime().atZone(INDIA_ZONE).toLocalDate();
            Rickshaws.Estimate pickup = c.detourMinutes() != null ? null
                    : rickshaws.between(origin, stops[0], stops[0], c.pickupDistanceM(), day).orElse(null);
            Rickshaws.Estimate dropoff = rickshaws.between(stops[1], destination, stops[1], c.dropoffDistanceM(), day)
                    .orElse(null);
            return c.withRickshaws(pickup, dropoff);
        }).toList();
    }

    /** Each result scored for both people, against the cheapest result offered. */
    private List<Candidate> matched(List<Candidate> candidates, MatchScore.Preferences passenger,
            Map<Long, MatchScore.Preferences> driverSays) {
        BigDecimal cheapest = candidates.stream().map(Candidate::pricePerSeat)
                .min(Comparator.naturalOrder()).orElse(BigDecimal.ZERO);
        return candidates.stream()
                .map(c -> c.withMatch(MatchScore.of(passenger,
                        driverSays.getOrDefault(c.rideId(), MatchScore.Preferences.NONE),
                        c.pickupDistanceM() + c.dropoffDistanceM(), maxAccessMetres, c.pricePerSeat(), cheapest,
                        c.driverRidesCompleted(), c.driverRidesWithdrawn(), matchWeights)))
                .toList();
    }

    /** What the passenger said on their profile; nothing if they have no profile yet. */
    private MatchScore.Preferences preferencesOf(long passengerId) {
        return jdbc.query("SELECT smoking, pets, music, chattiness FROM profiles WHERE user_id = ?",
                (rs, n) -> new MatchScore.Preferences(rs.getObject("smoking", Boolean.class),
                        rs.getObject("pets", Boolean.class), rs.getObject("music", Boolean.class),
                        rs.getString("chattiness")),
                passengerId).stream().findFirst().orElse(MatchScore.Preferences.NONE);
    }

    /**
     * The candidate with the seats other passengers are holding taken off what it offers.
     * Most rides have no holds and are returned as they are.
     */
    private Candidate lessHeld(Candidate candidate, long passengerId) {
        Map<Integer, Integer> held = holds.heldByOthers(candidate.rideId(), passengerId);
        if (held.isEmpty()) {
            return candidate;
        }
        // A hold on one leg does not reduce another, so the count is taken leg by leg.
        List<Integer> free = jdbc.query("""
                SELECT seq, seats_available FROM ride_segments
                WHERE ride_id = ? AND seq >= ? AND seq < ?""",
                (rs, n) -> rs.getInt("seats_available") - held.getOrDefault(rs.getInt("seq"), 0),
                candidate.rideId(), candidate.fromSeq(), candidate.toSeq());
        return candidate.withSeatsAvailable(Math.max(0, Collections.min(free)));
    }

    private static List<Point> points(List<StopInput> stops) {
        return stops.stream().map(stop -> new Point(stop.lat(), stop.lon())).toList();
    }

    /** The path as PostGIS text. PostGIS, like OSRM, wants longitude first. */
    private static String lineString(List<double[]> path) {
        return path.stream()
                .map(p -> String.format(Locale.ROOT, "%.6f %.6f", p[1], p[0]))
                .collect(Collectors.joining(", ", "SRID=4326;LINESTRING(", ")"));
    }

    /** Reads a GeoJSON LineString back into [lat, lon] pairs. Empty if there is no route. */
    private List<double[]> path(String geoJson) {
        List<double[]> path = new ArrayList<>();
        if (geoJson == null) {
            return path;
        }
        try {
            for (JsonNode coordinate : mapper.readTree(geoJson).path("coordinates")) {
                path.add(new double[] {coordinate.get(1).asDouble(), coordinate.get(0).asDouble()});
            }
        } catch (JsonProcessingException e) {
            path.clear();
        }
        return path;
    }

    private static double km(double metres) {
        return Math.round(metres / 100.0) / 10.0;
    }

    private static int minutes(double seconds) {
        return (int) Math.round(seconds / 60.0);
    }

    private static double coarse(double degrees) {
        return Math.round(degrees * 1000.0) / 1000.0;
    }

    private static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private static ResponseStatusException badRequest(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
