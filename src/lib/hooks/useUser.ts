"use client";

import useSWR from "swr";
import { createClientSupabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useUser() {
  const supabase = createClientSupabase();

  const { data, error, isLoading } = useSWR<Profile | null>("user", async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return profile ?? null;
  });

  return { user: data ?? null, error, isLoading };
}
