-- Track failed OTP attempts so the code can be invalidated after too many wrong tries.
-- Without this, an attacker could brute-force a 6-digit code over the 10-minute window
-- because failed attempts previously had no cost.
ALTER TABLE email_otps ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
