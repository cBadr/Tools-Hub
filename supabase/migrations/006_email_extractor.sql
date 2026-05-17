-- Email Extractor tool tables

CREATE TABLE public.email_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  email         TEXT NOT NULL,
  imap_host     TEXT NOT NULL,
  imap_port     INTEGER NOT NULL DEFAULT 993,
  imap_tls      BOOLEAN NOT NULL DEFAULT true,
  credentials_enc TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.extraction_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending',
  folders          TEXT[],
  max_messages     INTEGER NOT NULL DEFAULT 1000,
  batch_size       INTEGER NOT NULL DEFAULT 50,
  extract_emails   BOOLEAN NOT NULL DEFAULT true,
  extract_phones   BOOLEAN NOT NULL DEFAULT true,
  messages_scanned INTEGER NOT NULL DEFAULT 0,
  emails_found     INTEGER NOT NULL DEFAULT 0,
  phones_found     INTEGER NOT NULL DEFAULT 0,
  scan_cursor      JSONB NOT NULL DEFAULT '{}',
  error            TEXT,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.extracted_contacts (
  id             BIGSERIAL PRIMARY KEY,
  job_id         UUID NOT NULL REFERENCES public.extraction_jobs(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  value          TEXT NOT NULL,
  source_folder  TEXT,
  source_subject TEXT,
  source_from    TEXT,
  source_date    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, type, value)
);

CREATE INDEX idx_extracted_contacts_job  ON public.extracted_contacts(job_id);
CREATE INDEX idx_extracted_contacts_user ON public.extracted_contacts(user_id, type);
CREATE INDEX idx_extraction_jobs_user    ON public.extraction_jobs(user_id, created_at DESC);
CREATE INDEX idx_email_accounts_user     ON public.email_accounts(user_id);

ALTER TABLE public.email_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_accounts: own rows" ON public.email_accounts
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "extraction_jobs: own rows" ON public.extraction_jobs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "extracted_contacts: own rows" ON public.extracted_contacts
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.tools (slug, name, description, category, is_active, is_pro)
VALUES (
  'email-extractor',
  'Email Extractor',
  'Connect to your inbox via IMAP and extract email addresses and phone numbers',
  'productivity',
  true,
  false
) ON CONFLICT (slug) DO NOTHING;
