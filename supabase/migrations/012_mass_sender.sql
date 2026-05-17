-- Mass Sender: campaigns + recipients

CREATE TABLE IF NOT EXISTS public.mass_campaigns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  subject              TEXT NOT NULL DEFAULT '',
  body_html            TEXT NOT NULL DEFAULT '',
  body_text            TEXT,
  status               TEXT NOT NULL DEFAULT 'draft',  -- draft|running|paused|completed|cancelled
  mode                 TEXT NOT NULL DEFAULT 'new',    -- new|reply
  thread_search_folder TEXT NOT NULL DEFAULT 'all',   -- all|INBOX|SENT|custom
  thread_custom_folder TEXT,
  add_re_prefix        BOOLEAN NOT NULL DEFAULT false,
  use_proxy            BOOLEAN NOT NULL DEFAULT false,
  rate_limit_per_hour  INTEGER NOT NULL DEFAULT 20,
  total_recipients     INTEGER NOT NULL DEFAULT 0,
  sent_count           INTEGER NOT NULL DEFAULT 0,
  failed_count         INTEGER NOT NULL DEFAULT 0,
  skipped_count        INTEGER NOT NULL DEFAULT 0,
  scheduled_at         TIMESTAMPTZ,
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mass_recipients (
  id                   BIGSERIAL PRIMARY KEY,
  campaign_id          UUID NOT NULL REFERENCES public.mass_campaigns(id) ON DELETE CASCADE,
  email                TEXT NOT NULL,
  first_name           TEXT,
  last_name            TEXT,
  company              TEXT,
  assigned_account_id  UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  thread_message_id    TEXT,
  thread_subject       TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',  -- pending|sent|failed|skipped
  error_message        TEXT,
  sent_at              TIMESTAMPTZ,
  message_id           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mass_campaigns_user        ON public.mass_campaigns(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mass_recipients_campaign   ON public.mass_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_mass_recipients_email      ON public.mass_recipients(email);

ALTER TABLE public.mass_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mass_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their mass campaigns"
  ON public.mass_campaigns FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users own their mass recipients"
  ON public.mass_recipients FOR ALL
  USING (campaign_id IN (SELECT id FROM public.mass_campaigns WHERE user_id = auth.uid()));

INSERT INTO public.tools (slug, name, description, category, is_active, is_pro)
VALUES ('mass-sender', 'Mass Sender', 'Send personalised emails at scale using your connected accounts', 'marketing', true, false)
ON CONFLICT (slug) DO NOTHING;
