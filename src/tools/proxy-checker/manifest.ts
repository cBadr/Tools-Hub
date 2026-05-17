import { lazy } from "react";
import type { ToolDefinition } from "../_registry/types";

const definition: ToolDefinition = {
  slug: "proxy-checker",
  name: "Proxy Checker",
  description: "Fetch, validate and manage HTTP, HTTPS, SOCKS4 and SOCKS5 proxies with geo-lookup and anonymity detection.",
  icon: "Shield",
  category: "developer",
  version: "1.0.0",
  isActive: true,
  isPro: false,
  component: lazy(() => import("./index")),
  settingsComponent: lazy(() => import("./settings")),
  defaultConfig: {
    defaultTestUrl: "https://www.google.com",
    defaultTestKeyword: "",
    defaultTimeout: 10,
    defaultConcurrency: 50,
    notificationsEnabled: true,
  },
};

export default definition;
