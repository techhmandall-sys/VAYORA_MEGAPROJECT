package com.dypcet.vayora;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** The HTTP surface: authentication, roles, ownership, and one journey end to end. */
@AutoConfigureMockMvc
class ApiIntegrationTest extends PostgresIntegrationTest {

    private static final String PASSWORD = "correct-horse-battery";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void healthIsPublicAndEverythingElseNeedsAToken() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/bookings")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void registrationStoresAHashAndLoginReturnsAWorkingToken() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        register(email, "PASSENGER");

        assertThat(jdbc.queryForObject(
                "SELECT password_hash FROM users WHERE email = ?", String.class, email))
                .startsWith("$2").doesNotContain(PASSWORD);

        String token = body(mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk())).get("accessToken").asText();

        as(token, get("/api/v1/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.role").value("PASSENGER"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void badCredentialsDuplicateEmailsAndWeakInputAreRefused() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        register(email, "DRIVER");

        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", "wrong-one"))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        Map.of("email", "nobody@example.test", "password", PASSWORD))))
                .andExpect(status().isUnauthorized());

        mvc.perform(registration(email, PASSWORD, "DRIVER")).andExpect(status().isConflict());
        mvc.perform(registration("a@example.test", "short", "DRIVER"))
                .andExpect(status().isBadRequest());
        mvc.perform(registration("not-an-email", PASSWORD, "DRIVER"))
                .andExpect(status().isBadRequest());
        mvc.perform(registration(UUID.randomUUID() + "@example.test", PASSWORD, "ADMIN"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rolesGateWhoMayPublishAndWhoMayBook() throws Exception {
        String passenger = register(UUID.randomUUID() + "@example.test", "PASSENGER");
        String driver = register(UUID.randomUUID() + "@example.test", "DRIVER");

        as(passenger, post("/api/v1/vehicles").contentType(MediaType.APPLICATION_JSON)
                .content(vehicleJson())).andExpect(status().isForbidden());
        as(passenger, post("/api/v1/rides").contentType(MediaType.APPLICATION_JSON)
                .content(rideJson(1, Instant.now().plus(Duration.ofDays(2)))))
                .andExpect(status().isForbidden());
        as(driver, post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON)
                .content(bookingJson(1, 0, 1))).andExpect(status().isForbidden());
        as(driver, post("/api/v1/bookings/1/cancel")).andExpect(status().isForbidden());
        as(passenger, post("/api/v1/bookings/1/accept")).andExpect(status().isForbidden());
        for (String driverOnly : List.of("/rides/1/start", "/rides/1/complete",
                "/rides/1/cancel", "/bookings/1/no-show")) {
            as(passenger, post("/api/v1" + driverOnly)).andExpect(status().isForbidden());
        }
    }

    @Test
    void aDriverPublishesAPassengerFindsBooksAndCancels() throws Exception {
        String driver = register(UUID.randomUUID() + "@example.test", "DRIVER");
        String passenger = register(UUID.randomUUID() + "@example.test", "PASSENGER");
        String stranger = register(UUID.randomUUID() + "@example.test", "PASSENGER");
        Instant departure = Instant.now().plus(Duration.ofDays(2));

        long vehicleId = body(as(driver, post("/api/v1/vehicles")
                .contentType(MediaType.APPLICATION_JSON).content(vehicleJson()))
                .andExpect(status().isCreated())).get("id").asLong();

        long rideId = body(as(driver, post("/api/v1/rides")
                .contentType(MediaType.APPLICATION_JSON)
                .content(rideJson(vehicleId, departure)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.stops.length()").value(3))
                .andExpect(jsonPath("$.segments[1].seatsAvailable").value(3)))
                .get("id").asLong();

        String day = departure.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate().toString();
        JsonNode results = body(as(passenger, get("/api/v1/rides/search")
                .param("originLat", "16.7050").param("originLon", "74.2433")
                .param("destLat", "18.5204").param("destLon", "73.8567")
                .param("date", day).param("seats", "2"))
                .andExpect(status().isOk()));
        assertThat(results.findValuesAsText("rideId")).contains(Long.toString(rideId));

        long bookingId = body(as(passenger, post("/api/v1/bookings")
                .contentType(MediaType.APPLICATION_JSON).content(bookingJson(rideId, 0, 2)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.price").value(1040.0))
                .andExpect(jsonPath("$.paymentStatus").value("DEFERRED")))
                .get("id").asLong();

        // The driver and the booked passenger are on the ride; nobody else is.
        as(driver, get("/api/v1/rides/" + rideId + "/membership"))
                .andExpect(jsonPath("$.role").value("DRIVER"))
                .andExpect(jsonPath("$.rideStatus").value("SCHEDULED"));
        as(passenger, get("/api/v1/rides/" + rideId + "/membership"))
                .andExpect(jsonPath("$.role").value("PASSENGER"))
                .andExpect(jsonPath("$.fullName").value("Test User"));
        as(stranger, get("/api/v1/rides/" + rideId + "/membership")).andExpect(status().isNotFound());
        as(stranger, get("/api/v1/rides/999999999/membership")).andExpect(status().isNotFound());

        // Another passenger can neither see nor cancel it.
        as(stranger, get("/api/v1/bookings")).andExpect(jsonPath("$.length()").value(0));
        as(stranger, post("/api/v1/bookings/" + bookingId + "/cancel"))
                .andExpect(status().isNotFound());

        as(driver, get("/api/v1/rides/" + rideId + "/bookings"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].passengerName").value("Test User"))
                .andExpect(jsonPath("$[0].fromStop").value("Kolhapur"))
                .andExpect(jsonPath("$[0].toStop").value("Pune"));
        as(driver, get("/api/v1/rides/mine"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(rideId));
        as(passenger, get("/api/v1/rides/mine")).andExpect(status().isForbidden());
        as(driver, post("/api/v1/bookings/" + bookingId + "/accept"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"));

        as(passenger, post("/api/v1/bookings/" + bookingId + "/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        as(passenger, post("/api/v1/bookings/" + bookingId + "/cancel"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").exists());

        // Having cancelled, the passenger is no longer on the ride.
        as(passenger, get("/api/v1/rides/" + rideId + "/membership")).andExpect(status().isNotFound());

        as(passenger, get("/api/v1/rides/" + rideId))
                .andExpect(jsonPath("$.segments[0].seatsAvailable").value(3))
                .andExpect(jsonPath("$.segments[1].seatsAvailable").value(3));
    }

    @Test
    void aBadSearchIsTheCallersMistakeNotAServerError() throws Exception {
        String passenger = register(UUID.randomUUID() + "@example.test", "PASSENGER");

        for (String[] bad : new String[][] {
                {"seats", "0"}, {"seats", "9"}, {"seats", "two"}, {"date", "next tuesday"},
                {"originLat", "91"}, {"destLon", "-181"}, {"originLon", "east"}, {"sort", "VIBES"}}) {
            Map<String, String> params = new java.util.HashMap<>(Map.of(
                    "originLat", "16.7050", "originLon", "74.2433", "destLat", "18.5204",
                    "destLon", "73.8567", "date", "2026-11-02", "seats", "1"));
            params.put(bad[0], bad[1]);
            MockHttpServletRequestBuilder search = get("/api/v1/rides/search");
            params.forEach(search::param);
            as(passenger, search).andExpect(status().isBadRequest());
        }
        as(passenger, get("/api/v1/rides/search").param("originLat", "16.7050"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void onlyTheConfiguredBrowserOriginMayCallTheApi() throws Exception {
        mvc.perform(options("/api/v1/bookings")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "authorization,content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
        // A browser asks before every method that is not a plain GET or POST. Each one a
        // screen uses has to be allowed, or that screen works everywhere except a browser.
        for (String[] call : new String[][] {{"PUT", "/api/v1/me/profile"},
                {"DELETE", "/api/v1/me/emergency-contacts/1"}, {"DELETE", "/api/v1/holds/mine"}}) {
            mvc.perform(options(call[1])
                            .header("Origin", "http://localhost:5173")
                            .header("Access-Control-Request-Method", call[0])
                            .header("Access-Control-Request-Headers", "authorization,content-type"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Access-Control-Allow-Methods",
                            org.hamcrest.Matchers.containsString(call[0])));
        }
        mvc.perform(options("/api/v1/bookings")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "PATCH"))
                .andExpect(status().isForbidden());
        mvc.perform(options("/api/v1/bookings")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }

    /** Registers a user and returns their access token. */
    private String register(String email, String role) throws Exception {
        return body(mvc.perform(registration(email, PASSWORD, role))
                .andExpect(status().isCreated())).get("accessToken").asText();
    }

    private MockHttpServletRequestBuilder registration(String email, String password, String role)
            throws Exception {
        return post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "email", email, "password", password, "fullName", "Test User",
                        "role", role)));
    }

    private ResultActions as(String token, MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + token));
    }

    private JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private String vehicleJson() throws Exception {
        return json.writeValueAsString(Map.of(
                "make", "Maruti", "model", "Ertiga", "year", 2022, "colour", "Silver", "seats", 7));
    }

    /** Kolhapur, Satara, Pune; three seats; the driver approves each booking. */
    private String rideJson(long vehicleId, Instant departure) throws Exception {
        return json.writeValueAsString(Map.of(
                "vehicleId", vehicleId,
                "departureTime", departure.toString(),
                "seatsOffered", 3,
                "instantBooking", false,
                "stops", List.of(
                        Map.of("name", "Kolhapur", "lat", 16.7050, "lon", 74.2433,
                                "offsetMinutes", 0),
                        Map.of("name", "Satara", "lat", 17.6805, "lon", 74.0183,
                                "offsetMinutes", 130),
                        Map.of("name", "Pune", "lat", 18.5204, "lon", 73.8567,
                                "offsetMinutes", 270)),
                "segmentPrices", List.of(270, 250)));
    }

    private String bookingJson(long rideId, int fromSeq, int toSeq) throws Exception {
        return json.writeValueAsString(Map.of(
                "rideId", rideId, "fromSeq", fromSeq, "toSeq", toSeq, "seats", 2));
    }
}
