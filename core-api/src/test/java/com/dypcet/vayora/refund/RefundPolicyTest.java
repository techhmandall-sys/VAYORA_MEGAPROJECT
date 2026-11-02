package com.dypcet.vayora.refund;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dypcet.vayora.refund.RefundProperties.Tier;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

class RefundPolicyTest {

    private static final Tier FULL_AT_48H = new Tier(Duration.ofHours(48), new BigDecimal("1.0"));
    private static final Tier HALF_AT_24H = new Tier(Duration.ofHours(24), new BigDecimal("0.5"));

    private final RefundPolicy policy =
            new RefundPolicy(new RefundProperties(List.of(FULL_AT_48H, HALF_AT_24H)));
    private final BigDecimal fare = new BigDecimal("520.00");

    @Test
    void anEarlyCancellationOwesNothing() {
        assertThat(policy.owedOnCancelling(fare, Duration.ofDays(5))).isEqualByComparingTo("0.00");
    }

    @Test
    void theTierBoundaryItselfEarnsTheTier() {
        assertThat(policy.owedOnCancelling(fare, Duration.ofHours(48))).isEqualByComparingTo("0.00");
        assertThat(policy.owedOnCancelling(fare, Duration.ofHours(48).minusSeconds(1)))
                .isEqualByComparingTo("260.00");
        assertThat(policy.owedOnCancelling(fare, Duration.ofHours(24))).isEqualByComparingTo("260.00");
    }

    @Test
    void aLateCancellationOwesTheWholeFare() {
        assertThat(policy.owedOnCancelling(fare, Duration.ofHours(24).minusSeconds(1)))
                .isEqualByComparingTo("520.00");
        assertThat(policy.owedOnCancelling(fare, Duration.ZERO)).isEqualByComparingTo("520.00");
    }

    @Test
    void whatIsOwedIsRoundedToTheNearestPaisa() {
        assertThat(policy.owedOnCancelling(new BigDecimal("333.33"), Duration.ofHours(30)))
                .isEqualByComparingTo("166.66"); // let off 166.665, rounded half up
        assertThat(policy.owedOnCancelling(new BigDecimal("333.33"), Duration.ofHours(30)).scale())
                .isEqualTo(2);
    }

    @Test
    void tiersThatGetMoreGenerousLaterOrAreOutOfOrderAreRefused() {
        Tier generousLate = new Tier(Duration.ofHours(24), new BigDecimal("1.0"));
        Tier stingyEarly = new Tier(Duration.ofHours(48), new BigDecimal("0.5"));

        assertThatThrownBy(() -> new RefundProperties(List.of(stingyEarly, generousLate)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new RefundProperties(List.of(HALF_AT_24H, FULL_AT_48H)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new RefundProperties(List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new RefundProperties(
                List.of(new Tier(Duration.ofHours(48), new BigDecimal("1.5")))))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
