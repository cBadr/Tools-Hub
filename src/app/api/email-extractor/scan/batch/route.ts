import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { scanBatch } from "@/tools/email-extractor/lib/imap";
import { sendExtractionReport } from "@/tools/email-extractor/lib/report";
import { refreshGoogleToken, refreshMicrosoftToken, refreshMicrosoftGraphToken } from "@/tools/email-extractor/lib/oauth";
import { encrypt, decrypt } from "@/tools/email-extractor/lib/crypto";
import { extractGoogleContacts } from "@/tools/email-extractor/lib/sources/google-contacts";
import { extractGoogleCalendar } from "@/tools/email-extractor/lib/sources/google-calendar";
import { extractMicrosoftContacts } from "@/tools/email-extractor/lib/sources/microsoft-contacts";
import { extractMicrosoftCalendar } from "@/tools/email-extractor/lib/sources/microsoft-calendar";
import type { ScanCursor, JobConfig, ScanPhase } from "@/types/email-extractor-tool";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function nextPhase(current: ScanPhase, sources: ScanPhase[]): ScanPhase | null {
  const order: ScanPhase[] = ["imap", "contacts", "calendar"];
  const idx = order.indexOf(current);
  for (let i = idx + 1; i < order.length; i++) {
    if (sources.includes(order[i])) return order[i];
  }
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = (await request.json()) as { jobId: string };

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

  const jobConfig = (job.job_config ?? {}) as unknown as JobConfig;
  const sources: ScanPhase[] = jobConfig.sources?.length ? jobConfig.sources : ["imap"];
  const validateSyntax = jobConfig.validateSyntax ?? false;
  const deduplicateGlobally = jobConfig.deduplicateGlobally ?? false;

  const cursor = (job.scan_cursor as unknown as ScanCursor) ?? { phase: "imap" as ScanPhase, folderIndex: 0, seqFrom: 1 };
  // Back-compat: if old cursor lacks phase, default to imap
  if (!cursor.phase) cursor.phase = "imap";

  const isUnlimited = job.max_messages === 0;
  const allFolders = job.folders ?? ["INBOX"];

  // ── IMAP phase ────────────────────────────────────────────────────────────
  if (cursor.phase === "imap") {
    // Token refresh for OAuth
    let accessTokenEnc = account.oauth_access_token_enc;
    if (account.oauth_provider && account.oauth_refresh_token_enc) {
      const expiresAt = account.oauth_expires_at ? new Date(account.oauth_expires_at) : new Date(0);
      if (expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
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

    // Check message limit
    if (!isUnlimited && job.messages_scanned >= job.max_messages) {
      const np = nextPhase("imap", sources);
      if (!np) {
        await finishJob(jobId, user.id, job, supabase);
        return NextResponse.json({ done: true, status: "completed" });
      }
      await supabase.from("extraction_jobs").update({
        scan_cursor: { phase: np, folderIndex: 0, seqFrom: 1 } as any,
      }).eq("id", jobId);
      return NextResponse.json({ done: false, status: "running", currentFolder: np, folderProgress: `phase:${np}` });
    }

    if (cursor.folderIndex >= allFolders.length) {
      const np = nextPhase("imap", sources);
      if (!np) {
        await finishJob(jobId, user.id, job, supabase);
        return NextResponse.json({ done: true, status: "completed" });
      }
      await supabase.from("extraction_jobs").update({
        scan_cursor: { phase: np, folderIndex: 0, seqFrom: 1 } as any,
      }).eq("id", jobId);
      return NextResponse.json({ done: false, status: "running", currentFolder: np, folderProgress: `phase:${np}`, totalScanned: job.messages_scanned, totalEmails: job.emails_found, totalPhones: job.phones_found });
    }

    const folder = allFolders[cursor.folderIndex];
    const remaining = isUnlimited ? job.batch_size : job.max_messages - job.messages_scanned;
    const batchSize = Math.min(job.batch_size, remaining);

    let result;
    try {
      result = await scanBatch(creds, folder, cursor.seqFrom, batchSize, job.extract_emails, job.extract_phones);
    } catch (err) {
      await supabase.from("extraction_jobs").update({
        status: "failed",
        error: String(err).slice(0, 500),
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      return NextResponse.json({ done: true, status: "failed", error: String(err) });
    }

    let contacts = result.contacts;
    if (validateSyntax) {
      const { isValidEmailSyntax, isValidPhoneSyntax } = await import("@/tools/email-extractor/lib/extract");
      contacts = contacts.filter((c) =>
        c.type === "email" ? isValidEmailSyntax(c.value) : isValidPhoneSyntax(c.value)
      );
    }

    await insertContacts(jobId, user.id, contacts, deduplicateGlobally);

    const newEmails = contacts.filter((c) => c.type === "email").length;
    const newPhones = contacts.filter((c) => c.type === "phone").length;
    const newScanned = job.messages_scanned + result.processedCount;
    const newEmailsTotal = job.emails_found + newEmails;
    const newPhonesTotal = job.phones_found + newPhones;

    let newCursor: ScanCursor;
    let isDone = false;

    if (!result.hasMore) {
      const nextFolder = cursor.folderIndex + 1;
      if (nextFolder >= allFolders.length) {
        const np = nextPhase("imap", sources);
        if (!np) {
          isDone = true;
          newCursor = { phase: "imap", folderIndex: nextFolder, seqFrom: 1 };
        } else {
          newCursor = { phase: np, folderIndex: 0, seqFrom: 1 };
        }
      } else {
        newCursor = { phase: "imap", folderIndex: nextFolder, seqFrom: 1 };
      }
    } else {
      const hitLimit = !isUnlimited && newScanned >= job.max_messages;
      if (hitLimit) {
        const np = nextPhase("imap", sources);
        if (!np) {
          isDone = true;
          newCursor = { phase: "imap", folderIndex: cursor.folderIndex, seqFrom: cursor.seqFrom + result.processedCount };
        } else {
          newCursor = { phase: np, folderIndex: 0, seqFrom: 1 };
        }
      } else {
        newCursor = { phase: "imap", folderIndex: cursor.folderIndex, seqFrom: cursor.seqFrom + result.processedCount };
      }
    }

    await supabase.from("extraction_jobs").update({
      messages_scanned: newScanned,
      emails_found: newEmailsTotal,
      phones_found: newPhonesTotal,
      scan_cursor: newCursor as any,
      ...(isDone ? { status: "completed", completed_at: new Date().toISOString() } : {}),
    }).eq("id", jobId);

    if (isDone) {
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

  // ── Contacts / Calendar phases ────────────────────────────────────────────
  if (cursor.phase === "contacts" || cursor.phase === "calendar") {
    if (!account.oauth_provider || !account.oauth_refresh_token_enc) {
      // Not an OAuth account — skip this phase
      const np = nextPhase(cursor.phase, sources);
      if (!np) {
        await finishJob(jobId, user.id, job, supabase);
        return NextResponse.json({ done: true, status: "completed" });
      }
      await supabase.from("extraction_jobs").update({
        scan_cursor: { phase: np, folderIndex: 0, seqFrom: 1 } as any,
      }).eq("id", jobId);
      return NextResponse.json({ done: false, status: "running", currentFolder: np, folderProgress: `phase:${np}`, totalScanned: job.messages_scanned, totalEmails: job.emails_found, totalPhones: job.phones_found });
    }

    // Get a Graph-scoped token for Microsoft, or reuse Google token
    let accessToken: string;
    try {
      const refreshToken = decrypt(account.oauth_refresh_token_enc);
      if (account.oauth_provider === "gmail") {
        const existing = account.oauth_access_token_enc ? decrypt(account.oauth_access_token_enc) : null;
        const expiresAt = account.oauth_expires_at ? new Date(account.oauth_expires_at) : new Date(0);
        if (existing && expiresAt.getTime() > Date.now() + 60 * 1000) {
          accessToken = existing;
        } else {
          const refreshed = await refreshGoogleToken(refreshToken);
          accessToken = refreshed.accessToken;
          const enc = encrypt(refreshed.accessToken);
          await supabase.from("email_accounts").update({
            oauth_access_token_enc: enc,
            oauth_expires_at: refreshed.expiresAt.toISOString(),
          }).eq("id", job.account_id);
        }
      } else {
        // Microsoft: get Graph-scoped token from refresh token
        const graphToken = await refreshMicrosoftGraphToken(refreshToken);
        accessToken = graphToken.accessToken;
      }
    } catch (err) {
      const np = nextPhase(cursor.phase, sources);
      if (!np) {
        await finishJob(jobId, user.id, job, supabase);
        return NextResponse.json({ done: true, status: "completed" });
      }
      await supabase.from("extraction_jobs").update({
        scan_cursor: { phase: np, folderIndex: 0, seqFrom: 1 } as any,
      }).eq("id", jobId);
      return NextResponse.json({ done: false, status: "running", currentFolder: np, folderProgress: `phase:${np}`, totalScanned: job.messages_scanned, totalEmails: job.emails_found, totalPhones: job.phones_found });
    }

    let sourceItems: Awaited<ReturnType<typeof extractGoogleContacts>>;
    try {
      if (cursor.phase === "contacts") {
        sourceItems = account.oauth_provider === "gmail"
          ? await extractGoogleContacts(accessToken)
          : await extractMicrosoftContacts(accessToken);
      } else {
        sourceItems = account.oauth_provider === "gmail"
          ? await extractGoogleCalendar(accessToken)
          : await extractMicrosoftCalendar(accessToken);
      }
    } catch {
      sourceItems = [] as Awaited<ReturnType<typeof extractGoogleContacts>>;
    }

    if (validateSyntax) {
      const { isValidEmailSyntax, isValidPhoneSyntax } = await import("@/tools/email-extractor/lib/extract");
      sourceItems = sourceItems.filter((c) =>
        c.type === "email" ? isValidEmailSyntax(c.value) : isValidPhoneSyntax(c.value)
      );
    }

    await insertContacts(jobId, user.id, sourceItems, deduplicateGlobally);

    const newEmails = sourceItems.filter((c) => c.type === "email").length;
    const newPhones = sourceItems.filter((c) => c.type === "phone").length;
    const newEmailsTotal = job.emails_found + newEmails;
    const newPhonesTotal = job.phones_found + newPhones;

    const np = nextPhase(cursor.phase, sources);
    const isDone = !np;

    await supabase.from("extraction_jobs").update({
      emails_found: newEmailsTotal,
      phones_found: newPhonesTotal,
      scan_cursor: (np ? { phase: np, folderIndex: 0, seqFrom: 1 } : { phase: cursor.phase, folderIndex: 0, seqFrom: 1 }) as any,
      ...(isDone ? { status: "completed", completed_at: new Date().toISOString() } : {}),
    }).eq("id", jobId);

    if (isDone) {
      sendTelegramReport({ userId: user.id, accountEmail: account.email ?? "", job: { ...job, emails_found: newEmailsTotal, phones_found: newPhonesTotal } });
    }

    return NextResponse.json({
      done: isDone,
      status: isDone ? "completed" : "running",
      newEmails,
      newPhones,
      totalScanned: job.messages_scanned,
      totalEmails: newEmailsTotal,
      totalPhones: newPhonesTotal,
      currentFolder: cursor.phase,
      folderProgress: `phase:${cursor.phase}`,
    });
  }

  // Fallback
  await finishJob(jobId, user.id, job, supabase);
  return NextResponse.json({ done: true, status: "completed" });
}

async function insertContacts(
  jobId: string,
  userId: string,
  contacts: { type: string; value: string; sourceFolder?: string; sourceSubject?: string; sourceFrom?: string; sourceDate?: string }[],
  deduplicateGlobally: boolean,
) {
  if (contacts.length === 0) return;
  const svcSupa = createServiceSupabase();

  let filtered = contacts;
  if (deduplicateGlobally) {
    const values = contacts.map((c) => c.value);
    const { data: existing } = await svcSupa
      .from("extracted_contacts")
      .select("value")
      .eq("user_id", userId)
      .in("value", values);
    const existingSet = new Set((existing ?? []).map((r: any) => r.value));
    filtered = contacts.filter((c) => !existingSet.has(c.value));
  }

  if (filtered.length === 0) return;
  const rows = filtered.map((c) => ({
    job_id: jobId,
    user_id: userId,
    type: c.type,
    value: c.value,
    source_folder: c.sourceFolder ?? null,
    source_subject: (c.sourceSubject ?? "").slice(0, 200) || null,
    source_from: c.sourceFrom ?? null,
    source_date: c.sourceDate ?? null,
  }));
  await svcSupa.from("extracted_contacts").upsert(rows, { onConflict: "job_id,type,value", ignoreDuplicates: true });
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

  const [{ data: globalTg }, { data: toolPrefs }] = await Promise.all([
    svcSupa.from("tool_configs").select("config").eq("user_id", userId).eq("tool_slug", "_telegram").maybeSingle(),
    svcSupa.from("tool_configs").select("config").eq("user_id", userId).eq("tool_slug", "email-extractor").maybeSingle(),
  ]);

  const tgCfg = (globalTg?.config ?? {}) as { botToken?: string; chatId?: string };
  const prefs = (toolPrefs?.config ?? {}) as { notificationsEnabled?: boolean };

  if (!tgCfg.botToken || !tgCfg.chatId) return;
  if (prefs.notificationsEnabled === false) return;

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
    botToken: tgCfg.botToken,
    chatId: tgCfg.chatId,
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
