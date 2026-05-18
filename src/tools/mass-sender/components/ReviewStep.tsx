"use client";

import { Users, Mail, Clock, Shield, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecipientRow } from "./RecipientStep";
import type { SenderSettings } from "./SenderStep";

interface Props {
  campaignName: string;
  subject: string;
  recipients: RecipientRow[];
  settings: SenderSettings;
  mode: "new" | "reply";
  launching: boolean;
  onLaunch: () => void;
}

export function ReviewStep({ campaignName, subject, recipients, settings, mode, launching, onLaunch }: Props) {
  const estHours = settings.rateLimitPerHour > 0
    ? (recipients.length / settings.rateLimitPerHour).toFixed(1)
    : "∞";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Users className="w-4 h-4 text-violet-400" />} label="Total recipients" value={recipients.length.toLocaleString()} />
        <StatCard icon={<Mail className="w-4 h-4 text-indigo-400" />} label="Send mode" value={mode === "reply" ? "Reply to thread" : "New email"} />
        <StatCard icon={<Clock className="w-4 h-4 text-blue-400" />} label="Estimated time" value={`~${estHours}h`} />
        <StatCard icon={<Shield className="w-4 h-4 text-green-400" />} label="Sending rate" value={`${settings.rateLimitPerHour} / hour`} />
      </div>

      <div className="rounded-xl border border-white/8 bg-white/2 px-4 py-3 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Campaign name</span>
          <span className="text-slate-300 font-medium truncate max-w-48">{campaignName}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Subject</span>
          <span className="text-slate-300 truncate max-w-48">{subject}</span>
        </div>
        {settings.useProxy && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Proxy</span>
            <span className="text-green-400">Enabled</span>
          </div>
        )}
        {mode === "reply" && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Search in</span>
            <span className="text-slate-300">{settings.threadSearchFolder === "custom" ? settings.threadCustomFolder : settings.threadSearchFolder}</span>
          </div>
        )}
      </div>

      <Button
        onClick={onLaunch}
        disabled={launching || recipients.length === 0 || !subject}
        className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold gap-2 shadow-lg shadow-violet-900/30 disabled:opacity-40"
      >
        {launching ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Creating campaign...
          </span>
        ) : (
          <>
            <Rocket className="w-4 h-4" />
            Launch Campaign
          </>
        )}
      </Button>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/2">
      {icon}
      <div className="min-w-0">
        <p className="text-[10px] text-slate-600 truncate">{label}</p>
        <p className="text-sm font-semibold text-slate-200 truncate">{value}</p>
      </div>
    </div>
  );
}
