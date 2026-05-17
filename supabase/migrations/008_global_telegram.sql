-- Add system entry for global Telegram config (stored in tool_configs)
INSERT INTO public.tools (slug, name, description, category, is_active, is_pro)
VALUES ('_telegram', 'Telegram', 'Global Telegram notification config', 'system', false, false)
ON CONFLICT (slug) DO NOTHING;
