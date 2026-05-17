import { type NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { getGeoData } from "@/tools/email-tracker/lib/geo";
import { parseUserAgent } from "@/tools/email-tracker/lib/ua";
import { sendTelegramNotification } from "@/tools/email-tracker/lib/telegram";
import type { TelegramConfig } from "@/types/email-tracker";

// 1×1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

const GIF_RESPONSE = () =>
  new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;

  const supabase = createServiceSupabase();

  // Look up the campaign
  const { data: campaign } = await supabase
    .from("email_campaigns")
    .select("id, user_id, name, is_active, open_count")
    .eq("tracking_id", trackingId)
    .single();

  if (!campaign || !campaign.is_active) {
    return GIF_RESPONSE();
  }

  // Extract request metadata
  const forwarded = request.headers.get("x-forwarded-for");
  const ipRaw = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") ?? "unknown";
  const ip = ipRaw === "::1" || ipRaw === "127.0.0.1" ? "8.8.8.8" : ipRaw; // Use test IP for localhost
  const userAgentStr = request.headers.get("user-agent") ?? "";
  const acceptLanguage = request.headers.get("accept-language") ?? null;
  const referer = request.headers.get("referer") ?? null;

  // Parse user agent
  const ua = parseUserAgent(userAgentStr);

  // Geo lookup (non-blocking — we'll insert after getting the data)
  const geo = await getGeoData(ip);

  // Insert open event log
  const { data: eventRow, error: insertError } = await supabase
    .from("email_open_events")
    .insert({
      campaign_id: campaign.id,
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
    // Update campaign counters
    await supabase
      .from("email_campaigns")
      .update({
        open_count: campaign.open_count + 1,
        last_opened_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    // Send Telegram notification (async, fire and forget)
    sendTelegramNotificationAsync({
      supabase,
      campaignId: campaign.id,
      userId: campaign.user_id,
      campaignName: campaign.name,
      eventId: eventRow?.id,
      ip,
      geo,
      ua,
    });
  }

  return GIF_RESPONSE();
}

async function sendTelegramNotificationAsync({
  supabase,
  campaignId,
  userId,
  campaignName,
  eventId,
  ip,
  geo,
  ua,
}: {
  supabase: ReturnType<typeof createServiceSupabase>;
  campaignId: string;
  userId: string;
  campaignName: string;
  eventId: number | undefined;
  ip: string;
  geo: Awaited<ReturnType<typeof getGeoData>>;
  ua: ReturnType<typeof parseUserAgent>;
}) {
  // Get the user's Telegram config
  const { data: toolConfig } = await supabase
    .from("tool_configs")
    .select("config")
    .eq("user_id", userId)
    .eq("tool_slug", "email-tracker")
    .single();

  if (!toolConfig) return;

  const config = toolConfig.config as unknown as TelegramConfig;
  if (!config.notificationsEnabled || !config.telegramBotToken || !config.telegramChatId) return;

  const error = await sendTelegramNotification({
    botToken: config.telegramBotToken,
    chatId: config.telegramChatId,
    campaignName,
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
