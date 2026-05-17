import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/tools/email-extractor/lib/crypto";
import { testConnection } from "@/tools/email-extractor/lib/imap";
import { refreshGoogleToken, refreshMicrosoftToken } from "@/tools/email-extractor/lib/oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Reuse mode: load folders from an existing saved account
  if (body.reuse) {
    const { data: acc } = await supabase
      .from("email_accounts")
      .select("email, imap_host, imap_port, imap_tls, credentials_enc, oauth_provider, oauth_access_token_enc, oauth_refresh_token_enc, oauth_expires_at")
      .eq("id", body.reuse)
      .eq("user_id", user.id)
      .single();

    if (!acc) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    let accessTokenEnc = acc.oauth_access_token_enc;

    // Refresh OAuth token if needed
    if (acc.oauth_provider && acc.oauth_refresh_token_enc) {
      const expiresAt = acc.oauth_expires_at ? new Date(acc.oauth_expires_at) : new Date(0);
      if (expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
        try {
          const refreshToken = decrypt(acc.oauth_refresh_token_enc);
          const refreshed = acc.oauth_provider === "gmail"
            ? await refreshGoogleToken(refreshToken)
            : await refreshMicrosoftToken(refreshToken);
          accessTokenEnc = encrypt(refreshed.accessToken);
          await supabase.from("email_accounts").update({
            oauth_access_token_enc: accessTokenEnc,
            oauth_expires_at: refreshed.expiresAt.toISOString(),
          }).eq("id", body.reuse);
        } catch (err) {
          return NextResponse.json({ error: `Token refresh failed: ${String(err).slice(0, 200)}` }, { status: 400 });
        }
      }
    }

    const creds = {
      host: acc.imap_host,
      port: acc.imap_port,
      tls: acc.imap_tls,
      email: acc.email,
      credentialsEnc: acc.credentials_enc,
      accessTokenEnc,
    };

    try {
      const folders = await testConnection(creds);
      return NextResponse.json({ ok: true, folders });
    } catch (err) {
      return NextResponse.json({ error: `Connection failed: ${String(err).slice(0, 300)}` }, { status: 400 });
    }
  }

  // New account mode: test (and optionally save) with provided credentials
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

  const credentialsEnc = encrypt(password);
  let folders: string[];
  try {
    folders = await testConnection({ host, port, tls, email, credentialsEnc });
  } catch (err) {
    return NextResponse.json({ error: `Connection failed: ${String(err).slice(0, 200)}` }, { status: 400 });
  }

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
