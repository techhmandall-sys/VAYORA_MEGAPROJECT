package com.dypcet.vayora.account;

import com.dypcet.vayora.account.AccountService.Chattiness;
import com.dypcet.vayora.account.AccountService.EmergencyContact;
import com.dypcet.vayora.account.AccountService.Gender;
import com.dypcet.vayora.account.AccountService.IdDocument;
import com.dypcet.vayora.account.AccountService.MyProfile;
import com.dypcet.vayora.account.AccountService.ProfileUpdate;
import com.dypcet.vayora.account.MessageSender.Channel;
import com.dypcet.vayora.account.MockMessageSender.Sent;
import com.dypcet.vayora.account.SosService.Alert;
import com.dypcet.vayora.account.SosService.Raised;
import com.dypcet.vayora.identity.CurrentUser;
import com.dypcet.vayora.identity.TokenRevocationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
public class AccountController {

    private static final String PHONE = "^\\+?[0-9]{10,15}$";

    public record ProfileRequest(
            // Empty means "remove my number".
            @Pattern(regexp = "^$|" + PHONE) String phone,
            @Size(max = 500) String bio,
            @Min(1900) @Max(2100) Integer birthYear,
            Gender gender, Boolean smoking, Boolean pets, Boolean music, Chattiness chattiness) {
    }

    public record CodeRequest(@NotBlank @Pattern(regexp = "^[0-9]{6}$") String code) {
    }

    /** Only the kind of document: there is nowhere to send its number or a copy. */
    public record IdRequest(@NotNull IdDocument document) {
    }

    public record ContactRequest(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Pattern(regexp = PHONE) String phone,
            @Size(max = 50) String relation) {
    }

    public record SosRequest(Long rideId,
            @DecimalMin("-90") @DecimalMax("90") Double lat,
            @DecimalMin("-180") @DecimalMax("180") Double lon) {
    }

    private final AccountService accounts;
    private final SosService sos;
    private final MockMessageSender mock;
    private final TokenRevocationService revocations;

    public AccountController(AccountService accounts, SosService sos, MockMessageSender mock,
            TokenRevocationService revocations) {
        this.accounts = accounts;
        this.sos = sos;
        this.mock = mock;
        this.revocations = revocations;
    }

    @GetMapping("/me/profile")
    public MyProfile profile(@AuthenticationPrincipal Jwt jwt) {
        return accounts.profile(CurrentUser.id(jwt));
    }

    @PutMapping("/me/profile")
    public MyProfile update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileRequest request) {
        return accounts.update(CurrentUser.id(jwt), new ProfileUpdate(request.phone(), request.bio(),
                request.birthYear(), request.gender(), request.smoking(), request.pets(),
                request.music(), request.chattiness()));
    }

    /** Everything VAYORA keeps about the member, as one JSON document to save. */
    @GetMapping("/me/export")
    public Map<String, Object> exportData(@AuthenticationPrincipal Jwt jwt) {
        return accounts.export(CurrentUser.id(jwt));
    }

    /**
     * Deletes the member's account and ends the session that asked; any other session ends at its
     * next request. Administrators come from configuration and are not deleted here.
     */
    @DeleteMapping("/me")
    @PreAuthorize("hasAnyRole('PASSENGER', 'DRIVER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(@AuthenticationPrincipal Jwt jwt) {
        accounts.delete(CurrentUser.id(jwt));
        revocations.revoke(jwt);
    }

    @PutMapping("/me/id-declaration")
    public MyProfile declareId(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody IdRequest request) {
        return accounts.declareId(CurrentUser.id(jwt), request.document());
    }

    @DeleteMapping("/me/id-declaration")
    public MyProfile withdrawId(@AuthenticationPrincipal Jwt jwt) {
        return accounts.withdrawId(CurrentUser.id(jwt));
    }

    @PostMapping("/me/verification/{channel}/request")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void requestCode(@AuthenticationPrincipal Jwt jwt, @PathVariable String channel) {
        accounts.requestCode(CurrentUser.id(jwt), channel(channel));
    }

    @PostMapping("/me/verification/{channel}/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmCode(@AuthenticationPrincipal Jwt jwt, @PathVariable String channel,
            @Valid @RequestBody CodeRequest request) {
        accounts.confirmCode(CurrentUser.id(jwt), channel(channel), request.code());
    }

    /** The path says "email" or "phone". */
    private static Channel channel(String path) {
        return switch (path) {
            case "email" -> Channel.EMAIL;
            case "phone" -> Channel.PHONE;
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No such channel");
        };
    }

    @GetMapping("/me/emergency-contacts")
    public List<EmergencyContact> contacts(@AuthenticationPrincipal Jwt jwt) {
        return accounts.contacts(CurrentUser.id(jwt));
    }

    @PostMapping("/me/emergency-contacts")
    @ResponseStatus(HttpStatus.CREATED)
    public EmergencyContact addContact(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ContactRequest request) {
        return accounts.addContact(CurrentUser.id(jwt), request.name(), request.phone(),
                request.relation());
    }

    @DeleteMapping("/me/emergency-contacts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeContact(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        accounts.removeContact(CurrentUser.id(jwt), id);
    }

    @PostMapping("/sos")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('PASSENGER', 'DRIVER')")
    public Raised raiseSos(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SosRequest request) {
        return sos.raise(CurrentUser.id(jwt), request.rideId(), request.lat(), request.lon());
    }

    @GetMapping("/admin/sos")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Alert> openAlerts() {
        return sos.open();
    }

    @PostMapping("/admin/sos/{id}/acknowledge")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void acknowledge(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        sos.acknowledge(CurrentUser.id(jwt), id);
    }

    /**
     * What the mock sender was asked to send, newest first, including verification codes.
     * It exists so a demonstration can be completed without a real provider; with a real
     * provider there would be nothing here to read.
     */
    @GetMapping("/admin/mock-outbox")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Sent> mockOutbox() {
        return mock.outbox();
    }
}
