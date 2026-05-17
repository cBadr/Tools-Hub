import { getCountryFlag, formatDateTime } from "@/lib/utils";
import type { GeoData } from "@/types/email-tracker";
import type { parseUserAgent } from "./ua";

interface NotificationPayload {
  botToken: string;
  chatId: string;
  campaignName: string;
  recipientEmail: string | null;
  ip: string;
  geo: GeoData | null;
  ua: ReturnType<typeof parseUserAgent>;
}

function h(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramNotification(payload: NotificationPayload): Promise<string | null> {
  const { botToken, chatId, campaignName, recipientEmail, ip, geo, ua } = payload;

  const flag = geo?.countryCode ? getCountryFlag(geo.countryCode) : "🌐";
  const now = formatDateTime(new Date());

  const deviceType = ua.device.type
    ? ua.device.type.charAt(0).toUpperCase() + ua.device.type.slice(1)
    : "Desktop";

  const deviceInfo = ua.device.vendor && ua.device.model
    ? `${h(ua.device.vendor)} ${h(ua.device.model)}`
    : deviceType;

  const lines: (string | null)[] = [
    `📧 <b>Email Opened!</b>`,
    ``,
    `📋 <b>Campaign:</b> ${h(campaignName)}`,
    recipientEmail ? `✉️ <b>Recipient:</b> <code>${h(recipientEmail)}</code>` : null,
    `🕐 <b>Time:</b> ${h(now)}`,
    ``,
    `🌍 <b>Location</b>`,
    geo ? [
      `  • Country: ${flag} ${h(geo.country)} (${h(geo.countryCode)})`,
      `  • Region: ${h(geo.regionName)}`,
      `  • City: ${h(geo.city)}`,
      `  • ISP: ${h(geo.isp)}`,
      geo.proxy ? `  • ⚠️ Proxy/VPN detected` : null,
    ].filter(Boolean).join("\n") : `  • Location unavailable`,
    ``,
    `💻 <b>Device</b>`,
    `  • Type: ${deviceInfo}`,
    `  • OS: ${h(ua.os.name ?? "Unknown")} ${h(ua.os.version ?? "")}`.trim(),
    `  • Browser: ${h(ua.browser.name ?? "Unknown")} ${h(ua.browser.version ?? "")}`.trim(),
    ``,
    `🔗 <b>Network</b>`,
    `  • IP: <code>${h(ip)}</code>`,
    ua.ua ? `  • UA: <code>${h(ua.ua.slice(0, 100))}${ua.ua.length > 100 ? "…" : ""}</code>` : null,
  ];

  const text = lines.filter((l) => l !== null).join("\n");

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
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
