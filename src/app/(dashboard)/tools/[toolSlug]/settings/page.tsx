"use client";

import { use, Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getToolBySlug } from "@/tools/_registry";
import { useToolConfig } from "@/lib/hooks/useToolConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ toolSlug: string }>;
}

export default function ToolSettingsPage({ params }: Props) {
  const { toolSlug } = use(params);
  const tool = getToolBySlug(toolSlug);

  if (!tool || !tool.settingsComponent) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="w-8 h-8 text-slate-400 hover:text-white">
          <Link href={`/tools/${toolSlug}`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white">{tool.name} Settings</h1>
          <p className="text-sm text-slate-500">Configure your {tool.name} preferences</p>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full bg-white/5 rounded-xl" />}>
        <ToolSettingsLoader tool={tool} />
      </Suspense>
    </div>
  );
}

function ToolSettingsLoader({ tool }: { tool: NonNullable<ReturnType<typeof getToolBySlug>> }) {
  const { config, saveConfig } = useToolConfig(tool.slug, tool.defaultConfig);
  const SettingsComponent = tool.settingsComponent!;

  const handleSave = async (newConfig: Record<string, unknown>) => {
    saveConfig(newConfig);
  };

  return <SettingsComponent config={config} onSave={handleSave} />;
}
