function h(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface ReportPayload {
  botToken: string;
  chatId: string;
  accountEmail: string;
  messagesScanned: number;
  emailsFound: number;
  phonesFound: number;
  durationMs: number;
  topEmails: string[];
  topPhones: string[];
  error?: string | null;
}

export async function sendExtractionReport(payload: ReportPayload): Promise<string | null> {
  const { botToken, chatId, accountEmail, messagesScanned, emailsFound, phonesFound, durationMs, topEmails, topPhones, error } = payload;

  const mins = Math.floor(durationMs / 60000);
  const secs = Math.floor((durationMs % 60000) / 1000);
  const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const lines: (string | null)[] = [
    error
      ? `❌ <b>Extraction Failed</b>`
      : `✅ <b>Extraction Complete!</b>`,
    ``,
    `📧 <b>Account:</b> <code>${h(accountEmail)}</code>`,
    `⏱ <b>Duration:</b> ${h(duration)}`,
    `📨 <b>Messages scanned:</b> ${messagesScanned.toLocaleString()}`,
    ``,
    `📊 <b>Results</b>`,
    `  ✉️ Email addresses: <b>${emailsFound.toLocaleString()}</b>`,
    `  📞 Phone numbers: <b>${phonesFound.toLocaleString()}</b>`,
    error ? `\n⚠️ Error: <code>${h(error)}</code>` : null,
    topEmails.length > 0 ? [
      ``,
      `<b>Sample emails found:</b>`,
      ...topEmails.slice(0, 5).map((e) => `  • <code>${h(e)}</code>`),
    ].join("\n") : null,
    topPhones.length > 0 ? [
      ``,
      `<b>Sample phones found:</b>`,
      ...topPhones.slice(0, 5).map((p) => `  • <code>${h(p)}</code>`),
    ].join("\n") : null,
  ];

  const text = lines.filter((l) => l !== null).join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const body = await res.text();
      return `HTTP ${res.status}: ${body.slice(0, 200)}`;
    }
    return null;
  } catch (err) {
    return String(err);
  }
}
