-- Fix: proxies.user_id should reference auth.users, not public.profiles.
-- This prevents FK violations for users who don't yet have a profile row.
ALTER TABLE public.proxies
  DROP CONSTRAINT proxies_user_id_fkey;

ALTER TABLE public.proxies
  ADD CONSTRAINT proxies_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
