package com.dypcet.vayora.booking;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every public action that changes seats, bookings or money must run in one transaction,
 * or a failure halfway leaves a ride half-withdrawn. An edit once separated cancel() from
 * its annotation and every other test still passed; this catches that.
 */
class TransactionBoundaryTest {

    @Test
    void everyPublicActionOnTripsIsTransactional() {
        assertTransactional(TripService.class, Set.of("start", "noShow", "complete", "cancel", "cancelSeries"));
    }

    @Test
    void everyPublicActionOnBookingsIsTransactional() {
        assertTransactional(BookingService.class,
                Set.of("request", "accept", "reject", "cancel", "expire", "paymentReceived", "clearDue"));
    }

    private static void assertTransactional(Class<?> type, Set<String> actions) {
        List<String> missing = Arrays.stream(type.getDeclaredMethods())
                .filter(m -> Modifier.isPublic(m.getModifiers()) && actions.contains(m.getName()))
                .filter(m -> !m.isAnnotationPresent(Transactional.class))
                .map(Method::getName)
                .toList();
        assertThat(missing).as("public actions without @Transactional on " + type.getSimpleName()).isEmpty();
        assertThat(Arrays.stream(type.getDeclaredMethods()).map(Method::getName).toList()).containsAll(actions);
    }
}
