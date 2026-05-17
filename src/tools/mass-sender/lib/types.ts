// Matches the actual email_accounts table schema
export interface EmailAccount {
  id: string;
  user_id: string;
  email: string;
  label: string;
  imap_host: string;
  imap_port: number;
  imap_tls: boolean;
  credentials_enc?: string | null;   // IMAP password (encrypted)
  oauth_provider?: string | null;    // "google" | "microsoft"
  oauth_access_token_enc?: string | null;
  oauth_refresh_token_enc?: string | null;
  oauth_expires_at?: string | null;
  is_active: boolean;
  last_synced_at?: string | null;
  created_at: string;
}

export interface MassCampaign {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text?: string | null;
  status: "draft" | "running" | "paused" | "completed" | "cancelled";
  mode: "new" | "reply";
  thread_search_folder: string;
  thread_custom_folder?: string | null;
  add_re_prefix: boolean;
  use_proxy: boolean;
  rate_limit_per_hour: number;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface MassRecipient {
  id: number;
  campaign_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  assigned_account_id?: string | null;
  thread_message_id?: string | null;
  thread_subject?: string | null;
  status: "pending" | "sent" | "failed" | "skipped";
  error_message?: string | null;
  sent_at?: string | null;
  message_id?: string | null;
  created_at: string;
}

export interface LiveProxy {
  id: string;
  type: string;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
}
