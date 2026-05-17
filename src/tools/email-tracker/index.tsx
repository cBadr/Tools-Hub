"use client";

import { useState } from "react";
import useSWR from "swr";
import { Mail, AlertCircle } from "lucide-react";
import { createClientSupabase } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignCard } from "./components/CampaignCard";
import { CampaignDetail } from "./components/CampaignDetail";
import { CreateCampaignDialog } from "./components/CreateCampaignDialog";
import type { Campaign } from "@/types/email-tracker";
import type { ToolProps } from "./../_registry/types";

const BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? "";

export default function EmailTracker({ config, onConfigChange }: ToolProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const supabase = createClientSupabase();

  const { data: campaigns, isLoading, mutate } = useSWR(
    "email_campaigns",
    async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from("email_campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      return data ?? [];
    },
    { refreshInterval: 15000 }
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this campaign and all its tracking data? This cannot be undone.")) return;
    await supabase.from("email_campaigns").delete().eq("id", id);
    if (selectedCampaign?.id === id) setSelectedCampaign(null);
    mutate();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await supabase.from("email_campaigns").update({ is_active: isActive }).eq("id", id);
    mutate();
    if (selectedCampaign?.id === id) {
      setSelectedCampaign((prev) => prev ? { ...prev, is_active: isActive } : null);
    }
  };

  if (selectedCampaign) {
    // Find the latest version from cache
    const fresh = campaigns?.find((c) => c.id === selectedCampaign.id) ?? selectedCampaign;
    return (
      <CampaignDetail
        campaign={fresh}
        onBack={() => setSelectedCampaign(null)}
        baseUrl={BASE_URL}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 mt-0.5">
            Create tracking pixels and monitor email opens in real time
          </p>
        </div>
        <CreateCampaignDialog onCreated={() => mutate()} />
      </div>

      {/* Telegram warning if not configured */}
      {!(config as { notificationsEnabled?: boolean }).notificationsEnabled && (
        <div className="flex items-start gap-3 glass rounded-xl p-4 border border-amber-500/15">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-300">Telegram notifications not configured</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Go to <strong className="text-slate-400">Settings</strong> to add your Telegram bot token and start receiving instant open alerts.
            </p>
          </div>
        </div>
      )}

      {/* Campaigns grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 bg-white/5 rounded-xl" />)}
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-violet-600/10 border border-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-violet-400/60" />
          </div>
          <h3 className="text-sm font-semibold text-slate-400">No campaigns yet</h3>
          <p className="text-xs text-slate-600 mt-1 mb-4">Create your first campaign to start tracking</p>
          <CreateCampaignDialog onCreated={() => mutate()} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onSelect={setSelectedCampaign}
              onDelete={handleDelete}
              onToggle={handleToggle}
              baseUrl={BASE_URL}
            />
          ))}
        </div>
      )}
    </div>
  );
}
