CREATE TABLE IF NOT EXISTS public.proxies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'http',   -- http | https | socks4 | socks5
  host            TEXT NOT NULL,
  port            INTEGER NOT NULL,
  username        TEXT,
  password        TEXT,

  -- Check results
  status          TEXT NOT NULL DEFAULT 'unchecked', -- unchecked | live | dead
  latency_ms      INTEGER,
  jitter_ms       INTEGER,

  -- Geo / anonymity
  country         TEXT,
  country_code    TEXT,
  city            TEXT,
  isp             TEXT,
  anonymity       TEXT,   -- elite | anonymous | transparent | unknown

  last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, host, port, type)
);

CREATE INDEX IF NOT EXISTS idx_proxies_user   ON public.proxies(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proxies_status ON public.proxies(user_id, status);

ALTER TABLE public.proxies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own proxies"
  ON public.proxies FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

INSERT INTO public.tools (slug, name, description, category, is_active, is_pro)
VALUES ('proxy-checker', 'Proxy Checker', 'Fetch, validate, and manage HTTP/SOCKS proxies', 'developer', true, false)
ON CONFLICT (slug) DO NOTHING;
