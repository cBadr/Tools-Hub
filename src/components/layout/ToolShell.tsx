"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Settings, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToolConfig } from "@/lib/hooks/useToolConfig";
import { createClientSupabase } from "@/lib/supabase/client";
import type { ToolDefinition } from "@/tools/_registry/types";

interface ToolShellProps {
  tool: ToolDefinition;
}

export function ToolShell({ tool }: ToolShellProps) {
  const { config, saveConfig, isPinned, isLoading } = useToolConfig(
    tool.slug,
    tool.defaultConfig
  );

  if (isLoading) return <ToolSkeleton />;

  const Component = tool.component;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Tool header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">{tool.name}</h1>
          <Badge className="text-[10px] px-2 bg-violet-600/20 text-violet-300 border-violet-500/30">
            v{tool.version}
          </Badge>
          {tool.isPro && (
            <Badge className="text-[10px] px-2 bg-amber-500/20 text-amber-300 border-amber-500/30">
              Pro
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <PinButton toolSlug={tool.slug} isPinned={isPinned} />
          {tool.settingsComponent && (
            <Button
              size="sm"
              asChild
              className="h-8 gap-1.5 text-slate-400 hover:text-slate-200 bg-transparent hover:bg-white/5 border-transparent shadow-none"
            >
              <Link href={`/tools/${tool.slug}/settings`}>
                <Settings className="w-3.5 h-3.5" />
                Settings
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Tool content */}
      <div className="flex-1 min-h-0">
        <Suspense fallback={<ToolSkeleton />}>
          <Component config={config} onConfigChange={saveConfig} />
        </Suspense>
      </div>
    </div>
  );
}

function PinButton({ toolSlug, isPinned }: { toolSlug: string; isPinned: boolean }) {
  const { mutate } = useToolConfig(toolSlug);
  const supabase = createClientSupabase();

  const toggle = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("tool_configs").upsert(
      { user_id: user.id, tool_slug: toolSlug, is_pinned: !isPinned },
      { onConflict: "user_id,tool_slug" }
    );
    mutate();
  };

  return (
    <Button
      size="icon"
      className="w-8 h-8 bg-transparent hover:bg-violet-500/10 border-transparent shadow-none text-slate-500 hover:text-violet-400"
      onClick={toggle}
      title={isPinned ? "Unpin from dashboard" : "Pin to dashboard"}
    >
      {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
    </Button>
  );
}

function ToolSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-40 bg-white/5" />
        <Skeleton className="h-5 w-12 bg-white/5" />
      </div>
      <Skeleton className="h-64 w-full bg-white/5 rounded-xl" />
    </div>
  );
}
