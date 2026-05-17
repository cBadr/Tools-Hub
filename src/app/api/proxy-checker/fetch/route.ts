import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { PROXY_SOURCES, parseProxyText, getSourceByKey } from "@/tools/proxy-checker/lib/sources";
import type { ProxyType } from "@/tools/proxy-checker/lib/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    sourceKey?: string;
    customUrl?: string;
    customType?: ProxyType;
  };

  let fetchUrl: string;
  let proxyType: ProxyType;

  if (body.sourceKey) {
    const source = getSourceByKey(body.sourceKey);
    if (!source) return NextResponse.json({ error: "Unknown source" }, { status: 400 });
    fetchUrl  = source.url;
    proxyType = source.type;
  } else if (body.customUrl) {
    fetchUrl  = body.customUrl;
    proxyType = body.customType ?? "http";
  } else {
    return NextResponse.json({ error: "Provide sourceKey or customUrl" }, { status: 400 });
  }

  let text: string;
  try {
    const res = await fetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch source: ${String(err)}` }, { status: 502 });
  }

  const proxies = parseProxyText(text, proxyType);
  return NextResponse.json({ proxies, count: proxies.length });
}
