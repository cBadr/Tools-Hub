import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { encrypt } from "@/tools/email-extractor/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const complete = (params: Record<string, string>) =>
    NextResponse.redirect(`${appUrl}/auth/oauth-complete?${new URLSearchParams(params).toString()}`);

  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) return complete({ error: "oauth_denied" });

  const cookieStore = await cookies();
  const cookieState = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");
  if (!cookieState || cookieState !== state) return complete({ error: "invalid_state" });

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  const redirectUri = `${appUrl}/api/email-extractor/oauth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) return complete({ error: "token_exchange_failed" });

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();
  const email: string = profile.email ?? "";
  if (!email) return complete({ error: "no_email" });

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  const { error: dbErr } = await supabase.from("email_accounts").upsert(
    {
      user_id: user.id,
      label: email,
      email,
      imap_host: "imap.gmail.com",
      imap_port: 993,
      imap_tls: true,
      oauth_provider: "gmail",
      oauth_access_token_enc: encrypt(tokens.access_token),
      oauth_refresh_token_enc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      oauth_expires_at: expiresAt.toISOString(),
    },
    { onConflict: "user_id,email" }
  );

  if (dbErr) return complete({ error: "db_error" });

  return complete({ oauth: "success", provider: "gmail" });
}
