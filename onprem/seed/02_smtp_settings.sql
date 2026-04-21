-- SMTP placeholder. The edge runtime reads SMTP_* directly from env vars,
-- so this file only documents that fact and lets operators verify settings
-- via SQL if needed. No table writes required by default.
DO $$
BEGIN
  RAISE NOTICE 'SMTP is configured via .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM). No DB row required.';
END $$;
