const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Matches international and local phone formats (7–15 digits)
const PHONE_RE =
  /(?:(?:\+|00)\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?)(?:\d{3,4}[\s.\-]?){1,3}\d{2,4}/g;

const JUNK_DOMAINS = new Set([
  "example.com", "example.org", "test.com", "domain.com",
  "yourdomain.com", "email.com", "sentry.io", "w3.org",
  "schema.org", "google-analytics.com", "googletagmanager.com",
]);

export function extractEmails(text: string): string[] {
  const raw = [...(text.matchAll(EMAIL_RE) ?? [])].map((m) => m[0].toLowerCase());
  return [...new Set(raw)].filter((e) => {
    const domain = e.split("@")[1] ?? "";
    return domain.includes(".") && !JUNK_DOMAINS.has(domain) && !e.startsWith("noreply");
  });
}

export function extractPhones(text: string): string[] {
  const raw = [...(text.matchAll(PHONE_RE) ?? [])].map((m) => m[0].trim());
  return [...new Set(raw)].filter((p) => {
    const digits = p.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  });
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ");
}

export function decodeQuotedPrintable(str: string): string {
  return str.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16))
  );
}
