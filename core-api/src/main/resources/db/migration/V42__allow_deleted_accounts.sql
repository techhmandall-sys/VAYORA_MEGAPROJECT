-- A member may delete their account (DELETE /api/v1/me). The row stays, because rides, bookings,
-- ratings, reports and the event log refer to it, but everything that identifies the person goes:
-- name, email, phone, password, Google link, referral code and declared document. A deleted account
-- is marked as such, with the moment it was deleted, and no longer needs an email or a phone.
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED'));
ALTER TABLE users ADD CONSTRAINT users_deleted_when CHECK ((status = 'DELETED') = (deleted_at IS NOT NULL));

ALTER TABLE users DROP CONSTRAINT users_email_or_phone;
ALTER TABLE users ADD CONSTRAINT users_email_or_phone
    CHECK (email IS NOT NULL OR phone IS NOT NULL OR status = 'DELETED');
