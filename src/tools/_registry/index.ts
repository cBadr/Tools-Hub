import type { ToolDefinition, ToolCategory } from "./types";
import emailTrackerDef   from "../email-tracker/manifest";
import emailExtractorDef from "../email-extractor/manifest";
import proxyCheckerDef   from "../proxy-checker/manifest";

// Adding a new tool: create its folder and add one import line below.
export const toolRegistry: ToolDefinition[] = [
  emailTrackerDef,
  emailExtractorDef,
  proxyCheckerDef,
].filter((t) => t.isActive);

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return toolRegistry.find((t) => t.slug === slug);
}

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return toolRegistry.filter((t) => t.category === category);
}

export function getActiveTools(): ToolDefinition[] {
  return toolRegistry.filter((t) => t.isActive);
}

type GroupedTools = Partial<Record<ToolCategory, ToolDefinition[]>>;

export function getToolsGroupedByCategory(): GroupedTools {
  return toolRegistry.reduce<GroupedTools>((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category]!.push(tool);
    return acc;
  }, {});
}
