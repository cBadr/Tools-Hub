import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import * as http from "node:http";
import * as https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ProxyInput {
  id: string;
  type: string;
  host: string;
  port: number;
}

interface CheckResult {
  id: string;
  status: "live" | "dead";
  latencyMs?: number;
  jitterMs?: number;
  country?: string;
  countryCode?: string;
  city?: string;
  isp?: string;
  anonymity?: string;
}

function buildAgent(type: string, host: string, port: number): http.Agent {
  const uri = `${type}://${host}:${port}`;
  if (type === "socks4" || type === "socks5") {
    return new SocksProxyAgent(uri) as unknown as http.Agent;
  }
  return new HttpsProxyAgent(uri) as unknown as http.Agent;
}

function makeRequest(
  url: string,
  agent: http.Agent,
  timeoutMs: number,
): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";
    const mod = isHttps ? https : http;

    const req = mod.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: (urlObj.pathname || "/") + urlObj.search,
        method: "GET",
        agent,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ProxyCheck/1.0)" },
        timeout: timeoutMs,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
          if (body.length > 65536) req.destroy();
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers as any, body }));
      },
    );

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

function detectAnonymity(headers: Record<string, string | string[] | undefined>): string {
  const headerNames = Object.keys(headers).map((k) => k.toLowerCase());
  const proxyRevealers = ["via", "x-forwarded-for", "proxy-connection", "x-real-ip", "forwarded"];
  const hasProxyHeader = proxyRevealers.some((ph) => headerNames.includes(ph));
  if (!hasProxyHeader) return "elite";
  const xfwd = (headers["x-forwarded-for"] ?? "") as string;
  if (xfwd.split(",").length > 1) return "transparent";
  return "anonymous";
}

async function getProxyGeo(ip: string): Promise<{ country?: string; countryCode?: string; city?: string; isp?: string } | null> {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,city,isp,status`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json() as any;
    if (data.status !== "success") return null;
    return { country: data.country, countryCode: data.countryCode, city: data.city, isp: data.isp };
  } catch {
    return null;
  }
}

async function checkSingleProxy(
  proxy: ProxyInput,
  testUrl: string,
  testKeyword: string | undefined,
  timeoutMs: number,
): Promise<CheckResult> {
  let agent: http.Agent;
  try {
    agent = buildAgent(proxy.type, proxy.host, proxy.port);
  } catch {
    return { id: proxy.id, status: "dead" };
  }

  const t1 = Date.now();
  try {
    const result = await makeRequest(testUrl, agent, timeoutMs);
    const latencyMs = Date.now() - t1;

    // Keyword check
    if (testKeyword && !result.body.includes(testKeyword)) {
      return { id: proxy.id, status: "dead", latencyMs };
    }

    // Jitter: second request
    let jitterMs = 0;
    try {
      const t2 = Date.now();
      await makeRequest(testUrl, agent, timeoutMs);
      jitterMs = Math.abs((Date.now() - t2) - latencyMs);
    } catch { /* jitter optional */ }

    // Anonymity from response headers
    const anonymity = detectAnonymity(result.headers);

    // Geo lookup (direct, not through proxy)
    const geo = await getProxyGeo(proxy.host);

    return {
      id: proxy.id,
      status: "live",
      latencyMs,
      jitterMs,
      anonymity,
      country: geo?.country,
      countryCode: geo?.countryCode,
      city: geo?.city,
      isp: geo?.isp,
    };
  } catch {
    return { id: proxy.id, status: "dead" };
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    proxies: ProxyInput[];
    testUrl: string;
    testKeyword?: string;
    timeoutMs: number;
  };

  if (!Array.isArray(body.proxies) || body.proxies.length === 0) {
    return NextResponse.json({ error: "No proxies provided" }, { status: 400 });
  }

  // Cap at 100 concurrent checks
  const proxies = body.proxies.slice(0, 100);
  const testUrl  = body.testUrl || "https://www.google.com";
  const timeoutMs = Math.min(Math.max(body.timeoutMs ?? 10000, 2000), 30000);

  const settled = await Promise.allSettled(
    proxies.map((p) => checkSingleProxy(p, testUrl, body.testKeyword, timeoutMs))
  );

  const results: CheckResult[] = settled.map((r, i) =>
    r.status === "fulfilled" ? r.value : { id: proxies[i].id, status: "dead" }
  );

  return NextResponse.json({ results });
}
