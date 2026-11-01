package com.dypcet.vayora.ride;

import com.dypcet.vayora.routing.RouteService;
import com.dypcet.vayora.routing.RouteService.Point;
import com.dypcet.vayora.routing.RouteService.Route;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Detour tolerance (feature 28): what it costs a driver, by road, to pick a passenger up at
 * the passenger's own point instead of a stop, and whether the ride's allowance still covers it.
 *
 * <p>A pickup is on the leg after some stop: the driver leaves that stop, goes to the point,
 * then on to the next stop. Its cost is that route's driving time less the leg's own.
 */
@Service
public class DetourService {

    /**
     * @param fromSeq       the stop the pickup comes after; the passenger rides from there on
     * @param offsetMinutes from that stop to the pickup point, by road
     * @param detourMinutes how much longer the leg takes with the pickup
     */
    public record Pickup(int fromSeq, int offsetMinutes, int detourMinutes) {
    }

    private record StopAt(int seq, Point point) {
    }

    private final JdbcTemplate jdbc;
    private final RouteService routes;

    public DetourService(JdbcTemplate jdbc, RouteService routes) {
        this.jdbc = jdbc;
        this.routes = routes;
    }

    /** Minutes of the ride's allowance not yet spent on live bookings. */
    public int minutesLeft(long rideId) {
        Integer left = jdbc.queryForObject("""
                SELECT r.max_detour_minutes - COALESCE((
                    SELECT SUM(b.detour_minutes) FROM bookings b
                    WHERE b.ride_id = r.id AND b.status IN ('PENDING', 'CONFIRMED')), 0)
                FROM rides r WHERE r.id = ?""", Integer.class, rideId);
        return left == null ? 0 : left;
    }

    /**
     * The cheapest pickup at {@code point} on a leg before stop {@code toSeq}, if it fits in
     * the minutes left. Driving times come from the routing service, or from straight lines
     * off its map or when it cannot be reached, as for every route.
     */
    public Optional<Pickup> cheapest(long rideId, Point point, int toSeq, int minutesLeft) {
        List<StopAt> stops = stopsOf(rideId);
        Pickup best = null;
        for (int k = 0; k + 1 < stops.size() && k + 1 <= toSeq; k++) {
            Pickup pickup = on(stops.get(k), stops.get(k + 1), point);
            if (best == null || pickup.detourMinutes() < best.detourMinutes()) {
                best = pickup;
            }
        }
        return Optional.ofNullable(best).filter(p -> p.detourMinutes() <= minutesLeft);
    }

    /** The pickup at {@code point} on the leg after stop {@code fromSeq}, whatever it costs. */
    public Pickup on(long rideId, Point point, int fromSeq) {
        List<StopAt> stops = stopsOf(rideId);
        if (fromSeq < 0 || fromSeq + 1 >= stops.size()) {
            throw new IllegalArgumentException("No leg after stop " + fromSeq);
        }
        return on(stops.get(fromSeq), stops.get(fromSeq + 1), point);
    }

    private Pickup on(StopAt from, StopAt next, Point point) {
        Route via = routes.through(List.of(from.point(), point, next.point()));
        Route direct = routes.through(List.of(from.point(), next.point()));
        int detour = (int) Math.ceil(Math.max(0, via.durationSeconds() - direct.durationSeconds()) / 60);
        int offset = (int) Math.ceil(via.legs().get(0).durationSeconds() / 60);
        return new Pickup(from.seq(), offset, detour);
    }

    private List<StopAt> stopsOf(long rideId) {
        return jdbc.query("""
                SELECT seq, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
                FROM ride_stops WHERE ride_id = ? ORDER BY seq""",
                (rs, n) -> new StopAt(rs.getInt("seq"), new Point(rs.getDouble("lat"), rs.getDouble("lon"))),
                rideId);
    }
}
