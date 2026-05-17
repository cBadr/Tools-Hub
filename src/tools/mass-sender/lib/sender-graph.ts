import type { EmailAccount } from "./types";
import { decrypt, encrypt } from "@/tools/email-extractor/lib/crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SendOptions } from "./sender-gmail";

async function getGraphToken(account: EmailAccount): Promise<string> {
  let accessToken = account.oauth_access_token_enc ? decrypt(account.oauth_access_token_enc) : "";
  const expiresAt = account.oauth_expires_at ? new Date(account.oauth_expires_at) : new Date(0);

  if (!accessToken || expiresAt <= new Date()) {
    if (!account.oauth_refresh_token_enc) throw new Error("No refresh token for Outlook account");
    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        client_id:     process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: decrypt(account.oauth_refresh_token_enc),
        grant_type:    "refresh_token",
        scope:         "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite offline_access",
      }),
    });
    const data = await res.json() as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
    if (!data.access_token) {
      throw new Error(data.error_description ?? data.error ?? "Failed to refresh Outlook token");
    }
    accessToken = data.access_token;
    const supabase = await createServerSupabase();
    await (supabase.from("email_accounts") as unknown as ReturnType<typeof supabase.from>)
      .update({
        oauth_access_token_enc: encrypt(accessToken),
        oauth_expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
      })
      .eq("id", account.id);
  }

  return accessToken;
}

export async function sendViaGraph(
  account: EmailAccount,
  opts: SendOptions,
): Promise<{ messageId: string }> {
  const accessToken = await getGraphToken(account);

  const body: Record<string, unknown> = {
    message: {
      subject: opts.subject,
      body: { contentType: "HTML", content: opts.bodyHtml },
      toRecipients: [{ emailAddress: { address: opts.to } }],
      ...(opts.inReplyTo ? {
        singleValueExtendedProperties: [
          { id: "String 0x1042", value: opts.inReplyTo },
        ],
      } : {}),
      ...(opts.unsubscribeUrl ? {
        internetMessageHeaders: [
          { name: "List-Unsubscribe", value: `<${opts.unsubscribeUrl}>` },
        ],
      } : {}),
    },
    saveToSentItems: true,
  };

  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Graph API ${res.status}`);
  }

  return { messageId: `<${crypto.randomUUID()}@toolshub.app>` };
}
