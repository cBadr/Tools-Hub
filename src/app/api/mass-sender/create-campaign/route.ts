import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { assignAccountsToRecipients } from "@/tools/mass-sender/lib/relationship-scorer";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Type-cast helper for tables not yet in the generated schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (sb: SupabaseClient, table: string) => (sb as any).from(table);

interface RecipientInput {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
}

interface CreateBody {
  name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  mode: "new" | "reply";
  thread_search_folder?: string;
  thread_custom_folder?: string;
  add_re_prefix?: boolean;
  use_proxy?: boolean;
  rate_limit_per_hour?: number;
  recipients: RecipientInput[];
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as CreateBody;

  if (!body.recipients || body.recipients.length === 0) {
    return NextResponse.json({ error: "No recipients provided" }, { status: 400 });
  }

  const { data: campaign, error: campErr } = await db(supabase, "mass_campaigns")
    .insert({
      user_id:              user.id,
      name:                 body.name,
      subject:              body.subject,
      body_html:            body.body_html,
      body_text:            body.body_text ?? null,
      mode:                 body.mode ?? "new",
      thread_search_folder: body.thread_search_folder ?? "all",
      thread_custom_folder: body.thread_custom_folder ?? null,
      add_re_prefix:        body.add_re_prefix ?? false,
      use_proxy:            body.use_proxy ?? false,
      rate_limit_per_hour:  body.rate_limit_per_hour ?? 20,
      total_recipients:     body.recipients.length,
      status:               "draft",
    })
    .select("id")
    .single();

  if (campErr || !campaign) {
    return NextResponse.json({ error: campErr?.message ?? "Failed to create campaign" }, { status: 500 });
  }

  // Fetch connected accounts for scoring
  const { data: accounts } = await supabase
    .from("email_accounts")
    .select("id, email")
    .eq("user_id", user.id);

  const accountIds = (accounts ?? []).map((a) => a.id as string);
  const emails     = body.recipients.map((r) => r.email);
  const assignments = await assignAccountsToRecipients(supabase, user.id, emails, accountIds);

  // Insert recipients in batches of 500
  const BATCH = 500;
  for (let i = 0; i < body.recipients.length; i += BATCH) {
    const slice = body.recipients.slice(i, i + BATCH);
    const rows  = slice.map((r) => ({
      campaign_id:         campaign.id as string,
      email:               r.email,
      first_name:          r.first_name ?? null,
      last_name:           r.last_name  ?? null,
      company:             r.company    ?? null,
      assigned_account_id: assignments.get(r.email) ?? null,
      status:              "pending",
    }));

    const { error } = await db(supabase, "mass_recipients").insert(rows);
    if (error) {
      await db(supabase, "mass_campaigns").delete().eq("id", campaign.id as string);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ campaignId: campaign.id as string });
}
