-- Make credentials_enc nullable (OAuth accounts don't need a password)
ALTER TABLE public.email_accounts
  ALTER COLUMN credentials_enc DROP NOT NULL;

-- OAuth fields
ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS oauth_provider          TEXT,
  ADD COLUMN IF NOT EXISTS oauth_access_token_enc  TEXT,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS oauth_expires_at        TIMESTAMPTZ;

-- Unique constraint needed for OAuth upsert (one account per email per user)
ALTER TABLE public.email_accounts
  ADD CONSTRAINT email_accounts_user_email_unique UNIQUE (user_id, email);
