-- Email tracker tables

CREATE TABLE public.email_campaigns (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  tracking_id    TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  open_count     INTEGER NOT NULL DEFAULT 0,
  unique_opens   INTEGER NOT NULL DEFAULT 0,
  last_opened_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comprehensive log: every pixel load = one row, nothing discarded
CREATE TABLE public.email_open_events (
  id               BIGSERIAL PRIMARY KEY,
  campaign_id      UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,

  -- Network
  ip_address       TEXT,
  ip_is_proxy      BOOLEAN,
  ip_is_vpn        BOOLEAN,

  -- Geo (from ip-api.com)
  country          TEXT,
  country_code     TEXT,
  region           TEXT,
  city             TEXT,
  zip              TEXT,
  latitude         NUMERIC(9,6),
  longitude        NUMERIC(9,6),
  timezone         TEXT,
  isp              TEXT,
  org              TEXT,
  as_number        TEXT,

  -- Device (from ua-parser-js)
  browser          TEXT,
  browser_version  TEXT,
  browser_major    TEXT,
  engine           TEXT,
  os               TEXT,
  os_version       TEXT,
  device_type      TEXT,
  device_vendor    TEXT,
  device_model     TEXT,
  cpu_arch         TEXT,

  -- Raw headers
  user_agent       TEXT,
  accept_language  TEXT,
  referer          TEXT,

  -- Raw API responses for future re-analysis
  raw_geo          JSONB,
  raw_ua           JSONB,

  -- Telegram notification status
  telegram_sent    BOOLEAN NOT NULL DEFAULT false,
  telegram_error   TEXT,

  opened_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_open_events_campaign  ON public.email_open_events(campaign_id, opened_at DESC);
CREATE INDEX idx_open_events_ip        ON public.email_open_events(ip_address);
CREATE INDEX idx_campaigns_user        ON public.email_campaigns(user_id, created_at DESC);
CREATE INDEX idx_campaigns_tracking_id ON public.email_campaigns(tracking_id);
