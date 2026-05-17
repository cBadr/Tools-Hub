-- Add role column to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('admin', 'user'));

-- Update RLS: admin can read all profiles, user only their own
DROP POLICY IF EXISTS "profiles: own row" ON public.profiles;

CREATE POLICY "profiles: own row" ON public.profiles
  USING (auth.uid() = id OR role = 'admin')
  WITH CHECK (auth.uid() = id);
