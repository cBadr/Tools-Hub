"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { createClientSupabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type ToolConfigRow = Database["public"]["Tables"]["tool_configs"]["Row"];

export function useToolConfig(toolSlug: string, defaultConfig: Record<string, unknown> = {}) {
  const supabase = createClientSupabase();

  const { data, mutate, isLoading } = useSWR<Pick<ToolConfigRow, "config" | "is_pinned"> | null>(
    ["tool_config", toolSlug],
    async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("tool_configs")
        .select("config, is_pinned")
        .eq("tool_slug", toolSlug)
        .eq("user_id", user.id)
        .maybeSingle();

      return data;
    }
  );

  const saveConfig = useCallback(
    async (newConfig: Record<string, unknown>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("tool_configs").upsert(
        {
          user_id: user.id,
          tool_slug: toolSlug,
          config: newConfig as import("@/types/database").Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tool_slug" }
      );

      await mutate();
    },
    [supabase, toolSlug, mutate]
  );

  const config = (data?.config as Record<string, unknown>) ?? defaultConfig;
  const isPinned = data?.is_pinned ?? false;

  return { config, saveConfig, isPinned, isLoading, mutate };
}
