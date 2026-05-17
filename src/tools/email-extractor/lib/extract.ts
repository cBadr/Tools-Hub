// Broad capture regex — post-filtered by isValidEmail
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// International phone: optional country code + local digits
const PHONE_RE =
  /(?:(?:\+|00)\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?)(?:\d{3,4}[\s.\-]?){1,3}\d{2,4}/g;

const JUNK_DOMAINS = new Set([
  "example.com", "example.org", "test.com", "domain.com",
  "yourdomain.com", "email.com", "sentry.io", "w3.org",
  "schema.org", "google-analytics.com", "googletagmanager.com",
  "localhost", "mailchimp.com", "sendgrid.net", "amazonaws.com",
  "cloudflare.com", "akismet.com", "gravatar.com",
]);

const JUNK_LOCAL_PREFIXES = [
  "noreply", "no-reply", "donotreply", "do-not-reply",
  "mailer-daemon", "postmaster", "bounce", "unsubscribe",
  "abuse", "support", "info", "hello", "contact",
];

export function isValidEmailSyntax(email: string): boolean {
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;

  // Local part
  if (!local || local.length < 1 || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (/\.{2,}/.test(local)) return false;
  if (!/^[a-zA-Z0-9._%+\-]+$/.test(local)) return false;

  // Domain
  if (!domain || domain.length > 253) return false;
  if (!domain.includes(".")) return false;
  if (/\.{2,}/.test(domain)) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  if (!/^[a-zA-Z0-9.\-]+$/.test(domain)) return false;

  // TLD must be 2–63 chars, letters only
  const tld = domain.split(".").pop() ?? "";
  if (!/^[a-zA-Z]{2,63}$/.test(tld)) return false;

  return true;
}

function isJunkEmail(email: string): boolean {
  const [local, domain] = email.split("@");
  if (JUNK_DOMAINS.has(domain)) return true;
  const localLower = local.toLowerCase();
  return JUNK_LOCAL_PREFIXES.some((p) => localLower === p || localLower.startsWith(p + ".") || localLower.startsWith(p + "-") || localLower.startsWith(p + "_"));
}

export function isValidPhoneSyntax(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  // 10–15 digits required
  if (digits.length < 10 || digits.length > 15) return false;
  // Reject all-same-digit patterns (e.g. 0000000000)
  if (/^(.)\1{9,}/.test(digits)) return false;
  // Reject sequences that look like version numbers (1.2.3.4)
  if (/^\d\.\d\.\d/.test(phone.trim())) return false;
  return true;
}

export function extractEmails(text: string): string[] {
  const raw = [...(text.matchAll(EMAIL_RE) ?? [])].map((m) => m[0].toLowerCase());
  return [...new Set(raw)].filter((e) => isValidEmailSyntax(e) && !isJunkEmail(e));
}

export function extractPhones(text: string): string[] {
  const raw = [...(text.matchAll(PHONE_RE) ?? [])].map((m) => m[0].trim());
  return [...new Set(raw)].filter(isValidPhoneSyntax);
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
