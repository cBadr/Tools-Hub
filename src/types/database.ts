export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          plan: "free" | "pro";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: "free" | "pro";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: "free" | "pro";
          updated_at?: string;
        };
        Relationships: [];
      };
      tools: {
        Row: {
          slug: string;
          name: string;
          description: string | null;
          category: string;
          is_active: boolean;
          is_pro: boolean;
          created_at: string;
        };
        Insert: {
          slug: string;
          name: string;
          description?: string | null;
          category: string;
          is_active?: boolean;
          is_pro?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          category?: string;
          is_active?: boolean;
          is_pro?: boolean;
        };
        Relationships: [];
      };
      tool_configs: {
        Row: {
          id: string;
          user_id: string;
          tool_slug: string;
          config: Json;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tool_slug: string;
          config?: Json;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          config?: Json;
          is_pinned?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          id: string;
          theme: string;
          accent_color: string;
          sidebar_state: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          theme?: string;
          accent_color?: string;
          sidebar_state?: string;
          updated_at?: string;
        };
        Update: {
          theme?: string;
          accent_color?: string;
          sidebar_state?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_campaigns: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          tracking_id: string;
          is_active: boolean;
          open_count: number;
          unique_opens: number;
          last_opened_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          tracking_id?: string;
          is_active?: boolean;
          open_count?: number;
          unique_opens?: number;
          last_opened_at?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_active?: boolean;
          open_count?: number;
          unique_opens?: number;
          last_opened_at?: string | null;
        };
        Relationships: [];
      };
      email_open_events: {
        Row: {
          id: number;
          campaign_id: string;
          ip_address: string | null;
          ip_is_proxy: boolean | null;
          ip_is_vpn: boolean | null;
          country: string | null;
          country_code: string | null;
          region: string | null;
          city: string | null;
          zip: string | null;
          latitude: number | null;
          longitude: number | null;
          timezone: string | null;
          isp: string | null;
          org: string | null;
          as_number: string | null;
          browser: string | null;
          browser_version: string | null;
          browser_major: string | null;
          engine: string | null;
          os: string | null;
          os_version: string | null;
          device_type: string | null;
          device_vendor: string | null;
          device_model: string | null;
          cpu_arch: string | null;
          user_agent: string | null;
          accept_language: string | null;
          referer: string | null;
          raw_geo: Json | null;
          raw_ua: Json | null;
          telegram_sent: boolean;
          telegram_error: string | null;
          opened_at: string;
        };
        Insert: {
          campaign_id: string;
          ip_address?: string | null;
          ip_is_proxy?: boolean | null;
          ip_is_vpn?: boolean | null;
          country?: string | null;
          country_code?: string | null;
          region?: string | null;
          city?: string | null;
          zip?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          timezone?: string | null;
          isp?: string | null;
          org?: string | null;
          as_number?: string | null;
          browser?: string | null;
          browser_version?: string | null;
          browser_major?: string | null;
          engine?: string | null;
          os?: string | null;
          os_version?: string | null;
          device_type?: string | null;
          device_vendor?: string | null;
          device_model?: string | null;
          cpu_arch?: string | null;
          user_agent?: string | null;
          accept_language?: string | null;
          referer?: string | null;
          raw_geo?: Json | null;
          raw_ua?: Json | null;
          telegram_sent?: boolean;
          telegram_error?: string | null;
          opened_at?: string;
        };
        Update: {
          telegram_sent?: boolean;
          telegram_error?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
