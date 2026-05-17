import type { Database } from "./database";

export type Campaign = Database["public"]["Tables"]["email_campaigns"]["Row"];
export type OpenEvent = Database["public"]["Tables"]["email_open_events"]["Row"];

export interface GeoData {
  status: string;
  country: string;
  countryCode: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  proxy: boolean;
  hosting: boolean;
  query: string;
}

export interface TelegramConfig {
  telegramBotToken: string;
  telegramChatId: string;
  notificationsEnabled: boolean;
  notifyOnFirstOpenOnly: boolean;
}
