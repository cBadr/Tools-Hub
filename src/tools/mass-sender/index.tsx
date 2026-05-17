"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Send, Plus, Play, Pause, Trash2, CheckCircle2, XCircle, Clock,
  BarChart3, AlertCircle, RefreshCw,
} from "lucide-react";
import { createClientSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignWizard } from "./components/CampaignWizard";
import { useMassSend } from "./MassSendContext";
import { cn } from "@/lib/utils";
import type { MassCampaign } from "./lib/types";

const supabase = createClientSupabase();

function useCampaigns() {
  return useSWR<MassCampaign[]>("mass_campaigns", async () => {
    const { data } = await supabase
      .from("mass_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as MassCampaign[];
  }, { refreshInterval: 5000 });
}

function useStats() {
  return useSWR("mass_stats", async () => {
    const [totalRes, sentRes, runningRes] = await Promise.all([
      supabase.from("mass_campaigns").select("id", { count: "exact", head: true }),
      supabase.from("mass_recipients").select("id", { count: "exact", head: true }).eq("status", "sent"),
      supabase.from("mass_campaigns").select("id", { count: "exact", head: true }).eq("status", "running"),
    ]);
    return {
      campaigns: totalRes.count ?? 0,
      sent:      sentRes.count  ?? 0,
      running:   runningRes.count ?? 0,
    };
  }, { refreshInterval: 5000 });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:     { label: "مسودة",   color: "text-slate-400", icon: <Clock className="w-3 h-3" /> },
  running:   { label: "جارٍ",    color: "text-green-400",  icon: <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> },
  paused:    { label: "موقف",    color: "text-yellow-400", icon: <Pause className="w-3 h-3" /> },
  completed: { label: "مكتمل",  color: "text-violet-400", icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { label: "ملغي",   color: "text-red-400",    icon: <XCircle className="w-3 h-3" /> },
};

export default function MassSender() {
  const { data: campaigns, isLoading, mutate } = useCampaigns();
  const { data: stats } = useStats();
  const { sending, progress, startSend, pauseSend, resumeSend } = useMassSend();
  const [showWizard, setShowWizard] = useState(false);

  async function deleteCampaign(id: string) {
    if (!confirm("حذف هذه الحملة وجميع مستلميها؟")) return;
    await supabase.from("mass_campaigns").delete().eq("id", id);
    mutate();
  }

  async function resumeCampaign(campaign: MassCampaign) {
    await fetch("/api/mass-sender/resume", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ campaignId: campaign.id }),
    });
    startSend(campaign.id, campaign.name, campaign.total_recipients, campaign.rate_limit_per_hour);
    mutate();
  }

  async function pauseCampaign() {
    await pauseSend();
    mutate();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Send className="w-5 h-5 text-violet-400" />
            Mass Sender
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">إرسال إيميلات مخصصة بشكل احترافي</p>
        </div>
        <Button
          onClick={() => setShowWizard(true)}
          className="gap-2 bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30"
        >
          <Plus className="w-4 h-4" />
          حملة جديدة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "الحملات",   value: stats?.campaigns, icon: <BarChart3 className="w-4 h-4 text-violet-400" />, color: "from-violet-500/10" },
          { label: "إيميلات مُرسَلة", value: stats?.sent, icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, color: "from-green-500/10" },
          { label: "حملات نشطة", value: stats?.running, icon: <Send className="w-4 h-4 text-indigo-400" />, color: "from-indigo-500/10" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className={cn("rounded-xl border border-white/8 bg-gradient-to-br to-transparent p-4", color)}>
            <div className="flex items-center gap-2 mb-1">
              {icon}
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-100 tabular-nums">
              {value?.toLocaleString() ?? "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Active send progress (if running) */}
      {sending && progress && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", progress.status === "paused" ? "bg-yellow-400" : "bg-indigo-400 animate-pulse")} />
              <span className="text-sm font-semibold text-indigo-300">
                {progress.status === "paused" ? "الإرسال موقوف" : "الإرسال جارٍ"}: {progress.campaignName}
              </span>
            </div>
            <div className="flex gap-2">
              {progress.status === "running" ? (
                <Button size="sm" variant="outline" className="h-7 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" onClick={pauseCampaign}>
                  <Pause className="w-3 h-3 ml-1" /> إيقاف مؤقت
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                  onClick={() => { const c = campaigns?.find((x) => x.id === progress.campaignId); if (c) resumeCampaign(c); }}>
                  <Play className="w-3 h-3 ml-1" /> استئناف
                </Button>
              )}
            </div>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((progress.sent / progress.total) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 tabular-nums">
            <span className="text-green-400">{progress.sent.toLocaleString()} مُرسَل</span>
            <span>{progress.sent.toLocaleString()} / {progress.total.toLocaleString()}</span>
            <span className="text-red-400">{progress.failed} فشل</span>
          </div>
        </div>
      )}

      {/* Campaign list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">الحملات</h2>

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))
        ) : !campaigns?.length ? (
          <div className="rounded-xl border border-white/8 bg-white/2 py-16 text-center">
            <Send className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">لا توجد حملات بعد</p>
            <Button
              size="sm"
              className="mt-4 gap-1.5 bg-violet-600/80 hover:bg-violet-500 text-white"
              onClick={() => setShowWizard(true)}
            >
              <Plus className="w-3.5 h-3.5" /> أنشئ أول حملة
            </Button>
          </div>
        ) : (
          campaigns.map((c) => <CampaignCard key={c.id} campaign={c} onResume={() => resumeCampaign(c)} onDelete={() => deleteCampaign(c.id)} />)
        )}
      </div>

      {/* Wizard */}
      {showWizard && (
        <CampaignWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); mutate(); }}
        />
      )}
    </div>
  );
}

function CampaignCard({ campaign: c, onResume, onDelete }: { campaign: MassCampaign; onResume: () => void; onDelete: () => void }) {
  const status = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft;
  const pct = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0;

  return (
    <div className="rounded-xl border border-white/8 bg-white/2 p-4 hover:bg-white/3 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("flex items-center gap-1 text-[11px] font-medium", status.color)}>
              {status.icon} {status.label}
            </span>
            <span className="text-slate-600 text-[10px]">·</span>
            <span className="text-[10px] text-slate-600">
              {new Date(c.created_at).toLocaleDateString("ar-SA")}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-200 truncate">{c.name}</h3>
          <p className="text-xs text-slate-500 truncate mt-0.5">{c.subject}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {c.status === "paused" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-green-400/70 hover:text-green-400 hover:bg-green-500/10" onClick={onResume}>
              <Play className="w-3 h-3" />
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-red-400/40 hover:text-red-400 hover:bg-red-500/10" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 space-y-1">
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500",
              c.status === "completed" ? "bg-violet-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 tabular-nums">
          <span className="text-green-500">{c.sent_count.toLocaleString()} مُرسَل</span>
          <span>{pct}%</span>
          {c.failed_count > 0 && <span className="text-red-400">{c.failed_count} فشل</span>}
          <span>{c.total_recipients.toLocaleString()} إجمالي</span>
        </div>
      </div>
    </div>
  );
}
