package com.dypcet.vayora.receipt;

import com.dypcet.vayora.identity.CurrentUser;
import com.dypcet.vayora.receipt.ReceiptService.BookingReceipt;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize("hasRole('PASSENGER')")
public class ReceiptController {

    private final ReceiptService receipts;

    public ReceiptController(ReceiptService receipts) {
        this.receipts = receipts;
    }

    @GetMapping("/bookings/{id}/receipt")
    public ResponseEntity<byte[]> booking(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return pdf(receipts.forBooking(CurrentUser.id(jwt), id), "vayora-booking-" + id + ".pdf");
    }

    /** The same receipt as facts, for the app to show in the member's language and script. */
    @GetMapping("/bookings/{id}/receipt-data")
    public BookingReceipt bookingData(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return receipts.booking(CurrentUser.id(jwt), id);
    }

    private static ResponseEntity<byte[]> pdf(byte[] body, String filename) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(body);
    }
}
