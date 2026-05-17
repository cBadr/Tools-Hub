import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { detectFromEmail } from "@/tools/email-extractor/lib/detect";
import dns from "dns/promises";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = (await request.json()) as { email: string };
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }

  // Fast path: known domain map
  const fromMap = detectFromEmail(email);
  if (fromMap) return NextResponse.json({ ok: true, settings: fromMap, source: "map" });

  // DNS MX lookup for custom domains
  const domain = email.split("@")[1].toLowerCase();
  try {
    const records = await dns.resolveMx(domain);
    if (!records.length) return NextResponse.json({ ok: false, error: "No MX records" });

    records.sort((a, b) => a.priority - b.priority);
    const mx = records[0].exchange.toLowerCase();

    let host: string;
    let provider: "gmail" | "outlook" | null = null;

    if (mx.includes("google") || mx.includes("gmail")) {
      host = "imap.gmail.com";
      provider = "gmail";
    } else if (mx.includes("outlook") || mx.includes("microsoft") || mx.includes("office365")) {
      host = "outlook.office365.com";
      provider = "outlook";
    } else if (mx.includes("yahoo")) {
      host = "imap.mail.yahoo.com";
    } else if (mx.includes("zoho")) {
      host = "imap.zoho.com";
    } else {
      host = `imap.${domain}`;
    }

    return NextResponse.json({
      ok: true,
      settings: { host, port: 993, tls: true, provider },
      source: "dns",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not resolve MX records" });
  }
}
