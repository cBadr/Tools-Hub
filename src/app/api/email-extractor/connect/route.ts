import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { encrypt } from "@/tools/email-extractor/lib/crypto";
import { testConnection } from "@/tools/email-extractor/lib/imap";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { label, email, password, host, port, tls, save } = body as {
    label: string;
    email: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
    save: boolean;
  };

  if (!email || !password || !host) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Test the connection
  const credentialsEnc = encrypt(password);
  let folders: string[];
  try {
    folders = await testConnection({ host, port, tls, email, credentialsEnc });
  } catch (err) {
    return NextResponse.json({ error: `Connection failed: ${String(err).slice(0, 200)}` }, { status: 400 });
  }

  // Save account if requested
  if (save) {
    const { error } = await supabase.from("email_accounts").insert({
      user_id: user.id,
      label: label || email,
      email,
      imap_host: host,
      imap_port: port,
      imap_tls: tls,
      credentials_enc: credentialsEnc,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, folders });
}
