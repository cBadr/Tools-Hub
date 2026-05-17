"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { createClientSupabase } from "@/lib/supabase/client";

export interface GlobalTelegramConfig {
  botToken: string;
  chatId: string;
}

const SLUG = "_telegram";

export function useTelegramConfig() {
  const supabase = createClientSupabase();

  const { data, mutate, isLoading } = useSWR<GlobalTelegramConfig | null>(
    "telegram_global_config",
    async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("tool_configs")
        .select("config")
        .eq("tool_slug", SLUG)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return null;
      return (data.config as unknown as GlobalTelegramConfig) ?? null;
    }
  );

  const saveConfig = useCallback(async (cfg: GlobalTelegramConfig) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tool_configs").upsert(
      { user_id: user.id, tool_slug: SLUG, config: cfg as any, updated_at: new Date().toISOString() },
      { onConflict: "user_id,tool_slug" }
    );
    await mutate();
  }, [supabase, mutate]);

  return { config: data ?? { botToken: "", chatId: "" }, saveConfig, isLoading, mutate };
}
