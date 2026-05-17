import { lazy } from "react";
import type { ToolDefinition } from "../_registry/types";

const definition: ToolDefinition = {
  slug: "email-tracker",
  name: "Email Tracker",
  description: "Track email opens with detailed analytics and instant Telegram notifications.",
  icon: "Mail",
  category: "marketing",
  version: "1.0.0",
  isActive: true,
  isPro: false,
  component: lazy(() => import("./index")),
  settingsComponent: lazy(() => import("./settings")),
  defaultConfig: {
    telegramBotToken: "",
    telegramChatId: "",
    notificationsEnabled: false,
    notifyOnFirstOpenOnly: false,
  },
};

export default definition;
