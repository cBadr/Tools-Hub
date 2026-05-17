export interface DetectedSettings {
  host: string;
  port: number;
  tls: boolean;
  provider: "gmail" | "outlook" | null;
}

const DOMAIN_MAP: Record<string, DetectedSettings> = {
  "gmail.com":       { host: "imap.gmail.com",          port: 993, tls: true,  provider: "gmail" },
  "googlemail.com":  { host: "imap.gmail.com",          port: 993, tls: true,  provider: "gmail" },
  "outlook.com":     { host: "outlook.office365.com",   port: 993, tls: true,  provider: "outlook" },
  "hotmail.com":     { host: "outlook.office365.com",   port: 993, tls: true,  provider: "outlook" },
  "live.com":        { host: "outlook.office365.com",   port: 993, tls: true,  provider: "outlook" },
  "msn.com":         { host: "outlook.office365.com",   port: 993, tls: true,  provider: "outlook" },
  "yahoo.com":       { host: "imap.mail.yahoo.com",     port: 993, tls: true,  provider: null },
  "yahoo.co.uk":     { host: "imap.mail.yahoo.com",     port: 993, tls: true,  provider: null },
  "ymail.com":       { host: "imap.mail.yahoo.com",     port: 993, tls: true,  provider: null },
  "icloud.com":      { host: "imap.mail.me.com",        port: 993, tls: true,  provider: null },
  "me.com":          { host: "imap.mail.me.com",        port: 993, tls: true,  provider: null },
  "mac.com":         { host: "imap.mail.me.com",        port: 993, tls: true,  provider: null },
  "zoho.com":        { host: "imap.zoho.com",           port: 993, tls: true,  provider: null },
  "zohomail.com":    { host: "imap.zoho.com",           port: 993, tls: true,  provider: null },
  "aol.com":         { host: "imap.aol.com",            port: 993, tls: true,  provider: null },
};

export function detectFromEmail(email: string): DetectedSettings | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return DOMAIN_MAP[domain] ?? null;
}
