import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { JobConfig, ScanPhase } from "@/types/email-extractor-tool";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    accountId, folders, maxMessages, batchSize, extractEmails, extractPhones, jobConfig,
  } = body as {
    accountId: string;
    folders: string[] | null;
    maxMessages: number;
    batchSize: number;
    extractEmails: boolean;
    extractPhones: boolean;
    jobConfig?: JobConfig;
  };

  const { data: account } = await supabase
    .from("email_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const sources: ScanPhase[] = jobConfig?.sources?.length ? jobConfig.sources : ["imap"];
  const initialPhase: ScanPhase = sources[0];

  const { data: job, error } = await supabase
    .from("extraction_jobs")
    .insert({
      user_id: user.id,
      account_id: accountId,
      status: "running",
      folders: folders && folders.length > 0 ? folders : null,
      max_messages: maxMessages,
      batch_size: batchSize,
      extract_emails: extractEmails,
      extract_phones: extractPhones,
      scan_cursor: { phase: initialPhase, folderIndex: 0, seqFrom: 1 },
      job_config: (jobConfig ?? { sources: ["imap"], validateSyntax: false, deduplicateGlobally: false }) as any,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !job) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json({ jobId: job.id });
}
