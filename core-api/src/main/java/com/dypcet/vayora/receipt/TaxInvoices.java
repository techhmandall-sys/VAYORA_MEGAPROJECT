package com.dypcet.vayora.receipt;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tax invoices for what VAYORA itself charges (feature 50): the service fee on a booking, or a
 * pass. The fare is the driver's, so it is not on them. GST is taken out of the amount charged,
 * so no price changes. Off until a GST registration is configured.
 *
 * <p>An invoice is issued the first time it is asked for and stays as issued. Numbers run on
 * without a gap within an Indian financial year. The rate, the SAC code and treating the fare as
 * outside the invoice are the authors' reading, for a tax adviser to confirm before real use.
 */
@Component
public class TaxInvoices {

    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");
    private static final Pattern GSTIN = Pattern.compile("[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]");
    // Maharashtra, taken as where the service is supplied: the first two characters of a GSTIN
    // name the state. A simplification for rides elsewhere, in docs/KNOWN_LIMITATIONS.md.
    private static final String CORRIDOR_STATE = "27";
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    /**
     * @param ratePercent the whole GST rate, such as 18: half each as CGST and SGST within the
     *                    state, or all as IGST from another
     */
    public record TaxInvoice(String number, Instant issuedAt, String gstin, String legalName, String address,
            String sacCode, BigDecimal ratePercent, BigDecimal taxableValue, BigDecimal cgst, BigDecimal sgst,
            BigDecimal igst) {
    }

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final String gstin;
    private final String legalName;
    private final String address;
    private final BigDecimal rate;
    private final String sacCode;

    @Autowired
    public TaxInvoices(JdbcTemplate jdbc, Clock clock,
            @Value("${vayora.invoice.gstin}") String gstin,
            @Value("${vayora.invoice.legal-name}") String legalName,
            @Value("${vayora.invoice.address}") String address,
            @Value("${vayora.invoice.gst-rate}") BigDecimal rate,
            @Value("${vayora.invoice.sac-code}") String sacCode) {
        boolean any = !(gstin.isBlank() && legalName.isBlank() && address.isBlank());
        if (any && (gstin.isBlank() || legalName.isBlank() || address.isBlank())) {
            throw new IllegalStateException("Set VAYORA_GSTIN, VAYORA_LEGAL_NAME and VAYORA_LEGAL_ADDRESS, or none");
        }
        if (!gstin.isBlank() && !GSTIN.matcher(gstin).matches()) {
            throw new IllegalStateException("VAYORA_GSTIN is not in the form of a GSTIN");
        }
        this.jdbc = jdbc;
        this.clock = clock;
        this.gstin = gstin;
        this.legalName = legalName;
        this.address = address;
        this.rate = rate;
        this.sacCode = sacCode;
    }

    public boolean configured() {
        return !gstin.isBlank();
    }

    /**
     * The booking's invoice: the one issued already, whatever has happened since, or otherwise a
     * new one when {@code due}.
     *
     * @param charged the service fee, GST included
     */
    @Transactional
    public Optional<TaxInvoice> forBooking(long bookingId, BigDecimal charged, boolean due) {
        return invoice("booking_id", bookingId, charged, due);
    }

    /** The same for a pass, whose whole price is VAYORA's charge. */
    @Transactional
    public Optional<TaxInvoice> forPass(long passId, BigDecimal charged, boolean due) {
        return invoice("pass_id", passId, charged, due);
    }

    /** @param column a fixed column name, never caller input */
    private Optional<TaxInvoice> invoice(String column, long id, BigDecimal charged, boolean due) {
        Optional<TaxInvoice> issued = find(column, id);
        if (issued.isPresent() || !due || !configured() || charged.signum() <= 0) {
            return issued;
        }
        String year = financialYear(LocalDate.now(clock.withZone(INDIA_ZONE)));
        jdbc.update("INSERT INTO tax_invoice_series (financial_year, last_serial) VALUES (?, 0) ON CONFLICT DO NOTHING", year);
        int last = jdbc.queryForObject("SELECT last_serial FROM tax_invoice_series WHERE financial_year = ? FOR UPDATE",
                Integer.class, year);
        // Asked for twice at once: the other request may have issued it while this one waited.
        issued = find(column, id);
        if (issued.isPresent()) {
            return issued;
        }
        int serial = last + 1;
        jdbc.update("UPDATE tax_invoice_series SET last_serial = ? WHERE financial_year = ?", serial, year);

        BigDecimal taxable = charged.multiply(HUNDRED)
                .divide(HUNDRED.add(rate.multiply(HUNDRED)), 2, RoundingMode.HALF_UP);
        BigDecimal tax = charged.subtract(taxable);
        boolean sameState = gstin.startsWith(CORRIDOR_STATE);
        // Halves that add back up to the tax, whichever way the odd paisa falls.
        BigDecimal cgst = sameState ? tax.divide(BigDecimal.TWO, 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal sgst = sameState ? tax.subtract(cgst) : BigDecimal.ZERO;
        BigDecimal igst = sameState ? BigDecimal.ZERO : tax;
        jdbc.update("INSERT INTO tax_invoices (number, financial_year, serial, " + column + """
                , issued_at, gstin, legal_name, address,
                                          sac_code, rate, taxable_value, cgst, sgst, igst)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                "VAY/%s/%06d".formatted(year, serial), year, serial, id,
                clock.instant().atOffset(ZoneOffset.UTC), gstin, legalName, address, sacCode, rate, taxable, cgst, sgst, igst);
        return find(column, id);
    }

    private Optional<TaxInvoice> find(String column, long id) {
        List<TaxInvoice> found = jdbc.query("SELECT * FROM tax_invoices WHERE " + column + " = ?", TaxInvoices::row, id);
        return found.stream().findFirst();
    }

    private static TaxInvoice row(ResultSet rs, int n) throws SQLException {
        return new TaxInvoice(rs.getString("number"), rs.getObject("issued_at", OffsetDateTime.class).toInstant(),
                rs.getString("gstin"), rs.getString("legal_name"), rs.getString("address"), rs.getString("sac_code"),
                rs.getBigDecimal("rate").multiply(HUNDRED).stripTrailingZeros(), rs.getBigDecimal("taxable_value"),
                rs.getBigDecimal("cgst"), rs.getBigDecimal("sgst"), rs.getBigDecimal("igst"));
    }

    /** April to March, as 2026-27. */
    static String financialYear(LocalDate day) {
        int start = day.getMonthValue() >= 4 ? day.getYear() : day.getYear() - 1;
        return "%d-%02d".formatted(start, (start + 1) % 100);
    }
}
