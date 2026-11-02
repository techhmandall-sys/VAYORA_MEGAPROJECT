package com.dypcet.vayora.payment;

import com.dypcet.vayora.identity.CurrentUser;
import com.dypcet.vayora.payment.DriverPaymentDetails.Details;
import com.dypcet.vayora.payment.DriverPaymentDetails.HowToPay;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.unit.DataSize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** A driver's own UPI details, and what a passenger with a booking is shown of them. */
@RestController
@RequestMapping("/api/v1")
public class DriverPaymentController {

    /** @param upiId null or blank removes it */
    public record UpiIdRequest(@Size(max = 321) String upiId) {
    }

    private final DriverPaymentDetails details;
    private final long maxUploadBytes;

    public DriverPaymentController(DriverPaymentDetails details,
            @Value("${vayora.photo.max-upload}") DataSize maxUpload) {
        this.details = details;
        this.maxUploadBytes = maxUpload.toBytes();
    }

    @GetMapping("/me/payment-details")
    @PreAuthorize("hasRole('DRIVER')")
    public Details mine(@AuthenticationPrincipal Jwt jwt) {
        return details.of(CurrentUser.id(jwt));
    }

    @PutMapping("/me/payment-details")
    @PreAuthorize("hasRole('DRIVER')")
    public Details setUpiId(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpiIdRequest request) {
        return details.setUpiId(CurrentUser.id(jwt), request.upiId());
    }

    @GetMapping("/me/payment-details/qr")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<byte[]> myQr(@AuthenticationPrincipal Jwt jwt) {
        return png(details.qr(CurrentUser.id(jwt)));
    }

    /** The picture itself in the request body, as for a photo. */
    @PutMapping("/me/payment-details/qr")
    @PreAuthorize("hasRole('DRIVER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setQr(@AuthenticationPrincipal Jwt jwt, HttpServletRequest request) throws IOException {
        // At most one byte past the limit is read, so an oversized upload is refused without being held whole.
        details.setQr(CurrentUser.id(jwt),
                request.getInputStream().readNBytes((int) Math.min(Integer.MAX_VALUE - 8, maxUploadBytes + 1)));
    }

    @DeleteMapping("/me/payment-details/qr")
    @PreAuthorize("hasRole('DRIVER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeQr(@AuthenticationPrincipal Jwt jwt) {
        details.removeQr(CurrentUser.id(jwt));
    }

    @GetMapping("/bookings/{id}/pay-driver")
    @PreAuthorize("hasRole('PASSENGER')")
    public HowToPay howToPay(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return details.forPassenger(CurrentUser.id(jwt), id);
    }

    @GetMapping("/bookings/{id}/pay-driver/qr")
    @PreAuthorize("hasRole('PASSENGER')")
    public ResponseEntity<byte[]> driverQr(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return png(details.qrForPassenger(CurrentUser.id(jwt), id));
    }

    private static ResponseEntity<byte[]> png(byte[] qr) {
        if (qr == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No QR code");
        }
        // Not kept by the browser: a driver may change it, and it is shown only for a live booking.
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).cacheControl(CacheControl.noStore()).body(qr);
    }
}
