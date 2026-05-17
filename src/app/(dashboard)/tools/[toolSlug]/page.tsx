import { notFound } from "next/navigation";
import { getToolBySlug, toolRegistry } from "@/tools/_registry";
import { ToolShell } from "@/components/layout/ToolShell";

interface Props {
  params: Promise<{ toolSlug: string }>;
}

export async function generateStaticParams() {
  return toolRegistry.map((tool) => ({ toolSlug: tool.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { toolSlug } = await params;
  const tool = getToolBySlug(toolSlug);
  if (!tool) return { title: "Tool Not Found" };
  return { title: `${tool.name} — Tools Hub` };
}

export default async function ToolPage({ params }: Props) {
  const { toolSlug } = await params;
  const tool = getToolBySlug(toolSlug);

  if (!tool || !tool.isActive) notFound();

  return <ToolShell tool={tool} />;
}
