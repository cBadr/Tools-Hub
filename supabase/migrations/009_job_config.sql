-- Add job_config JSONB column to extraction_jobs for scan sources + quality settings
ALTER TABLE public.extraction_jobs
  ADD COLUMN IF NOT EXISTS job_config JSONB NOT NULL DEFAULT '{}';
