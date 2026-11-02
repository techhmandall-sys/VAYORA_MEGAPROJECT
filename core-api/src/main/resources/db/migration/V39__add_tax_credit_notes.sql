-- Credit notes (feature 50): the service fee went back after a tax invoice was issued for it, so
-- the invoice, which may not change, is reversed by a note of its own. What it reversed is kept as
-- it was issued, and it has its own numbers, without a gap per financial year, as invoices do.
CREATE TABLE tax_credit_notes (
    id             BIGSERIAL PRIMARY KEY,
    number         TEXT NOT NULL UNIQUE,
    financial_year TEXT NOT NULL,
    serial         INT NOT NULL,
    invoice_id     BIGINT NOT NULL UNIQUE REFERENCES tax_invoices(id),
    issued_at      TIMESTAMPTZ NOT NULL,
    taxable_value  NUMERIC(10, 2) NOT NULL,
    cgst           NUMERIC(10, 2) NOT NULL,
    sgst           NUMERIC(10, 2) NOT NULL,
    igst           NUMERIC(10, 2) NOT NULL,
    UNIQUE (financial_year, serial)
);

CREATE TABLE tax_credit_note_series (
    financial_year TEXT PRIMARY KEY,
    last_serial    INT NOT NULL
);

CREATE FUNCTION tax_credit_notes_are_final() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'tax_credit_notes cannot be changed once issued';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tax_credit_notes_no_rewrite
    BEFORE UPDATE OR DELETE ON tax_credit_notes
    FOR EACH ROW EXECUTE FUNCTION tax_credit_notes_are_final();
