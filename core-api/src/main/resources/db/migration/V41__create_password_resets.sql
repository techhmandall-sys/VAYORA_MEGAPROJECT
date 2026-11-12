-- A code that resets a forgotten password, sent to an account's email address or phone number.
-- Only its hash is kept. A new code spends any earlier one.
CREATE TABLE password_reset_codes (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    channel     TEXT NOT NULL CHECK (channel IN ('EMAIL', 'PHONE')),
    -- The address the code was sent to.
    destination TEXT NOT NULL,
    code_hash   TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INT NOT NULL DEFAULT 0,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_codes_user ON password_reset_codes(user_id, id DESC);
