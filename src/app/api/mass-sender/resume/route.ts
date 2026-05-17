import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (sb: SupabaseClient, table: string) => (sb as any).from(table);

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await request.json() as { campaignId: string };

  const { error } = await db(supabase, "mass_campaigns")
    .update({ status: "running" })
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .eq("status", "paused");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
