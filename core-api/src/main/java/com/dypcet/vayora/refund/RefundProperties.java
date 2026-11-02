package com.dypcet.vayora.refund;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The fixed policy for a passenger cancelling an accepted booking.
 *
 * @param tiers most generous first; a cancellation later than the last tier owes the whole fare
 */
@ConfigurationProperties("vayora.refund")
public record RefundProperties(List<Tier> tiers) {

    /**
     * @param atLeastBefore cancelling this long before boarding, or earlier, earns this tier
     * @param fareShare     fraction of the fare the passenger is let off, 0 to 1
     */
    public record Tier(Duration atLeastBefore, BigDecimal fareShare) {
    }

    public RefundProperties {
        if (tiers == null || tiers.isEmpty()) {
            throw new IllegalArgumentException("vayora.refund.tiers must not be empty");
        }
        for (int i = 0; i < tiers.size(); i++) {
            Tier tier = tiers.get(i);
            if (tier.atLeastBefore() == null || tier.atLeastBefore().isNegative()
                    || tier.fareShare() == null || tier.fareShare().signum() < 0
                    || tier.fareShare().compareTo(BigDecimal.ONE) > 0) {
                throw new IllegalArgumentException("vayora.refund.tiers[" + i + "] is invalid");
            }
            if (i > 0 && (tier.atLeastBefore().compareTo(tiers.get(i - 1).atLeastBefore()) >= 0
                    || tier.fareShare().compareTo(tiers.get(i - 1).fareShare()) > 0)) {
                throw new IllegalArgumentException(
                        "vayora.refund.tiers must run from earliest and most generous to latest");
            }
        }
        tiers = List.copyOf(tiers);
    }
}
