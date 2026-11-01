package com.dypcet.vayora.routing;

import com.dypcet.vayora.routing.RouteService.Point;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalDouble;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Walking times on real footpaths (feature 91), from a second routing service built from the
 * same map for walking. Empty when none is configured or it cannot be reached: the caller then
 * falls back to a straight line, and says which it used.
 */
@Component
public class WalkingRoutes {

    private static final Logger log = LoggerFactory.getLogger(WalkingRoutes.class);

    private final RestClient client;
    private final RouteCache cache;
    private final double maxSnapMetres;

    @Autowired
    public WalkingRoutes(RestClient.Builder builder, RouteCache cache,
            @Value("${vayora.osrm.foot-url}") String baseUrl,
            @Value("${vayora.osrm.timeout}") Duration timeout,
            @Value("${vayora.osrm.max-snap-metres}") double maxSnapMetres) {
        this(baseUrl.isBlank() ? null : builder.baseUrl(baseUrl).requestFactory(timeouts(timeout)).build(), cache,
                maxSnapMetres);
    }

    /** @param client null when no walking service is configured */
    WalkingRoutes(RestClient client, RouteCache cache, double maxSnapMetres) {
        this.client = client;
        this.cache = cache;
        this.maxSnapMetres = maxSnapMetres;
    }

    private static SimpleClientHttpRequestFactory timeouts(Duration timeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) timeout.toMillis());
        factory.setReadTimeout((int) timeout.toMillis());
        return factory;
    }

    /** Seconds on foot from one point to the other, or empty if no footpath route could be had. */
    public OptionalDouble seconds(Point from, Point to) {
        if (client == null) {
            return OptionalDouble.empty();
        }
        // Longitude first, as for driving; the key is kept apart from driving routes.
        String coordinates = String.format(Locale.ROOT, "%.5f,%.5f;%.5f,%.5f",
                from.lon(), from.lat(), to.lon(), to.lat());
        Optional<String> cached = cache.get("foot:" + coordinates);
        if (cached.isPresent()) {
            return OptionalDouble.of(Double.parseDouble(cached.get()));
        }
        try {
            JsonNode body = client.get().uri("/route/v1/foot/" + coordinates + "?overview=false")
                    .retrieve().body(JsonNode.class);
            double seconds = body == null || !"Ok".equals(body.path("code").asText())
                            || !RouteService.onTheMap(body, maxSnapMetres)
                    ? -1 : body.path("routes").path(0).path("duration").asDouble(-1);
            if (seconds < 0) {
                return OptionalDouble.empty();
            }
            cache.put("foot:" + coordinates, Double.toString(seconds));
            return OptionalDouble.of(seconds);
        } catch (RestClientException e) {
            log.warn("No walking route, a straight line will be used: {}", e.getMessage());
            return OptionalDouble.empty();
        }
    }
}
