"use client";

import { useState } from "react";
import { Loader2, X, Square, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";

export interface ScanProgress {
  totalScanned: number;
  totalEmails: number;
  totalPhones: number;
  currentFolder: string;
  folderProgress: string;
  status: "running" | "completed" | "failed" | "cancelled";
  error?: string;
}

interface Props {
  accountLabel: string;
  progress: ScanProgress | null;
  scanning: boolean;
  onStop: () => void;
  onDismiss: () => void;
}

export function ScanStatusWidget({ accountLabel, progress, scanning, onStop, onDismiss }: Props) {
  const [minimized, setMinimized] = useState(false);
  const isDone = progress?.status === "completed" || progress?.status === "failed" || progress?.status === "cancelled";

  return (
    <div className="fixed bottom-5 right-5 z-50 w-72 rounded-2xl shadow-2xl shadow-black/40 border border-white/10 bg-[#13131f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        {scanning && !isDone
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400 flex-shrink-0" />
          : isDone && progress?.status === "completed"
          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          : <Square className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{accountLabel}</p>
          <p className="text-[10px] text-slate-500">
            {isDone
              ? progress?.status === "completed" ? "Scan complete" : `Scan ${progress?.status}`
              : "Scanning in progress…"}
          </p>
        </div>

        <button onClick={() => setMinimized((v) => !v)} className="text-slate-600 hover:text-slate-300 p-0.5">
          {minimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {isDone && (
          <button onClick={onDismiss} className="text-slate-600 hover:text-slate-300 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      {!minimized && (
        <div className="px-4 py-3 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Scanned" value={progress?.totalScanned ?? 0} />
            <Stat label="Emails"  value={progress?.totalEmails  ?? 0} color="text-violet-400" />
            <Stat label="Phones"  value={progress?.totalPhones  ?? 0} color="text-cyan-400" />
          </div>

          {/* Current folder */}
          {progress?.currentFolder && !isDone && (
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-600 truncate flex-1">
                {progress.currentFolder}
              </p>
              {progress.folderProgress && (
                <span className="text-[10px] text-slate-700 ml-2 flex-shrink-0">
                  {progress.folderProgress}
                </span>
              )}
            </div>
          )}

          {/* Progress bar */}
          {scanning && !isDone && (
            <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full animate-pulse w-full" />
            </div>
          )}

          {/* Error */}
          {progress?.error && (
            <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5 truncate">
              {progress.error}
            </p>
          )}

          {/* Actions */}
          {scanning && !isDone && (
            <button onClick={onStop}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors">
              <Square className="w-3 h-3 fill-current" /> Stop Scan
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = "text-white" }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className={`text-base font-bold tabular-nums ${color}`}>{value.toLocaleString()}</div>
      <div className="text-[9px] text-slate-600 uppercase tracking-wide">{label}</div>
    </div>
  );
}
