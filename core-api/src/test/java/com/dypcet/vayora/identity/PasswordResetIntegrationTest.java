package com.dypcet.vayora.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.account.MockMessageSender;
import com.dypcet.vayora.account.MockMessageSender.Sent;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Resetting a forgotten password with a code, and that neither step says whether an account exists.
 */
@AutoConfigureMockMvc
class PasswordResetIntegrationTest extends PostgresIntegrationTest {

    private static final Pattern CODE = Pattern.compile("reset code is (\\d{6})");
    private static final String SENT = "If that account exists, a reset code has been sent.";
    private static final String WRONG = "That code is wrong or has expired. Request a new one.";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private IdentityService identity;

    @Autowired
    private MockMessageSender mock;

    @Autowired
    private JdbcTemplate jdbc;

    private String email;
    private String phoneDigits;

    @BeforeEach
    void setUp() {
        email = "member-" + UUID.randomUUID() + "@example.test";
        phoneDigits = String.format("9%09d", Math.floorMod(UUID.randomUUID().getMostSignificantBits(), 1_000_000_000L));
    }

    @Test
    void anEmailAccountSetsANewPasswordWithTheCodeOnce() throws Exception {
        identity.register(email, "initial-password-1", "Asha Patil", UserRole.PASSENGER);

        forgot(email).andExpect(status().isOk()).andExpect(jsonPath("$.message").value(SENT));
        String code = codeSentTo(email);

        // Only a hash of the code is kept.
        String stored = jdbc.queryForObject(
                "SELECT code_hash FROM password_reset_codes WHERE destination = ? AND consumed_at IS NULL",
                String.class, email);
        assertThat(stored).doesNotContain(code).startsWith("$2");

        reset(email, code, "brand-new-password-2")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Your password has been reset. You can now sign in."));
        signIn("email", email, "brand-new-password-2").andExpect(status().isOk());
        signIn("email", email, "initial-password-1").andExpect(status().isUnauthorized());

        // Spent: the same code does nothing a second time.
        reset(email, code, "another-password-3").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(WRONG));
        signIn("email", email, "brand-new-password-2").andExpect(status().isOk());
    }

    @Test
    void aPhoneAccountSetsANewPasswordWhicheverWayTheNumberIsWritten() throws Exception {
        identity.registerByPhone(phoneDigits, "phone-secret-1", "Sanjay Shinde", UserRole.DRIVER);

        forgot(phoneDigits).andExpect(status().isOk());
        String code = codeSentTo("+91" + phoneDigits);

        reset("+91 " + phoneDigits, code, "phone-new-pass-2").andExpect(status().isOk());
        signIn("phone", phoneDigits, "phone-new-pass-2").andExpect(status().isOk());
    }

    @Test
    void wrongGuessesAreCountedAndEnoughOfThemSpendTheCode() throws Exception {
        identity.register(email, "some-password-1", "Rohit Pawar", UserRole.PASSENGER);
        forgot(email).andExpect(status().isOk());
        String code = codeSentTo(email);

        for (int i = 0; i < 5; i++) {
            reset(email, wrong(code), "new-pass-try-1").andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.detail").value(WRONG));
        }
        assertThat(jdbc.queryForObject("SELECT attempts FROM password_reset_codes WHERE destination = ?",
                Integer.class, email)).isEqualTo(5);

        reset(email, code, "new-pass-try-2").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(WRONG));
        signIn("email", email, "some-password-1").andExpect(status().isOk());
    }

    @Test
    void anUnknownAddressGetsTheSameAnswersAsARealOne() throws Exception {
        String nobody = "ghost-" + UUID.randomUUID() + "@example.test";
        identity.register(email, "some-password-1", "Meera Kulkarni", UserRole.PASSENGER);

        forgot(nobody).andExpect(status().isOk()).andExpect(jsonPath("$.message").value(SENT));
        forgot(email).andExpect(status().isOk()).andExpect(jsonPath("$.message").value(SENT));
        assertThat(mock.outbox()).noneMatch(sent -> sent.to().equals(nobody));

        // A failed reset reads the same for both.
        String code = codeSentTo(email);
        reset(nobody, "123456", "whatever-pass-1").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(WRONG));
        reset(email, wrong(code), "whatever-pass-1").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(WRONG));
    }

    @Test
    void askingAgainTooSoonSendsNothingNewAndSaysNoMore() throws Exception {
        identity.register(email, "pass-12345678", "Meera Kulkarni", UserRole.PASSENGER);

        forgot(email).andExpect(status().isOk());
        String first = codeSentTo(email);
        forgot(email).andExpect(status().isOk()).andExpect(jsonPath("$.message").value(SENT));

        assertThat(mock.outbox().stream().filter(sent -> sent.to().equals(email))).hasSize(1);
        reset(email, first, "pass-87654321").andExpect(status().isOk());
    }

    @Test
    void noCodeGoesToASuspendedAccountOrAnAdministrator() throws Exception {
        long id = identity.register(email, "pass-12345678", "Omkar Gaikwad", UserRole.DRIVER).id();
        jdbc.update("UPDATE users SET status = 'SUSPENDED' WHERE id = ?", id);

        forgot(email).andExpect(status().isOk()).andExpect(jsonPath("$.message").value(SENT));
        forgot("admin@example.test").andExpect(status().isOk()).andExpect(jsonPath("$.message").value(SENT));

        assertThat(mock.outbox()).noneMatch(sent -> sent.to().equals(email)
                || sent.to().equals("admin@example.test") && sent.text().contains("reset code"));
    }

    @Test
    void aResetLiftsTheLockThatWrongPasswordsSet() throws Exception {
        identity.register(email, "pass-12345678", "Sneha More", UserRole.PASSENGER);
        for (int i = 0; i < 5; i++) {
            signIn("email", email, "not-the-password").andExpect(status().isUnauthorized());
        }
        signIn("email", email, "pass-12345678").andExpect(status().isTooManyRequests());

        forgot(email).andExpect(status().isOk());
        reset(email, codeSentTo(email), "fresh-password-9").andExpect(status().isOk());

        signIn("email", email, "fresh-password-9").andExpect(status().isOk());
    }

    private ResultActions forgot(String login) throws Exception {
        return mvc.perform(post("/api/v1/auth/forgot-password").contentType("application/json")
                .content("{\"login\": \"" + login + "\"}"));
    }

    private ResultActions reset(String login, String code, String newPassword) throws Exception {
        return mvc.perform(post("/api/v1/auth/reset-password").contentType("application/json")
                .content("{\"login\": \"" + login + "\", \"code\": \"" + code + "\", \"newPassword\": \""
                        + newPassword + "\"}"));
    }

    private ResultActions signIn(String field, String login, String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content("{\"" + field + "\": \"" + login + "\", \"password\": \"" + password + "\"}"));
    }

    /** The code in the newest mock message to that address. */
    private String codeSentTo(String destination) {
        for (Sent sent : mock.outbox()) {
            Matcher matcher = CODE.matcher(sent.text());
            if (sent.to().equals(destination) && matcher.find()) {
                return matcher.group(1);
            }
        }
        throw new AssertionError("No reset code was sent to " + destination);
    }

    private static String wrong(String code) {
        return code.equals("000000") ? "000001" : "000000";
    }
}
