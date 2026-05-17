import { getCountryFlag, formatDateTime } from "@/lib/utils";
import type { GeoData } from "@/types/email-tracker";
import type { parseUserAgent } from "./ua";

interface NotificationPayload {
  botToken: string;
  chatId: string;
  campaignName: string;
  ip: string;
  geo: GeoData | null;
  ua: ReturnType<typeof parseUserAgent>;
}

export async function sendTelegramNotification(payload: NotificationPayload): Promise<string | null> {
  const { botToken, chatId, campaignName, ip, geo, ua } = payload;

  const flag = geo?.countryCode ? getCountryFlag(geo.countryCode) : "🌐";
  const now = formatDateTime(new Date());

  const deviceType = ua.device.type
    ? ua.device.type.charAt(0).toUpperCase() + ua.device.type.slice(1)
    : "Desktop";

  const deviceInfo = ua.device.vendor && ua.device.model
    ? `${ua.device.vendor} ${ua.device.model}`
    : deviceType;

  const text = [
    `📧 *Email Opened!*`,
    ``,
    `📋 *Campaign:* ${escapeMarkdown(campaignName)}`,
    `🕐 *Time:* ${now}`,
    ``,
    `🌍 *Location*`,
    geo ? [
      `  • Country: ${flag} ${geo.country} \\(${geo.countryCode}\\)`,
      `  • Region: ${geo.regionName}`,
      `  • City: ${geo.city}`,
      `  • ISP: ${escapeMarkdown(geo.isp)}`,
      geo.proxy ? `  • ⚠️ Proxy/VPN detected` : null,
    ].filter(Boolean).join("\n") : `  • Location unavailable`,
    ``,
    `💻 *Device*`,
    `  • Type: ${deviceInfo}`,
    `  • OS: ${ua.os.name ?? "Unknown"} ${ua.os.version ?? ""}`.trim(),
    `  • Browser: ${ua.browser.name ?? "Unknown"} ${ua.browser.version ?? ""}`.trim(),
    ``,
    `🔗 *Network*`,
    `  • IP: \`${ip}\``,
    ua.ua ? `  • UA: \`${ua.ua.slice(0, 80)}${ua.ua.length > 80 ? "…" : ""}\`` : null,
  ].filter((line) => line !== null).join("\n");

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "MarkdownV2",
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return `HTTP ${res.status}: ${body.slice(0, 200)}`;
    }

    return null;
  } catch (err) {
    return String(err);
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}
