import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { scanBatch } from "@/tools/email-extractor/lib/imap";
import { sendExtractionReport } from "@/tools/email-extractor/lib/report";
import { refreshGoogleToken, refreshMicrosoftToken } from "@/tools/email-extractor/lib/oauth";
import { encrypt, decrypt } from "@/tools/email-extractor/lib/crypto";
import type { ScanCursor } from "@/types/email-extractor-tool";
import type { TelegramConfig } from "@/types/email-tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = (await request.json()) as { jobId: string };

  // Load job + account
  const { data: jobRaw } = await supabase
    .from("extraction_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (!jobRaw) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const job = jobRaw;

  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return NextResponse.json({ done: true, status: job.status });
  }

  const { data: accountRaw } = await supabase
    .from("email_accounts")
    .select("email, imap_host, imap_port, imap_tls, credentials_enc, oauth_provider, oauth_access_token_enc, oauth_refresh_token_enc, oauth_expires_at")
    .eq("id", job.account_id)
    .single();

  if (!accountRaw) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const account = accountRaw;

  // For OAuth accounts, refresh access token if it expires within 5 minutes
  let accessTokenEnc = account.oauth_access_token_enc;
  if (account.oauth_provider && account.oauth_refresh_token_enc) {
    const expiresAt = account.oauth_expires_at ? new Date(account.oauth_expires_at) : new Date(0);
    const needsRefresh = expiresAt.getTime() < Date.now() + 5 * 60 * 1000;
    if (needsRefresh) {
      try {
        const refreshToken = decrypt(account.oauth_refresh_token_enc);
        const refreshed = account.oauth_provider === "gmail"
          ? await refreshGoogleToken(refreshToken)
          : await refreshMicrosoftToken(refreshToken);
        accessTokenEnc = encrypt(refreshed.accessToken);
        await supabase.from("email_accounts").update({
          oauth_access_token_enc: accessTokenEnc,
          oauth_expires_at: refreshed.expiresAt.toISOString(),
        }).eq("id", job.account_id);
      } catch (err) {
        await supabase.from("extraction_jobs").update({
          status: "failed",
          error: `Token refresh failed: ${String(err).slice(0, 200)}`,
          completed_at: new Date().toISOString(),
        }).eq("id", jobId);
        return NextResponse.json({ done: true, status: "failed", error: "Token refresh failed" });
      }
    }
  }

  const creds = {
    email: account.email,
    host: account.imap_host,
    port: account.imap_port,
    tls: account.imap_tls,
    credentialsEnc: account.credentials_enc,
    accessTokenEnc,
  };

  const cursor = (job.scan_cursor as unknown as ScanCursor) ?? { folderIndex: 0, seqFrom: 1 };
  const allFolders = job.folders ?? ["INBOX"];

  // Check limits
  if (job.messages_scanned >= job.max_messages) {
    await finishJob(jobId, user.id, job, supabase);
    return NextResponse.json({ done: true, status: "completed" });
  }

  if (cursor.folderIndex >= allFolders.length) {
    await finishJob(jobId, user.id, job, supabase);
    return NextResponse.json({ done: true, status: "completed" });
  }

  const folder = allFolders[cursor.folderIndex];
  const remaining = job.max_messages - job.messages_scanned;
  const batchSize = Math.min(job.batch_size, remaining);

  let result;
  try {
    result = await scanBatch(
      creds,
      folder,
      cursor.seqFrom,
      batchSize,
      job.extract_emails,
      job.extract_phones,
    );
  } catch (err) {
    await supabase.from("extraction_jobs").update({
      status: "failed",
      error: String(err).slice(0, 500),
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
    return NextResponse.json({ done: true, status: "failed", error: String(err) });
  }

  // Deduplicate + insert contacts (ignore conflicts)
  if (result.contacts.length > 0) {
    const svcSupa = createServiceSupabase();
    const rows = result.contacts.map((c) => ({
      job_id: jobId,
      user_id: user.id,
      type: c.type,
      value: c.value,
      source_folder: c.sourceFolder,
      source_subject: c.sourceSubject?.slice(0, 200) ?? null,
      source_from: c.sourceFrom,
      source_date: c.sourceDate,
    }));
    await svcSupa.from("extracted_contacts").upsert(rows, { onConflict: "job_id,type,value", ignoreDuplicates: true });
  }

  const newEmails = result.contacts.filter((c) => c.type === "email").length;
  const newPhones = result.contacts.filter((c) => c.type === "phone").length;

  // Advance cursor
  let newCursor: ScanCursor;
  if (!result.hasMore) {
    newCursor = { folderIndex: cursor.folderIndex + 1, seqFrom: 1 };
  } else {
    newCursor = { folderIndex: cursor.folderIndex, seqFrom: cursor.seqFrom + result.processedCount };
  }

  const newScanned   = job.messages_scanned + result.processedCount;
  const newEmailsTotal = job.emails_found + newEmails;
  const newPhonesTotal = job.phones_found + newPhones;

  const isLastFolder = newCursor.folderIndex >= allFolders.length;
  const hitLimit     = newScanned >= job.max_messages;
  const isDone       = isLastFolder || hitLimit;

  await supabase.from("extraction_jobs").update({
    messages_scanned: newScanned,
    emails_found: newEmailsTotal,
    phones_found: newPhonesTotal,
    scan_cursor: newCursor as any,
    ...(isDone ? { status: "completed", completed_at: new Date().toISOString() } : {}),
  }).eq("id", jobId);

  if (isDone) {
    // Send Telegram report (fire and forget)
    sendTelegramReport({ userId: user.id, accountEmail: account.email ?? "", job: { ...job, messages_scanned: newScanned, emails_found: newEmailsTotal, phones_found: newPhonesTotal } });
  }

  return NextResponse.json({
    done: isDone,
    status: isDone ? "completed" : "running",
    processedCount: result.processedCount,
    newEmails,
    newPhones,
    totalScanned: newScanned,
    totalEmails: newEmailsTotal,
    totalPhones: newPhonesTotal,
    currentFolder: folder,
    folderProgress: `${cursor.folderIndex + 1}/${allFolders.length}`,
  });
}

async function finishJob(jobId: string, userId: string, job: any, supabase: any) {
  await supabase.from("extraction_jobs").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", jobId);

  const { data: acc } = await supabase.from("email_accounts").select("email").eq("id", job.account_id).single();
  sendTelegramReport({ userId, accountEmail: acc?.email ?? "", job });
}

async function sendTelegramReport({ userId, accountEmail, job }: { userId: string; accountEmail: string; job: any }) {
  const svcSupa = createServiceSupabase();
  const { data: toolConfig } = await svcSupa
    .from("tool_configs")
    .select("config")
    .eq("user_id", userId)
    .eq("tool_slug", "email-extractor")
    .single();

  if (!toolConfig) return;
  const cfg = toolConfig.config as unknown as TelegramConfig;
  if (!cfg.notificationsEnabled || !cfg.telegramBotToken || !cfg.telegramChatId) return;

  const { data: topEmails } = await svcSupa
    .from("extracted_contacts")
    .select("value")
    .eq("job_id", job.id)
    .eq("type", "email")
    .limit(5);

  const { data: topPhones } = await svcSupa
    .from("extracted_contacts")
    .select("value")
    .eq("job_id", job.id)
    .eq("type", "phone")
    .limit(5);

  const startedAt = job.started_at ? new Date(job.started_at).getTime() : Date.now();
  const durationMs = Date.now() - startedAt;

  await sendExtractionReport({
    botToken: cfg.telegramBotToken,
    chatId: cfg.telegramChatId,
    accountEmail,
    messagesScanned: job.messages_scanned,
    emailsFound: job.emails_found,
    phonesFound: job.phones_found,
    durationMs,
    topEmails: (topEmails ?? []).map((r: any) => r.value),
    topPhones: (topPhones ?? []).map((r: any) => r.value),
    error: job.error,
  });
}
