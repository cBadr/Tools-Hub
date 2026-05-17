import type { EmailAccount } from "./types";
import { decrypt, encrypt } from "@/tools/email-extractor/lib/crypto";
import { refreshGoogleToken } from "@/tools/email-extractor/lib/oauth";
import { createServerSupabase } from "@/lib/supabase/server";

export interface SendOptions {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  inReplyTo?: string;
  references?: string;
  unsubscribeUrl?: string;
}

export async function sendViaGmail(
  account: EmailAccount,
  opts: SendOptions,
): Promise<{ messageId: string }> {
  let accessToken = account.oauth_access_token_enc ? decrypt(account.oauth_access_token_enc) : "";
  const expiresAt = account.oauth_expires_at ? new Date(account.oauth_expires_at) : new Date(0);

  if (!accessToken || expiresAt <= new Date()) {
    if (!account.oauth_refresh_token_enc) throw new Error("No refresh token for Gmail account");
    const refreshed = await refreshGoogleToken(decrypt(account.oauth_refresh_token_enc));
    accessToken = refreshed.accessToken;
    const supabase = await createServerSupabase();
    await (supabase.from("email_accounts") as unknown as ReturnType<typeof supabase.from>)
      .update({ oauth_access_token_enc: encrypt(accessToken), oauth_expires_at: refreshed.expiresAt.toISOString() })
      .eq("id", account.id);
  }

  const msgId = `<${crypto.randomUUID()}@toolshub.app>`;
  const from  = account.label ? `${account.label} <${account.email}>` : account.email;
  const lines: string[] = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Message-ID: ${msgId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
  ];

  if (opts.inReplyTo)      lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references)     lines.push(`References: ${opts.references}`);
  if (opts.unsubscribeUrl) lines.push(`List-Unsubscribe: <${opts.unsubscribeUrl}>`);

  if (opts.bodyText && opts.bodyHtml) {
    const boundary = `----=_Part_${Date.now()}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`, "");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/plain; charset=UTF-8`, "Content-Transfer-Encoding: 8bit", "");
    lines.push(opts.bodyText, "");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/html; charset=UTF-8`, "Content-Transfer-Encoding: 8bit", "");
    lines.push(opts.bodyHtml, "");
    lines.push(`--${boundary}--`);
  } else {
    lines.push(`Content-Type: text/html; charset=UTF-8`, "Content-Transfer-Encoding: 8bit", "");
    lines.push(opts.bodyHtml);
  }

  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Gmail API ${res.status}`);
  }

  return { messageId: msgId };
}
