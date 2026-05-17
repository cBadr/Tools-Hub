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

interface RequestResult {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/**
 * Makes an HTTP/HTTPS request through a proxy agent.
 * - Uses an absolute timeout (setTimeout) so hanging proxies always get cut.
 * - If no keyword is needed, resolves as soon as the response status arrives
 *   (body is never read, so large pages never cause false "dead" results).
 * - If a keyword is needed, reads up to 8 KB then stops.
 */
function makeRequest(
  url: string,
  agent: http.Agent,
  timeoutMs: number,
  keyword?: string,
): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        fn();
      }
    };

    // Absolute timeout — kills hanging connections regardless of socket state
    const timer = global.setTimeout(() => {
      done(() => reject(new Error("timeout")));
      try { req.destroy(); } catch { /* ignore */ }
    }, timeoutMs);

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
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      },
      (res) => {
        const status  = res.statusCode ?? 0;
        const headers = res.headers as Record<string, string | string[] | undefined>;

        if (!keyword) {
          // No keyword — status code alone is enough, never read the body
          done(() => resolve({ status, headers, body: "" }));
          res.resume(); // drain silently so the socket can close cleanly
          return;
        }

        // Keyword check — read up to 8 KB then stop
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
          if (body.length >= 8192) {
            done(() => resolve({ status, headers, body }));
            res.destroy();
          }
        });
        res.on("end", () => done(() => resolve({ status, headers, body })));
        res.on("error", () => done(() => resolve({ status, headers, body })));
      },
    );

    req.on("error", (err) => done(() => reject(err)));
    req.end();
  });
}

function detectAnonymity(headers: Record<string, string | string[] | undefined>): string {
  const names = Object.keys(headers).map((k) => k.toLowerCase());
  const reveals = ["via", "x-forwarded-for", "proxy-connection", "x-real-ip", "forwarded"];
  if (!reveals.some((h) => names.includes(h))) return "elite";
  const xfwd = (headers["x-forwarded-for"] ?? "") as string;
  return xfwd.split(",").length > 1 ? "transparent" : "anonymous";
}

async function getProxyGeo(
  ip: string,
): Promise<{ country?: string; countryCode?: string; city?: string; isp?: string } | null> {
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=country,countryCode,city,isp,status`,
      { signal: AbortSignal.timeout(5000) },
    );
    const data = (await res.json()) as {
      status: string;
      country?: string;
      countryCode?: string;
      city?: string;
      isp?: string;
    };
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
  let result: RequestResult;
  try {
    result = await makeRequest(testUrl, agent, timeoutMs, testKeyword);
  } catch {
    return { id: proxy.id, status: "dead" };
  }

  const latencyMs = Date.now() - t1;

  // Any HTTP response means the proxy successfully tunneled the request.
  // Only fail if: keyword specified but not found, or server error (5xx).
  if (result.status === 0 || result.status >= 500) {
    return { id: proxy.id, status: "dead", latencyMs };
  }
  if (testKeyword && result.body && !result.body.includes(testKeyword)) {
    return { id: proxy.id, status: "dead", latencyMs };
  }

  const anonymity = detectAnonymity(result.headers);

  // Jitter: second request (no body needed)
  let jitterMs = 0;
  try {
    const t2 = Date.now();
    await makeRequest(testUrl, agent, Math.min(timeoutMs, 8000));
    jitterMs = Math.abs(Date.now() - t2 - latencyMs);
  } catch { /* jitter is optional */ }

  const geo = await getProxyGeo(proxy.host);

  return {
    id: proxy.id,
    status: "live",
    latencyMs,
    jitterMs,
    anonymity,
    country:     geo?.country,
    countryCode: geo?.countryCode,
    city:        geo?.city,
    isp:         geo?.isp,
  };
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

  const proxies    = body.proxies.slice(0, 100);
  const testUrl    = body.testUrl  || "https://www.google.com";
  const timeoutMs  = Math.min(Math.max(body.timeoutMs ?? 10000, 2000), 25000);

  const settled = await Promise.allSettled(
    proxies.map((p) => checkSingleProxy(p, testUrl, body.testKeyword, timeoutMs)),
  );

  const results: CheckResult[] = settled.map((r, i) =>
    r.status === "fulfilled" ? r.value : { id: proxies[i].id, status: "dead" },
  );

  return NextResponse.json({ results });
}
