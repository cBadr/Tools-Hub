-- Add recipient_email to email_open_events for per-recipient tracking
ALTER TABLE public.email_open_events
  ADD COLUMN IF NOT EXISTS recipient_email TEXT;
