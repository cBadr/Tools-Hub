import type React from "react";

export type ToolCategory = "marketing" | "text" | "data" | "developer" | "productivity" | "media";

export interface ToolProps {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}

export interface ToolSettingsProps {
  config: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => Promise<void>;
}

export interface ToolDefinition {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: ToolCategory;
  version: string;
  isActive: boolean;
  isPro: boolean;
  component: React.LazyExoticComponent<React.ComponentType<ToolProps>>;
  settingsComponent?: React.LazyExoticComponent<React.ComponentType<ToolSettingsProps>>;
  defaultConfig: Record<string, unknown>;
}
