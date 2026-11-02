package com.dypcet.vayora.payment;

import com.dypcet.vayora.identity.CurrentUser;
import com.dypcet.vayora.payment.PaymentService.Earning;
import com.dypcet.vayora.payment.PaymentService.Payment;
import com.dypcet.vayora.refund.RefundProperties;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** A person's own money history: what a passenger owed and paid, what a driver is owed and got. */
@RestController
@RequestMapping("/api/v1")
public class PaymentController {

    /**
     * @param atLeastHoursBefore cancelling this long before boarding, or earlier, earns the tier
     * @param owedShare          fraction of the fare then owed to the driver, 0 to 1
     */
    public record CancellationTier(long atLeastHoursBefore, BigDecimal owedShare) {
    }

    /** What cancelling costs a passenger, for the UI to state. */
    public record Terms(List<CancellationTier> cancellationTiers) {
    }

    private final PaymentService payments;
    private final Terms terms;

    public PaymentController(PaymentService payments, RefundProperties refunds) {
        this.payments = payments;
        this.terms = new Terms(refunds.tiers().stream()
                .map(tier -> new CancellationTier(tier.atLeastBefore().toHours(), BigDecimal.ONE.subtract(tier.fareShare())))
                .toList());
    }

    @GetMapping("/payment-terms")
    public Terms terms() {
        return terms;
    }

    @GetMapping("/payments")
    @PreAuthorize("hasRole('PASSENGER')")
    public List<Payment> payments(@AuthenticationPrincipal Jwt jwt) {
        return payments.forPassenger(CurrentUser.id(jwt));
    }

    @GetMapping("/earnings")
    @PreAuthorize("hasRole('DRIVER')")
    public List<Earning> earnings(@AuthenticationPrincipal Jwt jwt) {
        return payments.forDriver(CurrentUser.id(jwt));
    }
}
