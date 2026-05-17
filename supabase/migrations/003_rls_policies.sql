-- Row Level Security policies

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_open_events ENABLE ROW LEVEL SECURITY;

-- Profiles: users access only their own row
CREATE POLICY "profiles: own row" ON public.profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Tools: public read-only (feature flags visible to all)
CREATE POLICY "tools: public read" ON public.tools
  FOR SELECT USING (true);

-- Tool configs: per-user isolation
CREATE POLICY "tool_configs: own rows" ON public.tool_configs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User preferences: per-user
CREATE POLICY "user_preferences: own row" ON public.user_preferences
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Email campaigns: per-user
CREATE POLICY "email_campaigns: own rows" ON public.email_campaigns
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Email open events: campaign owner can read; service role inserts via pixel endpoint
CREATE POLICY "email_open_events: campaign owner read" ON public.email_open_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_campaigns
      WHERE id = email_open_events.campaign_id
        AND user_id = auth.uid()
    )
  );

-- Service role bypass (used by pixel API route with SUPABASE_SERVICE_ROLE_KEY)
-- The service role bypasses RLS by default in Supabase — no extra policy needed.
