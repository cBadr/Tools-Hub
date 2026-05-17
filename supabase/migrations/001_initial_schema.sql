-- Core application schema

CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tools (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  is_pro      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tool_configs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tool_slug  TEXT NOT NULL REFERENCES public.tools(slug) ON DELETE CASCADE,
  config     JSONB NOT NULL DEFAULT '{}',
  is_pinned  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tool_slug)
);

CREATE TABLE public.user_preferences (
  id             UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme          TEXT NOT NULL DEFAULT 'dark',
  accent_color   TEXT NOT NULL DEFAULT 'violet',
  sidebar_state  TEXT NOT NULL DEFAULT 'expanded',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the tools table with v1 tools
INSERT INTO public.tools (slug, name, description, category) VALUES
  ('email-tracker', 'Email Tracker', 'Track email opens with detailed analytics and Telegram notifications', 'marketing');

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  INSERT INTO public.user_preferences (id) VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
