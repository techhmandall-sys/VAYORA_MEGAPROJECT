package com.dypcet.vayora.routing;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * The road route through a list of points, from OSRM.
 *
 * <p>When OSRM is not configured, does not answer, or finds no route, the points are
 * joined by straight lines instead and the result says so in {@code source}. A caller
 * can always get a route; it must not present a straight-line one as a road distance.
 */
@Service
public class RouteService {

    public static final String OSRM = "OSRM";
    public static final String STRAIGHT_LINE = "STRAIGHT_LINE";

    private static final Logger log = LoggerFactory.getLogger(RouteService.class);
    private static final double EARTH_RADIUS_METRES = 6_371_008.8;

    public record Point(double lat, double lon) {
    }

    public record Leg(double distanceMetres, double durationSeconds) {
    }

    /**
     * @param legs one per pair of consecutive points
     * @param path the line to draw, as [lat, lon] pairs
     */
    public record Route(double distanceMetres, double durationSeconds, List<Leg> legs,
            List<double[]> path, String source) {
    }

    private final RestClient client;
    private final RouteCache cache;
    private final ObjectMapper mapper;
    private final double fallbackSpeedKmh;
    private final double maxSnapMetres;

    @Autowired
    public RouteService(RestClient.Builder builder, RouteCache cache, ObjectMapper mapper,
            @Value("${vayora.osrm.url}") String baseUrl,
            @Value("${vayora.osrm.timeout}") Duration timeout,
            @Value("${vayora.osrm.fallback-speed-kmh}") double fallbackSpeedKmh,
            @Value("${vayora.osrm.max-snap-metres}") double maxSnapMetres) {
        this(baseUrl.isBlank() ? null : builder.baseUrl(baseUrl).requestFactory(timeouts(timeout)).build(),
                cache, mapper, fallbackSpeedKmh, maxSnapMetres);
    }

    /** @param client null when no routing service is configured */
    RouteService(RestClient client, RouteCache cache, ObjectMapper mapper, double fallbackSpeedKmh,
            double maxSnapMetres) {
        this.client = client;
        this.cache = cache;
        this.mapper = mapper;
        this.fallbackSpeedKmh = fallbackSpeedKmh;
        this.maxSnapMetres = maxSnapMetres;
    }

    private static SimpleClientHttpRequestFactory timeouts(Duration timeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) timeout.toMillis());
        factory.setReadTimeout((int) timeout.toMillis());
        return factory;
    }

    public Route through(List<Point> points) {
        if (points.size() < 2) {
            throw new IllegalArgumentException("A route needs at least two points");
        }
        if (client == null) {
            return straightLine(points);
        }
        // OSRM wants longitude first. Five decimals is about a metre.
        String coordinates = points.stream()
                .map(p -> String.format(Locale.ROOT, "%.5f,%.5f", p.lon(), p.lat()))
                .collect(Collectors.joining(";"));
        Optional<Route> cached = cache.get(coordinates).flatMap(this::read);
        if (cached.isPresent()) {
            return cached.get();
        }
        try {
            // Built by concatenation, not as a URI variable: a variable would percent-encode
            // the commas and semicolons. The string holds only digits and separators.
            JsonNode body = client.get()
                    .uri("/route/v1/driving/" + coordinates
                            + "?overview=simplified&geometries=geojson")
                    .retrieve().body(JsonNode.class);
            Route route = parse(body, points.size());
            cache.put(coordinates, mapper.writeValueAsString(route));
            return route;
        } catch (RestClientException | IllegalStateException | JsonProcessingException e) {
            log.warn("No road route from OSRM, joining the stops by straight lines: {}",
                    e.getMessage());
            return straightLine(points);
        }
    }

    private Route parse(JsonNode body, int points) {
        if (body == null || !"Ok".equals(body.path("code").asText())
                || !body.path("routes").has(0)) {
            throw new IllegalStateException("OSRM found no route");
        }
        if (!onTheMap(body, maxSnapMetres)) {
            throw new IllegalStateException("A point is off OSRM's map");
        }
        JsonNode route = body.path("routes").get(0);
        List<Leg> legs = new ArrayList<>();
        for (JsonNode leg : route.path("legs")) {
            legs.add(new Leg(leg.path("distance").asDouble(), leg.path("duration").asDouble()));
        }
        List<double[]> path = new ArrayList<>();
        for (JsonNode coordinate : route.path("geometry").path("coordinates")) {
            path.add(new double[] {coordinate.get(1).asDouble(), coordinate.get(0).asDouble()});
        }
        if (legs.size() != points - 1 || path.size() < 2) {
            throw new IllegalStateException("OSRM answered with an incomplete route");
        }
        return new Route(route.path("distance").asDouble(), route.path("duration").asDouble(),
                legs, path, OSRM);
    }

    /**
     * Whether OSRM stayed near every point it was given. It moves each one to the nearest road on
     * its map and answers Ok however far that is, so a route between two places off the map comes
     * back as a short road somewhere else entirely.
     */
    static boolean onTheMap(JsonNode body, double maxSnapMetres) {
        for (JsonNode waypoint : body.path("waypoints")) {
            if (waypoint.path("distance").asDouble() > maxSnapMetres) {
                return false;
            }
        }
        return true;
    }

    private Optional<Route> read(String json) {
        try {
            return Optional.of(mapper.readValue(json, Route.class));
        } catch (JsonProcessingException e) {
            return Optional.empty();
        }
    }

    private Route straightLine(List<Point> points) {
        List<Leg> legs = new ArrayList<>();
        List<double[]> path = new ArrayList<>();
        double total = 0;
        for (int i = 0; i < points.size(); i++) {
            path.add(new double[] {points.get(i).lat(), points.get(i).lon()});
            if (i > 0) {
                double metres = greatCircleMetres(points.get(i - 1), points.get(i));
                legs.add(new Leg(metres, seconds(metres)));
                total += metres;
            }
        }
        return new Route(total, seconds(total), legs, path, STRAIGHT_LINE);
    }

    private double seconds(double metres) {
        return metres / 1000.0 / fallbackSpeedKmh * 3600.0;
    }

    static double greatCircleMetres(Point a, Point b) {
        double lat1 = Math.toRadians(a.lat());
        double lat2 = Math.toRadians(b.lat());
        double dLat = lat2 - lat1;
        double dLon = Math.toRadians(b.lon() - a.lon());
        double h = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dLon / 2), 2);
        return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(h));
    }
}
