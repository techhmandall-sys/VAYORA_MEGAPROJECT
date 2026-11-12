package com.dypcet.vayora.routing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dypcet.vayora.routing.RickshawProperties.Fare;
import com.dypcet.vayora.routing.Rickshaws.Estimate;
import com.dypcet.vayora.routing.RouteService.Point;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Feature 91: an auto-rickshaw to or from a stop, by road, with the meter fare only where a
 * published one is known. No routing service here, so roads are straight lines at 50 km/h.
 */
class RickshawsTest {

    private static final Point PUNE_STOP = new Point(18.5204, 73.8567);
    // About 3 km north of it in a straight line.
    private static final Point SHIVAJINAGAR = new Point(18.5474, 73.8567);
    private static final Point KOLHAPUR_STOP = new Point(16.7050, 74.2433);
    private static final Point NEAR_KOLHAPUR = new Point(16.7230, 74.2433);
    private static final LocalDate AFTER = LocalDate.of(2026, 10, 20);

    private static final Fare PUNE = new Fare("Pune", 18.5204, 73.8567, 25, new BigDecimal("30"), 1.5,
            new BigDecimal("20"), LocalDate.of(2026, 9, 1), "Pune RTA, as reported");
    // The Mumbai region's fare from 1 September 2026, the same in every town of the region.
    private static final Fare MUMBAI = new Fare("Mumbai", 19.0760, 72.8777, 25, new BigDecimal("27"), 1.5,
            new BigDecimal("18.22"), LocalDate.of(2026, 9, 1), "MMRTA, as reported");
    private static final Fare THANE = new Fare("Thane", 19.2183, 72.9781, 15, new BigDecimal("27"), 1.5,
            new BigDecimal("18.22"), LocalDate.of(2026, 9, 1), "MMRTA, as reported");

    private static Rickshaws rickshaws(double offerBeyondMetres, Fare... fares) {
        Map<String, String> stored = new HashMap<>();
        RouteCache cache = new RouteCache() {
            @Override
            public Optional<String> get(String key) {
                return Optional.ofNullable(stored.get(key));
            }

            @Override
            public void put(String key, String value) {
                stored.put(key, value);
            }
        };
        return new Rickshaws(new RouteService(null, cache, new ObjectMapper(), 50.0, 2000),
                new RickshawProperties(offerBeyondMetres, List.of(fares)));
    }

    @Test
    void theMeterChargesTheMinimumUpToItsDistanceThenTheRateToTheRupee() {
        assertThat(Rickshaws.meter(PUNE, 0.8)).isEqualTo(30);
        assertThat(Rickshaws.meter(PUNE, 1.5)).isEqualTo(30);
        assertThat(Rickshaws.meter(PUNE, 4.0)).isEqualTo(80);    // 30 + 20 x 2.5
        assertThat(Rickshaws.meter(PUNE, 2.26)).isEqualTo(45);   // 45.2
        assertThat(Rickshaws.meter(PUNE, 2.275)).isEqualTo(46);  // 45.5, half up
    }

    @Test
    void aRateInPaiseIsChargedToTheRupee() {
        assertThat(Rickshaws.meter(MUMBAI, 1.0)).isEqualTo(27);
        assertThat(Rickshaws.meter(MUMBAI, 1.5)).isEqualTo(27);
        assertThat(Rickshaws.meter(MUMBAI, 2.3)).isEqualTo(42);  // 27 + 18.22 x 0.8 = 41.576
        assertThat(Rickshaws.meter(MUMBAI, 4.5)).isEqualTo(82);  // 27 + 18.22 x 3 = 81.66
    }

    @Test
    void whereTwoTownsCirclesOverlapTheNearestTownNamesTheFare() {
        RickshawProperties region = new RickshawProperties(1000, List.of(MUMBAI, THANE));

        // Both points are within Mumbai's 25 km; only the first is within Thane's 15.
        assertThat(region.at(new Point(19.2000, 72.9700))).map(Fare::town).contains("Thane");
        assertThat(region.at(new Point(19.0500, 72.8500))).map(Fare::town).contains("Mumbai");
        assertThat(region.at(NEAR_KOLHAPUR)).isEmpty();
    }

    @Test
    void aLongWalkInATownWithAPublishedFareGetsTheTimeAndTheFareAndSaysWhose() {
        Estimate estimate = rickshaws(1000, PUNE)
                .between(PUNE_STOP, SHIVAJINAGAR, PUNE_STOP, 3002, AFTER).orElseThrow();

        assertThat(estimate.km()).isEqualTo(3.0);
        assertThat(estimate.minutes()).isEqualTo(4);       // 3.0 km at 50 km/h, rounded up
        assertThat(estimate.fare()).isEqualTo(60);         // 30 + 20 x 1.5
        assertThat(estimate.fareTown()).isEqualTo("Pune");
        assertThat(estimate.fareSource()).isEqualTo("Pune RTA, as reported");
        assertThat(estimate.byRoad()).isFalse();           // straight lines, and it says so
    }

    @Test
    void aTownWithNoPublishedFareGetsATimeButNoFare() {
        Estimate estimate = rickshaws(1000, PUNE)
                .between(NEAR_KOLHAPUR, KOLHAPUR_STOP, KOLHAPUR_STOP, 2002, AFTER).orElseThrow();

        assertThat(estimate.minutes()).isEqualTo(3);
        assertThat(estimate.fare()).isNull();
        assertThat(estimate.fareTown()).isNull();
    }

    @Test
    void aFareNotYetInForceOnTheTripsDayIsNotCharged() {
        Estimate estimate = rickshaws(1000, PUNE)
                .between(PUNE_STOP, SHIVAJINAGAR, PUNE_STOP, 3002, LocalDate.of(2026, 8, 31)).orElseThrow();

        assertThat(estimate.fare()).isNull();
    }

    @Test
    void aShortWalkIsOfferedNoRickshaw() {
        assertThat(rickshaws(1000, PUNE).between(PUNE_STOP, SHIVAJINAGAR, PUNE_STOP, 999, AFTER)).isEmpty();
    }

    @Test
    void aFareWithoutASourceOrWithANonsenseRateIsRefused() {
        assertThatThrownBy(() -> new RickshawProperties(1000, List.of(new Fare("Pune", 18.5, 73.8, 25,
                new BigDecimal("30"), 1.5, new BigDecimal("20"), LocalDate.of(2026, 9, 1), " "))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new RickshawProperties(1000, List.of(new Fare("Pune", 18.5, 73.8, 25,
                new BigDecimal("30"), 1.5, BigDecimal.ZERO, LocalDate.of(2026, 9, 1), "RTA"))))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
