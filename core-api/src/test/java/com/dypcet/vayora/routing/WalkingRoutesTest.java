package com.dypcet.vayora.routing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.dypcet.vayora.routing.RouteService.Point;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/** Feature 91: walking times from the footpath routing service, with an honest fallback. */
class WalkingRoutesTest {

    private static final Point START = new Point(17.2890, 74.1818);
    private static final Point STOP = new Point(17.2851, 74.1880);
    private static final String URL = "http://osrm-foot/route/v1/foot/74.18180,17.28900;74.18800,17.28510?overview=false";

    private static final class MapCache implements RouteCache {
        final Map<String, String> entries = new HashMap<>();

        @Override
        public Optional<String> get(String key) {
            return Optional.ofNullable(entries.get(key));
        }

        @Override
        public void put(String key, String value) {
            entries.put(key, value);
        }
    }

    private MockRestServiceServer osrm;
    private MapCache cache;
    private WalkingRoutes walking;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://osrm-foot");
        osrm = MockRestServiceServer.bindTo(builder).build();
        cache = new MapCache();
        walking = new WalkingRoutes(builder.build(), cache, 2000);
    }

    @Test
    void asksTheWalkingServiceLongitudeFirstAndRemembersTheAnswerApartFromDriving() {
        osrm.expect(requestTo(URL)).andRespond(withSuccess(
                "{\"code\": \"Ok\", \"routes\": [{\"duration\": 612.4, \"distance\": 850.0}]}",
                MediaType.APPLICATION_JSON));

        assertThat(walking.seconds(START, STOP)).isEqualTo(OptionalDouble.of(612.4));
        // The second time comes from the cache: the server expects one request only.
        assertThat(walking.seconds(START, STOP)).isEqualTo(OptionalDouble.of(612.4));
        osrm.verify();
        assertThat(cache.entries).containsOnlyKeys("foot:74.18180,17.28900;74.18800,17.28510");
    }

    @Test
    void anOutageOrANoRouteAnswerGivesNothingRatherThanAGuess() {
        osrm.expect(requestTo(URL)).andRespond(withServerError());
        assertThat(walking.seconds(START, STOP)).isEmpty();

        osrm.reset();
        osrm.expect(requestTo(URL)).andRespond(withSuccess("{\"code\": \"NoRoute\"}", MediaType.APPLICATION_JSON));
        assertThat(walking.seconds(START, STOP)).isEmpty();
        assertThat(cache.entries).isEmpty();
    }

    @Test
    void aPointMovedFarToReachAFootpathGivesNothingRatherThanAWalkElsewhere() {
        osrm.expect(requestTo(URL)).andRespond(withSuccess(
                "{\"code\": \"Ok\", \"waypoints\": [{\"distance\": 705000.0}, {\"distance\": 508000.0}],"
                        + " \"routes\": [{\"duration\": 612.4, \"distance\": 850.0}]}",
                MediaType.APPLICATION_JSON));

        assertThat(walking.seconds(START, STOP)).isEmpty();
        assertThat(cache.entries).isEmpty();
    }

    @Test
    void withNoWalkingServiceConfiguredThereIsNothingToAsk() {
        assertThat(new WalkingRoutes(null, cache, 2000).seconds(START, STOP)).isEmpty();
    }
}
