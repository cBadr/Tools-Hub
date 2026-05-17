import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { encrypt } from "@/tools/email-extractor/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/tools/email-extractor?error=oauth_denied`);
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const cookieState = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(`${appUrl}/tools/email-extractor?error=invalid_state`);
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  // Exchange code for tokens
  const redirectUri = `${appUrl}/api/email-extractor/oauth/microsoft/callback`;
  const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: "https://outlook.office.com/IMAP.AccessAsUser.All offline_access email profile openid",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    return NextResponse.redirect(`${appUrl}/tools/email-extractor?error=token_exchange_failed`);
  }

  // Decode id_token to get email (Microsoft sends it in id_token)
  let email = "";
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8")
      );
      email = payload.email ?? payload.preferred_username ?? "";
    } catch { /* ignore */ }
  }
  if (!email) {
    return NextResponse.redirect(`${appUrl}/tools/email-extractor?error=no_email`);
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  // Upsert account
  const { error: dbErr } = await supabase.from("email_accounts").upsert(
    {
      user_id: user.id,
      label: email,
      email,
      imap_host: "outlook.office365.com",
      imap_port: 993,
      imap_tls: true,
      oauth_provider: "outlook",
      oauth_access_token_enc: encrypt(tokens.access_token),
      oauth_refresh_token_enc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      oauth_expires_at: expiresAt.toISOString(),
    },
    { onConflict: "user_id,email" }
  );

  if (dbErr) {
    return NextResponse.redirect(`${appUrl}/tools/email-extractor?error=db_error`);
  }

  return NextResponse.redirect(`${appUrl}/tools/email-extractor?oauth=success&provider=outlook`);
}
