package com.dypcet.vayora.vehicle;

import com.dypcet.vayora.check.DocumentCheckService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

@Service
public class VehicleService {

    public enum Comfort {
        BASIC,
        COMFORT,
        PREMIUM
    }

    /** The largest bag each passenger may bring. */
    public enum Luggage {
        NONE,
        SMALL,
        MEDIUM,
        LARGE
    }

    /**
     * What the driver says about the car. Null means not said.
     *
     * @param batteryKwh             usable battery capacity; only for an electric vehicle
     * @param consumptionKwhPer100Km what it uses on the road; only for an electric vehicle
     */
    public record Details(Comfort comfort, Luggage luggage, boolean electric, BigDecimal batteryKwh,
            BigDecimal consumptionKwhPer100Km) {

        public static final Details NONE = new Details(null, null, false, null, null);
    }

    /**
     * @param seats            total seats including the driver's
     * @param estimatedRangeKm battery divided by consumption: what the driver's two figures
     *                         imply on a full charge, not a measured range; null unless both
     *                         were given
     * @param insurer          the insurer the driver says covers the car, until
     *                         {@code insuredUntil}; declared, never checked; both null if not said
     */
    public record Vehicle(long id, long ownerId, String make, String model, Integer year,
            String colour, int seats, Comfort comfort, Luggage luggage, boolean electric,
            BigDecimal batteryKwh, BigDecimal consumptionKwhPer100Km, Integer estimatedRangeKm,
            String insurer, LocalDate insuredUntil) {
    }

    private static final RowMapper<Vehicle> MAPPER = (rs, n) -> {
        BigDecimal battery = rs.getBigDecimal("battery_kwh");
        BigDecimal consumption = rs.getBigDecimal("consumption_kwh_per_100km");
        return new Vehicle(
                rs.getLong("id"), rs.getLong("owner_id"), rs.getString("make"), rs.getString("model"),
                (Integer) rs.getObject("year"), rs.getString("colour"), rs.getInt("seats"),
                rs.getString("comfort") == null ? null : Comfort.valueOf(rs.getString("comfort")),
                rs.getString("luggage") == null ? null : Luggage.valueOf(rs.getString("luggage")),
                rs.getBoolean("electric"), battery, consumption, rangeKm(battery, consumption),
                rs.getString("insurer"), rs.getObject("insured_until", LocalDate.class));
    };

    /** Kilometres on a full battery at the stated consumption, rounded down. */
    static Integer rangeKm(BigDecimal batteryKwh, BigDecimal consumptionKwhPer100Km) {
        if (batteryKwh == null || consumptionKwhPer100Km == null) {
            return null;
        }
        return batteryKwh.multiply(BigDecimal.valueOf(100))
                .divide(consumptionKwhPer100Km, 0, RoundingMode.DOWN).intValueExact();
    }

    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final DocumentCheckService checks;

    public VehicleService(JdbcTemplate jdbc, Clock clock, DocumentCheckService checks) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.checks = checks;
    }

    public Vehicle create(long ownerId, String make, String model, Integer year, String colour,
            int seats) {
        return create(ownerId, make, model, year, colour, seats, Details.NONE);
    }

    public Vehicle create(long ownerId, String make, String model, Integer year, String colour,
            int seats, Details details) {
        if (!details.electric()
                && (details.batteryKwh() != null || details.consumptionKwhPer100Km() != null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Battery and consumption are only for an electric vehicle");
        }
        Long id = jdbc.queryForObject("""
                INSERT INTO vehicles (owner_id, make, model, year, colour, seats, comfort, luggage,
                                      electric, battery_kwh, consumption_kwh_per_100km)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                Long.class, ownerId, make, model, year, colour, seats,
                details.comfort() == null ? null : details.comfort().name(),
                details.luggage() == null ? null : details.luggage().name(),
                details.electric(), details.batteryKwh(), details.consumptionKwhPer100Km());
        return findOwned(id, ownerId);
    }

    /**
     * Records the insurance the driver says covers this car (feature 58). Nothing is checked
     * with the insurer, and no policy number is asked for. Staff may be asked to see the policy
     * (DocumentCheckService); declaring again starts that over.
     */
    public Vehicle declareInsurance(long vehicleId, long ownerId, String insurer, LocalDate insuredUntil) {
        if (insuredUntil.isBefore(LocalDate.now(clock.withZone(INDIA_ZONE)))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That insurance has already ended");
        }
        if (jdbc.update("UPDATE vehicles SET insurer = ?, insured_until = ? WHERE id = ? AND owner_id = ?",
                insurer.strip(), insuredUntil, vehicleId, ownerId) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found");
        }
        checks.withdrawInsurance(vehicleId);
        return findOwned(vehicleId, ownerId);
    }

    public Vehicle clearInsurance(long vehicleId, long ownerId) {
        if (jdbc.update("UPDATE vehicles SET insurer = NULL, insured_until = NULL WHERE id = ? AND owner_id = ?",
                vehicleId, ownerId) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found");
        }
        checks.withdrawInsurance(vehicleId);
        return findOwned(vehicleId, ownerId);
    }

    public List<Vehicle> ownedBy(long ownerId) {
        return jdbc.query("SELECT * FROM vehicles WHERE owner_id = ? ORDER BY id", MAPPER, ownerId);
    }

    /** Returns the vehicle only if this owner owns it; null otherwise. */
    public Vehicle findOwned(long vehicleId, long ownerId) {
        List<Vehicle> found = jdbc.query(
                "SELECT * FROM vehicles WHERE id = ? AND owner_id = ?", MAPPER, vehicleId, ownerId);
        return found.isEmpty() ? null : found.get(0);
    }
}
