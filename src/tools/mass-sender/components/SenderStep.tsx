"use client";

import { useState } from "react";
import { Shield, Clock, Folder, ToggleLeft, ToggleRight, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import useSWR from "swr";
import { createClientSupabase } from "@/lib/supabase/client";

export interface SenderSettings {
  rateLimitPerHour: number;
  useProxy: boolean;
  threadSearchFolder: string;
  threadCustomFolder: string;
  addRePrefix: boolean;
}

interface Props {
  mode: "new" | "reply";
  settings: SenderSettings;
  onChange: (s: SenderSettings) => void;
}

const supabase = createClientSupabase();

function useLiveProxyCount() {
  return useSWR("live_proxies_count", async () => {
    const { count } = await supabase
      .from("proxies")
      .select("id", { count: "exact", head: true })
      .eq("status", "live");
    return count ?? 0;
  });
}

const FOLDERS = [
  { value: "all",   label: "All folders" },
  { value: "INBOX", label: "INBOX" },
  { value: "SENT",  label: "SENT" },
  { value: "custom", label: "Custom folder..." },
];

export function SenderStep({ mode, settings, onChange }: Props) {
  const { data: liveCount = 0 } = useLiveProxyCount();
  const s = settings;
  const set = (partial: Partial<SenderSettings>) => onChange({ ...s, ...partial });

  const estimatedHours = s.rateLimitPerHour > 0 ? Math.ceil(100 / s.rateLimitPerHour) : "∞";

  return (
    <div className="space-y-5">
      {/* Rate limit */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-slate-200">Sending Rate</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={s.rateLimitPerHour}
            onChange={(e) => set({ rateLimitPerHour: Number(e.target.value) })}
            className="flex-1 accent-violet-500"
          />
          <div className="w-24 text-center">
            <span className="text-lg font-bold text-violet-300">{s.rateLimitPerHour}</span>
            <span className="text-xs text-slate-500"> / hour</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-600">
          Random 30–90s delay between sends · Estimated time for 100 emails: ~{estimatedHours}h
        </p>
      </div>

      {/* Proxy */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/2">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-sm text-slate-300">Use active proxies</p>
            <p className="text-[11px] text-slate-600">
              {liveCount} live {liveCount === 1 ? "proxy" : "proxies"} available
              {liveCount === 0 ? " — check Proxy Checker tool" : ""}
            </p>
          </div>
        </div>
        <Switch
          checked={s.useProxy}
          onCheckedChange={(v) => set({ useProxy: v })}
          disabled={liveCount === 0}
        />
      </div>

      {/* Thread settings (only when mode=reply) */}
      {mode === "reply" && (
        <div className="space-y-3 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-indigo-300">Thread Search Settings</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400">Search in folder</label>
            <div className="grid grid-cols-2 gap-2">
              {FOLDERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => set({ threadSearchFolder: f.value })}
                  className={`px-3 py-2 rounded-lg text-xs border transition-all text-left ${
                    s.threadSearchFolder === f.value
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                      : "bg-white/3 border-white/8 text-slate-400 hover:text-slate-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {s.threadSearchFolder === "custom" && (
              <Input
                value={s.threadCustomFolder}
                onChange={(e) => set({ threadCustomFolder: e.target.value })}
                placeholder="Folder name (e.g. Work/Projects)"
                className="h-8 text-xs bg-white/3 border-white/8 mt-2"
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-slate-400">Auto-prepend "Re:" to subject</Label>
            <Switch checked={s.addRePrefix} onCheckedChange={(v) => set({ addRePrefix: v })} />
          </div>
        </div>
      )}
    </div>
  );
}
