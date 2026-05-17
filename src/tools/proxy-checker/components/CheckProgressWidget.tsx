"use client";

import { useState } from "react";
import { Loader2, X, Square, ChevronDown, ChevronUp, CheckCircle2, ShieldCheck } from "lucide-react";

export interface CheckProgress {
  total: number;
  checked: number;
  live: number;
  dead: number;
  status: "running" | "completed" | "cancelled";
  currentBatch?: string;
}

interface Props {
  progress: CheckProgress | null;
  checking: boolean;
  onStop: () => void;
  onDismiss: () => void;
}

export function CheckProgressWidget({ progress, checking, onStop, onDismiss }: Props) {
  const [minimized, setMinimized] = useState(false);
  const isDone = progress?.status === "completed" || progress?.status === "cancelled";
  const pct = progress && progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-72 rounded-2xl shadow-2xl shadow-black/40 border border-white/10 bg-[#13131f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        {checking && !isDone
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400 flex-shrink-0" />
          : isDone && progress?.status === "completed"
          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          : <ShieldCheck className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white">Proxy Check</p>
          <p className="text-[10px] text-slate-500">
            {isDone
              ? progress?.status === "completed" ? "Check complete" : "Check cancelled"
              : `Checking ${progress?.checked ?? 0} / ${progress?.total ?? 0}…`}
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

      {!minimized && (
        <div className="px-4 py-3 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-base font-bold text-white tabular-nums">{progress?.checked ?? 0}</div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wide">Checked</div>
            </div>
            <div>
              <div className="text-base font-bold text-green-400 tabular-nums">{progress?.live ?? 0}</div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wide">Live</div>
            </div>
            <div>
              <div className="text-base font-bold text-red-400 tabular-nums">{progress?.dead ?? 0}</div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wide">Dead</div>
            </div>
          </div>

          {/* Progress bar */}
          {checking && !isDone && (
            <div className="space-y-1">
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-600 text-right">{pct}%</p>
            </div>
          )}

          {checking && !isDone && (
            <button onClick={onStop}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors">
              <Square className="w-3 h-3 fill-current" /> Stop
            </button>
          )}
        </div>
      )}
    </div>
  );
}
