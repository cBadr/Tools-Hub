import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { optimizeEmailHtml, type OptimizeOptions } from "@/tools/mass-sender/lib/html-optimizer";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { html: string; options: OptimizeOptions };
  const { html, plainText } = await optimizeEmailHtml(body.html, body.options);
  return NextResponse.json({ html, plainText });
}
