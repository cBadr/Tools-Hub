"use client";

import { Mail, Phone, Clock, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, formatDateTime } from "@/lib/utils";
import type { ExtractionJob } from "@/types/email-extractor-tool";

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "bg-slate-500/15 text-slate-400 border-slate-500/20",  icon: Clock },
  running:   { label: "Running",   color: "bg-blue-500/15 text-blue-400 border-blue-500/20",     icon: Loader2 },
  completed: { label: "Completed", color: "bg-green-500/15 text-green-400 border-green-500/20",  icon: CheckCircle },
  failed:    { label: "Failed",    color: "bg-red-500/15 text-red-400 border-red-500/20",        icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-slate-500/15 text-slate-400 border-slate-500/20", icon: AlertCircle },
};

interface Props {
  job: ExtractionJob;
  accountLabel: string;
  onSelect: (job: ExtractionJob) => void;
}

export function JobCard({ job, accountLabel, onSelect }: Props) {
  const s = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const Icon = s.icon;
  const progress = job.messages_scanned > 0
    ? Math.min(100, Math.round((job.messages_scanned / job.max_messages) * 100))
    : 0;

  return (
    <div
      onClick={() => onSelect(job)}
      className="glass rounded-xl p-4 cursor-pointer hover:border-violet-500/30 hover:bg-violet-500/5 transition-all space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{accountLabel}</p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            {job.folders ? job.folders.join(", ") : "All folders"} · {formatRelativeTime(job.created_at)}
          </p>
        </div>
        <Badge className={`text-[10px] px-1.5 shrink-0 flex items-center gap-1 ${s.color}`}>
          <Icon className={`w-2.5 h-2.5 ${job.status === "running" ? "animate-spin" : ""}`} />
          {s.label}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat icon={<Mail className="w-3 h-3 text-slate-500" />} label="Scanned" value={job.messages_scanned} />
        <Stat icon={<Mail className="w-3 h-3 text-violet-400" />} label="Emails" value={job.emails_found} />
        <Stat icon={<Phone className="w-3 h-3 text-cyan-400" />} label="Phones" value={job.phones_found} />
      </div>

      {job.status === "running" && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>{job.messages_scanned.toLocaleString()} / {job.max_messages.toLocaleString()}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {job.error && (
        <p className="text-[10px] text-red-400 bg-red-500/10 rounded-md px-2 py-1 truncate">{job.error}</p>
      )}

      {job.completed_at && (
        <p className="text-[10px] text-slate-700">Completed {formatRelativeTime(job.completed_at)}</p>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">{icon}<span className="font-semibold text-sm text-white">{value.toLocaleString()}</span></div>
      <span className="text-[10px] text-slate-600">{label}</span>
    </div>
  );
}
