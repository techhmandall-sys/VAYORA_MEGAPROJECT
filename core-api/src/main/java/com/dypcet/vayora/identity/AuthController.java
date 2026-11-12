package com.dypcet.vayora.identity;

import com.dypcet.vayora.identity.IdentityService.User;
import com.dypcet.vayora.referral.ReferralService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
public class AuthController {

    /** Exactly one of {@code email} and {@code phone}: it is what the member signs in with. */
    public record RegisterRequest(
            @Email @Size(max = 254) String email,
            @Pattern(regexp = PHONE) String phone,
            // BCrypt reads at most 72 bytes.
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(max = 100) String fullName,
            @NotNull UserRole role,
            // Optional: the code of the member who invited them.
            @Size(max = 20) String referralCode) {
    }

    /** Exactly one of {@code email} and {@code phone}. */
    public record LoginRequest(String email, String phone, @NotBlank String password) {
    }

    // Spaces and hyphens allowed; Phones.normalise removes them.
    private static final String PHONE = "^\\+?[0-9][0-9 -]{8,18}[0-9]$";

    public record TokenResponse(String accessToken, long expiresInSeconds, User user) {
    }

    /** @param login the email address or phone number the account signs in with */
    public record ForgotPasswordRequest(@NotBlank @Size(max = 254) String login) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Size(max = 254) String login,
            @NotBlank @Pattern(regexp = "^[0-9]{6}$") String code,
            @NotBlank @Size(min = 8, max = 72) String newPassword) {
    }

    public record MessageResponse(String message) {
    }

    /** @param role passenger or driver, needed only to create an account */
    public record GoogleRequest(@NotBlank @Size(max = 4096) String idToken, UserRole role) {
    }

    /** @param clientId null when Google sign-in is off */
    public record GoogleSettings(String clientId) {
    }

    private final IdentityService identity;
    private final TokenService tokens;
    private final ReferralService referrals;
    private final GoogleSignInService google;
    private final PasswordResetService passwordReset;
    private final TokenRevocationService revocations;

    public AuthController(IdentityService identity, TokenService tokens, ReferralService referrals,
            GoogleSignInService google, PasswordResetService passwordReset, TokenRevocationService revocations) {
        this.google = google;
        this.identity = identity;
        this.tokens = tokens;
        this.referrals = referrals;
        this.passwordReset = passwordReset;
        this.revocations = revocations;
    }

    /** The member's referral code, and how many have signed up and travelled with it. */
    @GetMapping("/me/referral")
    public ReferralService.Summary referral(@AuthenticationPrincipal Jwt jwt) {
        return referrals.summary(CurrentUser.id(jwt));
    }

    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public TokenResponse register(@Valid @RequestBody RegisterRequest request) {
        // Checked first, so a mistyped code creates no account.
        Long referrer = request.referralCode() == null || request.referralCode().isBlank() ? null
                : referrals.referrerOf(request.referralCode());
        boolean byPhone = oneOf(request.email(), request.phone());
        User user = byPhone
                ? identity.registerByPhone(request.phone(), request.password(), request.fullName(), request.role())
                : identity.register(request.email(), request.password(), request.fullName(), request.role());
        if (referrer != null) {
            referrals.recordSignUp(referrer, user.id());
        }
        return tokenFor(user);
    }

    @PostMapping("/auth/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return tokenFor(oneOf(request.email(), request.phone())
                ? identity.authenticateByPhone(request.phone(), request.password())
                : identity.authenticate(request.email(), request.password()));
    }

    /** Ends this session: the token stops working at once instead of when it expires. */
    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal Jwt jwt) {
        revocations.revoke(jwt);
    }

    /** Sends a reset code if the address is a member's. The answer is the same either way. */
    @PostMapping("/auth/forgot-password")
    public MessageResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordReset.requestReset(request.login());
        return new MessageResponse("If that account exists, a reset code has been sent.");
    }

    /** Sets a new password with the code that was sent. Every failure gets the same answer. */
    @PostMapping("/auth/reset-password")
    public MessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordReset.resetPassword(request.login(), request.code(), request.newPassword());
        return new MessageResponse("Your password has been reset. You can now sign in.");
    }

    /** True for a phone, false for an email; refuses neither or both. */
    private static boolean oneOf(String email, String phone) {
        boolean hasEmail = email != null && !email.isBlank();
        boolean hasPhone = phone != null && !phone.isBlank();
        if (hasEmail == hasPhone) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Give an email address or a phone number");
        }
        return hasPhone;
    }

    @GetMapping("/auth/google")
    public GoogleSettings googleSettings() {
        return new GoogleSettings(google.clientId());
    }

    @PostMapping("/auth/google")
    public TokenResponse google(@Valid @RequestBody GoogleRequest request) {
        return tokenFor(google.signIn(request.idToken(), request.role()));
    }

    @GetMapping("/me")
    public User me(@AuthenticationPrincipal Jwt jwt) {
        return identity.get(CurrentUser.id(jwt));
    }

    private TokenResponse tokenFor(User user) {
        return new TokenResponse(tokens.issue(user.id(), user.role()), tokens.ttlSeconds(), user);
    }
}
