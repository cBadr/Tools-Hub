import { lazy } from "react";
import type { ToolDefinition } from "../_registry/types";

const manifest: ToolDefinition = {
  slug: "email-extractor",
  name: "Email Extractor",
  description: "Connect to your inbox via IMAP and extract email addresses and phone numbers",
  icon: "Inbox",
  category: "productivity",
  version: "1.0.0",
  isActive: true,
  isPro: false,
  component: lazy(() => import("./index")),
  settingsComponent: lazy(() => import("./settings")),
  defaultConfig: {},
};

export default manifest;
