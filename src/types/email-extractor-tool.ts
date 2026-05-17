import type { Database } from "./database";

export type EmailAccount  = Database["public"]["Tables"]["email_accounts"]["Row"];
export type ExtractionJob = Database["public"]["Tables"]["extraction_jobs"]["Row"];
export type ExtractedContact = Database["public"]["Tables"]["extracted_contacts"]["Row"];

export type ScanPhase = "imap" | "contacts" | "calendar";

export interface ScanCursor {
  phase: ScanPhase;
  folderIndex: number;
  seqFrom: number;
}

export interface JobConfig {
  sources: ScanPhase[];
  validateSyntax: boolean;
  deduplicateGlobally: boolean;
}

export interface ImapPreset {
  label: string;
  host: string;
  port: number;
  tls: boolean;
}

export const IMAP_PRESETS: ImapPreset[] = [
  { label: "Gmail",        host: "imap.gmail.com",          port: 993, tls: true },
  { label: "Outlook",      host: "outlook.office365.com",   port: 993, tls: true },
  { label: "Yahoo",        host: "imap.mail.yahoo.com",     port: 993, tls: true },
  { label: "iCloud",       host: "imap.mail.me.com",        port: 993, tls: true },
  { label: "Zoho",         host: "imap.zoho.com",           port: 993, tls: true },
  { label: "Custom",       host: "",                        port: 993, tls: true },
];

export interface ScanSettings {
  folders: string[] | null;
  maxMessages: number;
  batchSize: number;
  extractEmails: boolean;
  extractPhones: boolean;
}
