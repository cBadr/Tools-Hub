import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailAccount, LiveProxy, MassCampaign, MassRecipient } from "@/tools/mass-sender/lib/types";
import { sendViaGmail }      from "@/tools/mass-sender/lib/sender-gmail";
import { sendViaGraph }      from "@/tools/mass-sender/lib/sender-graph";
import { sendViaSmtp }       from "@/tools/mass-sender/lib/sender-smtp";
import { findThread }        from "@/tools/mass-sender/lib/thread-finder";
import { optimizeEmailHtml } from "@/tools/mass-sender/lib/html-optimizer";

export const dynamic   = "force-dynamic";
export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (sb: SupabaseClient, table: string) => (sb as any).from(table);

function personalize(text: string, r: MassRecipient): string {
  return text
    .replace(/\{\{firstName\}\}/gi, r.first_name ?? "")
    .replace(/\{\{lastName\}\}/gi,  r.last_name  ?? "")
    .replace(/\{\{company\}\}/gi,   r.company    ?? "")
    .replace(/\{\{email\}\}/gi,     r.email);
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { campaignId: string; batchSize?: number };
  const batchSize = Math.min(Math.max(body.batchSize ?? 5, 1), 10);

  // Fetch campaign
  const { data: campaign } = await db(supabase, "mass_campaigns")
    .select("*")
    .eq("id", body.campaignId)
    .eq("user_id", user.id)
    .single() as { data: MassCampaign | null };

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status === "cancelled" || campaign.status === "completed") {
    return NextResponse.json({ sent: 0, failed: 0, remaining: 0 });
  }
  if (campaign.status === "paused") {
    return NextResponse.json({ sent: 0, failed: 0, remaining: -1, paused: true });
  }

  if (campaign.status === "draft") {
    await db(supabase, "mass_campaigns")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", campaign.id);
  }

  // Fetch pending recipients
  const { data: recipients } = await db(supabase, "mass_recipients")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .order("id", { ascending: true })
    .limit(batchSize) as { data: MassRecipient[] | null };

  if (!recipients || recipients.length === 0) {
    await db(supabase, "mass_campaigns")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", campaign.id);
    return NextResponse.json({ sent: 0, failed: 0, remaining: 0 });
  }

  const { count: remaining } = await db(supabase, "mass_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .eq("status", "pending") as { count: number | null };

  // Fetch accounts
  const accountIds = [...new Set(
    recipients.map((r) => r.assigned_account_id).filter((id): id is string => !!id)
  )];
  const { data: accountRows } = await supabase
    .from("email_accounts")
    .select("*")
    .in("id", accountIds);
  const accountMap = new Map<string, EmailAccount>(
    (accountRows ?? []).map((a) => [a.id as string, a as unknown as EmailAccount])
  );

  // Fetch live proxy if needed
  let proxy: LiveProxy | undefined;
  if (campaign.use_proxy) {
    const { data: proxyRow } = await supabase
      .from("proxies")
      .select("id, type, host, port, username, password")
      .eq("user_id", user.id)
      .eq("status", "live")
      .order("latency_ms", { ascending: true })
      .limit(1)
      .single();
    if (proxyRow) proxy = proxyRow as LiveProxy;
  }

  let sent = 0, failed = 0;

  for (const recipient of recipients) {
    const account = recipient.assigned_account_id ? accountMap.get(recipient.assigned_account_id) : undefined;
    if (!account) {
      await db(supabase, "mass_recipients")
        .update({ status: "failed", error_message: "No account assigned" })
        .eq("id", recipient.id);
      failed++;
      continue;
    }

    try {
      let subject  = personalize(campaign.subject, recipient);
      let bodyHtml = personalize(campaign.body_html, recipient);
      const bodyText = campaign.body_text ? personalize(campaign.body_text, recipient) : undefined;

      let inReplyTo: string | undefined;
      let references: string | undefined;

      if (campaign.mode === "reply") {
        const folder = campaign.thread_search_folder === "custom"
          ? (campaign.thread_custom_folder ?? "INBOX")
          : campaign.thread_search_folder;

        const thread = await findThread(account, recipient.email, folder).catch(() => null);
        if (thread) {
          inReplyTo  = thread.messageId;
          references = thread.messageId;
          if (campaign.add_re_prefix && !subject.startsWith("Re:")) {
            subject = `Re: ${thread.subject || subject}`;
          }
          await db(supabase, "mass_recipients")
            .update({ thread_message_id: thread.messageId, thread_subject: thread.subject })
            .eq("id", recipient.id);
        }
      }

      const { html: optimizedHtml } = await optimizeEmailHtml(bodyHtml, { inlineCss: true });
      bodyHtml = optimizedHtml;

      const sendOpts = { to: recipient.email, subject, bodyHtml, bodyText, inReplyTo, references };

      let msgId: string;
      if (account.oauth_provider === "google") {
        ({ messageId: msgId } = await sendViaGmail(account, sendOpts));
      } else if (account.oauth_provider === "microsoft") {
        ({ messageId: msgId } = await sendViaGraph(account, sendOpts));
      } else {
        ({ messageId: msgId } = await sendViaSmtp(account, sendOpts, proxy));
      }

      await db(supabase, "mass_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString(), message_id: msgId })
        .eq("id", recipient.id);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db(supabase, "mass_recipients")
        .update({ status: "failed", error_message: msg })
        .eq("id", recipient.id);
      failed++;
    }
  }

  await db(supabase, "mass_campaigns")
    .update({
      sent_count:   (campaign.sent_count   ?? 0) + sent,
      failed_count: (campaign.failed_count ?? 0) + failed,
    })
    .eq("id", campaign.id);

  const newRemaining = Math.max((remaining ?? 0) - recipients.length, 0);
  return NextResponse.json({ sent, failed, remaining: newRemaining });
}
