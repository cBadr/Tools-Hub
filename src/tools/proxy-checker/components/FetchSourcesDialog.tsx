"use client";

import { useState } from "react";
import { Download, Loader2, Globe, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROXY_SOURCES } from "../lib/sources";
import type { ParsedProxy, ProxyType } from "../lib/sources";

const TYPE_COLORS: Record<string, string> = {
  http:   "bg-sky-500/15 text-sky-400 border-sky-500/20",
  https:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  socks4: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  socks5: "bg-violet-500/15 text-violet-400 border-violet-500/20",
};

const GROUPS = [
  { label: "ProxyScrape",  keys: ["proxyscrape-http", "proxyscrape-socks4", "proxyscrape-socks5"] },
  { label: "TheSpeedX",    keys: ["speedx-http", "speedx-socks4", "speedx-socks5"] },
  { label: "Monosans",     keys: ["monosans-http", "monosans-socks4", "monosans-socks5"] },
  { label: "Others",       keys: ["clarketm-http", "hookzof-socks5"] },
];

interface Props {
  onFetched: (proxies: ParsedProxy[]) => void;
}

export function FetchSourcesDialog({ onFetched }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState("");
  const [customType, setCustomType] = useState<ProxyType>("http");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ ProxyScrape: true });
  const [error, setError] = useState<string | null>(null);

  const doFetch = async (sourceKey?: string, custom?: { url: string; type: ProxyType }) => {
    const key = sourceKey ?? `custom:${custom?.url}`;
    setLoading(key);
    setError(null);
    try {
      const res = await fetch("/api/proxy-checker/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceKey ? { sourceKey } : { customUrl: custom?.url, customType: custom?.type }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Fetch failed");
      onFetched(data.proxies);
      setOpen(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-900/20 h-8 text-xs">
          <Download className="w-3 h-3" /> Fetch Proxies
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f0f17] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">Fetch Proxies from Sources</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          {/* Built-in sources */}
          {GROUPS.map(({ label, keys }) => {
            const isOpen = expanded[label] ?? false;
            return (
              <div key={label} className="glass rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5"
                  onClick={() => setExpanded((p) => ({ ...p, [label]: !p[label] }))}>
                  <span className="text-xs font-semibold text-white">{label}</span>
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {keys.map((k) => {
                      const src = PROXY_SOURCES.find((s) => s.key === k);
                      if (!src) return null;
                      return (
                        <div key={k} className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${TYPE_COLORS[src.type]}`}>
                              {src.type.toUpperCase()}
                            </span>
                            <span className="text-xs text-slate-300">{src.label}</span>
                          </div>
                          <Button size="sm" variant="outline"
                            disabled={loading === k}
                            onClick={() => doFetch(k)}
                            className="h-6 text-[10px] border-white/10 text-slate-400 hover:bg-white/5 hover:text-white gap-1">
                            {loading === k ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            {loading === k ? "Fetching…" : "Fetch"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Custom URL */}
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-semibold text-white">Custom URL</span>
            </div>
            <div className="space-y-2">
              <Input placeholder="https://example.com/proxies.txt"
                value={customUrl} onChange={(e) => setCustomUrl(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 text-xs h-8" />
              <div className="flex items-center gap-2">
                <Label className="text-slate-500 text-[10px]">Type:</Label>
                <div className="flex gap-1.5">
                  {(["http", "https", "socks4", "socks5"] as ProxyType[]).map((t) => (
                    <button key={t} onClick={() => setCustomType(t)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${customType === t ? TYPE_COLORS[t] : "border-white/10 text-slate-600 hover:border-white/20"}`}>
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button size="sm" disabled={!customUrl.trim() || loading !== null}
              onClick={() => doFetch(undefined, { url: customUrl.trim(), type: customType })}
              className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white h-7 text-xs">
              {loading?.startsWith("custom:") ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Fetch
            </Button>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
