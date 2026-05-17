import { lazy } from "react";
import type { ToolDefinition } from "../_registry/types";

const definition: ToolDefinition = {
  slug: "mass-sender",
  name: "Mass Sender",
  description: "Send personalised emails at scale using your connected accounts with smart inbox delivery.",
  icon: "Send",
  category: "marketing",
  version: "1.0.0",
  isActive: true,
  isPro: false,
  component: lazy(() => import("./index")),
  settingsComponent: undefined,
  defaultConfig: {},
};

export default definition;
