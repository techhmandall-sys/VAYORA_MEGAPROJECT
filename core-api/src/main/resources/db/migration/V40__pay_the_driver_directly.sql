-- Passengers now pay their driver directly, in cash or by UPI, after the ride. VAYORA takes no
-- money and charges nothing: no provider, no service fee, no passes, no tax invoices.
--
-- Everything removed here recorded simulated money. The only provider that ever ran was a mock,
-- or Razorpay's test mode, and neither moved any.

DROP TABLE tax_credit_notes;
DROP TABLE tax_credit_note_series;
DROP TABLE tax_invoices;
DROP TABLE tax_invoice_series;
DROP FUNCTION tax_credit_notes_are_final();
DROP FUNCTION tax_invoices_are_final();

DROP TABLE passes;

DROP TABLE settlements;
DROP TABLE refunds;
DROP TABLE ledger_entries;
DROP FUNCTION ledger_is_append_only();

-- No longer the driver's choice: every ride is paid for this way.
ALTER TABLE rides DROP COLUMN pay_after_ride;

ALTER TABLE payment_intents
    DROP CONSTRAINT amount_is_fare_plus_fee,
    DROP CONSTRAINT paid_says_how,
    DROP CONSTRAINT only_deferred_waits,
    DROP CONSTRAINT due_is_part_of_the_amount,
    DROP CONSTRAINT owed_when_due,
    DROP CONSTRAINT payment_intents_method_check,
    DROP CONSTRAINT payment_intents_status_check;

-- A payment "taken" by a provider never happened. Cash the driver recorded did, and stays.
DELETE FROM payment_intents WHERE status = 'SETTLED' AND provider IS DISTINCT FROM 'CASH';

-- A live booking on a simulated hold has paid nothing, so it pays after the ride like the rest.
UPDATE payment_intents SET status = 'DEFERRED', method = NULL WHERE status = 'HELD';

-- Still owing: the service fee inside it is no longer charged.
UPDATE payment_intents
SET status = CASE WHEN amount_due > service_fee THEN 'DUE' ELSE 'VOID' END,
    due_reason = CASE WHEN amount_due > service_fee THEN due_reason END,
    settled_at = CASE WHEN amount_due > service_fee THEN NULL ELSE now() END,
    amount_due = NULLIF(GREATEST(amount_due - service_fee, 0), 0)
WHERE status = 'DUE';

-- Still one intent per booking, holding what it costs and what it owes:
--   DEFERRED  the booking is live, and nothing is owed yet
--   DUE       it ended owing the driver amount_due, for due_reason
--   SETTLED   the driver says they were paid amount_due, by method
--   VOID      it ended owing nothing
ALTER TABLE payment_intents
    DROP COLUMN service_fee,
    DROP COLUMN amount,
    DROP COLUMN provider,
    DROP COLUMN provider_ref,
    DROP COLUMN deferred,
    ADD CONSTRAINT payment_intents_method_check CHECK (method IN ('CASH', 'UPI')),
    ADD CONSTRAINT payment_intents_status_check CHECK (status IN ('DEFERRED', 'DUE', 'SETTLED', 'VOID')),
    -- How it was paid is known exactly when the driver has said it was.
    ADD CONSTRAINT paid_says_how CHECK ((method IS NOT NULL) = (status = 'SETTLED')),
    ADD CONSTRAINT owed_when_due CHECK ((amount_due IS NOT NULL) = (status IN ('DUE', 'SETTLED'))),
    ADD CONSTRAINT owes_something CHECK (amount_due IS NULL OR amount_due > 0);

-- Where a driver takes UPI. Apart from their photo and rating, this is the only thing about a
-- driver a passenger is shown for paying them, and only once their booking is confirmed.
CREATE TABLE driver_payment_details (
    user_id    BIGINT PRIMARY KEY REFERENCES users(id),
    upi_id     TEXT,
    -- Written again from its pixels, as a PNG: a QR code must stay sharp enough to scan.
    qr_png     BYTEA,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
