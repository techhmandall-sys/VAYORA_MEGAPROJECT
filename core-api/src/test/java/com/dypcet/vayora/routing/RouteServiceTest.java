package com.dypcet.vayora.routing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.dypcet.vayora.routing.RouteService.Point;
import com.dypcet.vayora.routing.RouteService.Route;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class RouteServiceTest {

    private static final Point KOLHAPUR = new Point(16.7050, 74.2433);
    private static final Point SATARA = new Point(17.6805, 74.0183);
    private static final Point PUNE = new Point(18.5204, 73.8567);
    private static final String URL = "http://osrm/route/v1/driving/"
            + "74.24330,16.70500;74.01830,17.68050;73.85670,18.52040"
            + "?overview=simplified&geometries=geojson";
    private static final String ANSWER = """
            {"code": "Ok", "routes": [{
              "distance": 230017.5, "duration": 11467.5,
              "legs": [{"distance": 121000.0, "duration": 6000.0},
                       {"distance": 109017.5, "duration": 5467.5}],
              "geometry": {"type": "LineString",
                           "coordinates": [[74.2433, 16.705], [74.0183, 17.6805], [73.8567, 18.5204]]}}]}""";

    /** A cache that is just a map, so the test can see what was stored. */
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

    private final ObjectMapper mapper = new ObjectMapper();
    private MockRestServiceServer osrm;
    private MapCache cache;
    private RouteService routes;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://osrm");
        osrm = MockRestServiceServer.bindTo(builder).build();
        cache = new MapCache();
        routes = new RouteService(builder.build(), cache, mapper, 50.0, 2000);
    }

    @Test
    void asksOsrmWithLongitudeFirstAndReadsDistanceLegsAndPath() {
        osrm.expect(requestTo(URL)).andRespond(withSuccess(ANSWER, MediaType.APPLICATION_JSON));

        Route route = routes.through(List.of(KOLHAPUR, SATARA, PUNE));

        assertThat(route.source()).isEqualTo("OSRM");
        assertThat(route.distanceMetres()).isEqualTo(230017.5);
        assertThat(route.durationSeconds()).isEqualTo(11467.5);
        assertThat(route.legs()).extracting(RouteService.Leg::distanceMetres)
                .containsExactly(121000.0, 109017.5);
        // Stored as [lat, lon], the other way round from OSRM.
        assertThat(route.path().get(0)).containsExactly(16.705, 74.2433);
        assertThat(route.path()).hasSize(3);
        osrm.verify();
    }

    @Test
    void theSameRouteIsAskedForOnlyOnce() {
        osrm.expect(ExpectedCount.once(), requestTo(URL))
                .andRespond(withSuccess(ANSWER, MediaType.APPLICATION_JSON));

        Route first = routes.through(List.of(KOLHAPUR, SATARA, PUNE));
        Route again = routes.through(List.of(KOLHAPUR, SATARA, PUNE));

        assertThat(again.distanceMetres()).isEqualTo(first.distanceMetres());
        assertThat(again.source()).isEqualTo("OSRM");
        assertThat(again.path().get(2)).containsExactly(18.5204, 73.8567);
        assertThat(cache.entries).hasSize(1);
        osrm.verify();
    }

    @Test
    void anOutageGivesStraightLinesLabelledAsSuchAndIsNotCached() {
        osrm.expect(requestTo(URL)).andRespond(withServerError());

        Route route = routes.through(List.of(KOLHAPUR, SATARA, PUNE));

        assertThat(route.source()).isEqualTo("STRAIGHT_LINE");
        // About 204 km as the crow flies, against 230 km by road.
        assertThat(route.distanceMetres()).isBetween(200_000.0, 208_000.0);
        assertThat(route.legs()).hasSize(2);
        assertThat(route.path()).hasSize(3);
        assertThat(route.durationSeconds()).isCloseTo(route.distanceMetres() / 1000 / 50 * 3600,
                org.assertj.core.api.Assertions.within(1e-6));
        assertThat(cache.entries).isEmpty();
    }

    @Test
    void aPointMovedFarToReachARoadGivesALabelledStraightLineNotAShortRoadElsewhere() {
        // As OSRM really answered on the corridor's map for Chennai to Bengaluru: both points moved
        // hundreds of km to the map's edge, "Ok", and 69.7 km by road where the truth is over 280.
        String offTheMap = "{\"code\": \"Ok\", \"waypoints\": [{\"distance\": 705000.0}, {\"distance\": 10.0},"
                + " {\"distance\": 508000.0}], " + ANSWER.substring(ANSWER.indexOf("\"routes\""));
        osrm.expect(requestTo(URL)).andRespond(withSuccess(offTheMap, MediaType.APPLICATION_JSON));

        Route route = routes.through(List.of(KOLHAPUR, SATARA, PUNE));

        assertThat(route.source()).isEqualTo("STRAIGHT_LINE");
        assertThat(cache.entries).isEmpty();
    }

    @Test
    void aPointMovedOnlyMetresToReachARoadIsStillARoute() {
        String onTheMap = "{\"code\": \"Ok\", \"waypoints\": [{\"distance\": 4.0}, {\"distance\": 900.0},"
                + " {\"distance\": 23.0}], " + ANSWER.substring(ANSWER.indexOf("\"routes\""));
        osrm.expect(requestTo(URL)).andRespond(withSuccess(onTheMap, MediaType.APPLICATION_JSON));

        assertThat(routes.through(List.of(KOLHAPUR, SATARA, PUNE)).source()).isEqualTo("OSRM");
    }

    @Test
    void anAnswerWithNoRouteIsTreatedAsAnOutage() {
        osrm.expect(requestTo(URL)).andRespond(
                withSuccess("{\"code\": \"NoRoute\", \"routes\": []}", MediaType.APPLICATION_JSON));

        assertThat(routes.through(List.of(KOLHAPUR, SATARA, PUNE)).source()).isEqualTo("STRAIGHT_LINE");
    }

    @Test
    void withNoRoutingServiceConfiguredNothingIsCalled() {
        RouteService unconfigured = new RouteService(null, cache, mapper, 50.0, 2000);

        Route route = unconfigured.through(List.of(KOLHAPUR, PUNE));

        assertThat(route.source()).isEqualTo("STRAIGHT_LINE");
        assertThat(route.legs()).hasSize(1);
    }

    @Test
    void greatCircleDistanceIsRightForAKnownPair() {
        // One degree of latitude is about 111.2 km anywhere.
        assertThat(RouteService.greatCircleMetres(new Point(17.0, 74.0), new Point(18.0, 74.0)))
                .isBetween(111_100.0, 111_300.0);
        assertThat(RouteService.greatCircleMetres(KOLHAPUR, KOLHAPUR)).isZero();
    }

    @Test
    void aRouteNeedsTwoPoints() {
        assertThatThrownBy(() -> routes.through(List.of(KOLHAPUR)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
