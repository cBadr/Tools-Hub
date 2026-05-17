import { type NextRequest, NextResponse, after } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { getGeoData } from "@/tools/email-tracker/lib/geo";
import { parseUserAgent } from "@/tools/email-tracker/lib/ua";
import { sendTelegramNotification } from "@/tools/email-tracker/lib/telegram";

// 1×1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Minimal valid WOFF2 file (8 bytes — triggers font load without rendering)
const EMPTY_WOFF2 = Buffer.from("d09GMgABAAAAAAA", "base64");

function makeResponse(type: string): NextResponse {
  switch (type) {
    case "css":
      return new NextResponse("", {
        status: 200,
        headers: {
          "Content-Type": "text/css; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    case "js":
      return new NextResponse("", {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    case "font":
      return new NextResponse(EMPTY_WOFF2, {
        status: 200,
        headers: {
          "Content-Type": "font/woff2",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    default: // "img"
      return new NextResponse(TRANSPARENT_GIF, {
        status: 200,
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const trackingType = searchParams.get("t") ?? "img";
  const recipientEmail = searchParams.get("e") ?? null;

  const supabase = createServiceSupabase();

  // Look up the campaign
  const { data: campaign } = await supabase
    .from("email_campaigns")
    .select("id, user_id, name, is_active, open_count")
    .eq("tracking_id", trackingId)
    .single();

  if (!campaign || !campaign.is_active) {
    return makeResponse(trackingType);
  }

  // Extract request metadata
  const forwarded = request.headers.get("x-forwarded-for");
  const ipRaw = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") ?? "unknown";
  const ip = ipRaw === "::1" || ipRaw === "127.0.0.1" ? "8.8.8.8" : ipRaw;
  const userAgentStr = request.headers.get("user-agent") ?? "";
  const acceptLanguage = request.headers.get("accept-language") ?? null;
  const referer = request.headers.get("referer") ?? null;

  const ua = parseUserAgent(userAgentStr);
  const geo = await getGeoData(ip);

  const { data: eventRow, error: insertError } = await supabase
    .from("email_open_events")
    .insert({
      campaign_id: campaign.id,
      recipient_email: recipientEmail,
      ip_address: ip,
      ip_is_proxy: geo?.proxy ?? null,
      ip_is_vpn: geo?.hosting ?? null,
      country: geo?.country ?? null,
      country_code: geo?.countryCode ?? null,
      region: geo?.regionName ?? null,
      city: geo?.city ?? null,
      zip: geo?.zip ?? null,
      latitude: geo?.lat ?? null,
      longitude: geo?.lon ?? null,
      timezone: geo?.timezone ?? null,
      isp: geo?.isp ?? null,
      org: geo?.org ?? null,
      as_number: geo?.as ?? null,
      browser: ua.browser.name ?? null,
      browser_version: ua.browser.version ?? null,
      browser_major: ua.browser.major ?? null,
      engine: ua.engine.name ?? null,
      os: ua.os.name ?? null,
      os_version: ua.os.version ?? null,
      device_type: ua.device.type ?? "desktop",
      device_vendor: ua.device.vendor ?? null,
      device_model: ua.device.model ?? null,
      cpu_arch: ua.cpu.architecture ?? null,
      user_agent: userAgentStr || null,
      accept_language: acceptLanguage,
      referer,
      raw_geo: geo ? (JSON.parse(JSON.stringify(geo)) as import("@/types/database").Json) : null,
      raw_ua: JSON.parse(JSON.stringify({ browser: ua.browser, engine: ua.engine, os: ua.os, device: ua.device, cpu: ua.cpu })) as import("@/types/database").Json,
      telegram_sent: false,
    })
    .select("id")
    .single();

  if (!insertError) {
    await supabase
      .from("email_campaigns")
      .update({
        open_count: campaign.open_count + 1,
        last_opened_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    after(sendTelegramNotificationAsync({
      supabase,
      campaignId: campaign.id,
      userId: campaign.user_id,
      campaignName: campaign.name,
      recipientEmail,
      referer,
      eventId: eventRow?.id,
      ip,
      geo,
      ua,
    }));
  }

  return makeResponse(trackingType);
}

async function sendTelegramNotificationAsync({
  supabase,
  campaignId,
  userId,
  campaignName,
  recipientEmail,
  referer,
  eventId,
  ip,
  geo,
  ua,
}: {
  supabase: ReturnType<typeof createServiceSupabase>;
  campaignId: string;
  userId: string;
  campaignName: string;
  recipientEmail: string | null;
  referer: string | null;
  eventId: number | undefined;
  ip: string;
  geo: Awaited<ReturnType<typeof getGeoData>>;
  ua: ReturnType<typeof parseUserAgent>;
}) {
  const [{ data: globalTg }, { data: toolPrefs }] = await Promise.all([
    supabase.from("tool_configs").select("config").eq("user_id", userId).eq("tool_slug", "_telegram").maybeSingle(),
    supabase.from("tool_configs").select("config").eq("user_id", userId).eq("tool_slug", "email-tracker").maybeSingle(),
  ]);

  const tgCfg  = (globalTg?.config  ?? {}) as { botToken?: string; chatId?: string };
  const prefs  = (toolPrefs?.config ?? {}) as { notificationsEnabled?: boolean; notifyOnFirstOpenOnly?: boolean };

  if (!tgCfg.botToken || !tgCfg.chatId) return;
  if (prefs.notificationsEnabled === false) return;

  // First-open-only check
  if (prefs.notifyOnFirstOpenOnly) {
    const { count } = await supabase
      .from("email_open_events")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("telegram_sent", true);
    if ((count ?? 0) > 0) return;
  }

  const error = await sendTelegramNotification({
    botToken: tgCfg.botToken,
    chatId: tgCfg.chatId,
    campaignName,
    recipientEmail,
    referer,
    ip,
    geo,
    ua,
  });

  if (eventId !== undefined) {
    await supabase
      .from("email_open_events")
      .update({
        telegram_sent: !error,
        telegram_error: error ?? null,
      })
      .eq("id", eventId);
  }
}
