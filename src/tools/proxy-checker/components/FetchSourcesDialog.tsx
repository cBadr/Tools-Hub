"use client";

import { useState, useMemo } from "react";
import { Download, Loader2, Globe, CheckSquare, Square, Minus } from "lucide-react";
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

const ALL_KEYS = GROUPS.flatMap((g) => g.keys);

type SourceStatus = "idle" | "loading" | "done" | "error";

interface Props {
  onFetched: (proxies: ParsedProxy[]) => void;
}

export function FetchSourcesDialog({ onFetched }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, SourceStatus>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customType, setCustomType] = useState<ProxyType>("http");
  const [customStatus, setCustomStatus] = useState<SourceStatus>("idle");
  const [customError, setCustomError] = useState<string | null>(null);

  const totalSelected = selected.size + (customUrl.trim() ? 1 : 0);
  const totalFetched = Object.values(counts).reduce((a, b) => a + b, 0);

  const toggleSource = (key: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const toggleGroup = (keys: string[]) => {
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const n = new Set(prev);
      if (allOn) keys.forEach((k) => n.delete(k));
      else keys.forEach((k) => n.add(k));
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === ALL_KEYS.length) setSelected(new Set());
    else setSelected(new Set(ALL_KEYS));
  };

  const groupState = (keys: string[]): "all" | "some" | "none" => {
    const on = keys.filter((k) => selected.has(k)).length;
    if (on === 0) return "none";
    if (on === keys.length) return "all";
    return "some";
  };

  const resetState = () => {
    setStatuses({});
    setCounts({});
    setErrors({});
    setCustomStatus("idle");
    setCustomError(null);
  };

  const fetchOne = async (sourceKey: string): Promise<ParsedProxy[]> => {
    setStatuses((p) => ({ ...p, [sourceKey]: "loading" }));
    try {
      const res = await fetch("/api/proxy-checker/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStatuses((p) => ({ ...p, [sourceKey]: "done" }));
      setCounts((p) => ({ ...p, [sourceKey]: data.proxies.length }));
      return data.proxies as ParsedProxy[];
    } catch (e) {
      setStatuses((p) => ({ ...p, [sourceKey]: "error" }));
      setErrors((p) => ({ ...p, [sourceKey]: String(e) }));
      return [];
    }
  };

  const fetchCustom = async (): Promise<ParsedProxy[]> => {
    const url = customUrl.trim();
    if (!url) return [];
    setCustomStatus("loading");
    setCustomError(null);
    try {
      const res = await fetch("/api/proxy-checker/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customUrl: url, customType }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCustomStatus("done");
      setCounts((p) => ({ ...p, _custom: data.proxies.length }));
      return data.proxies as ParsedProxy[];
    } catch (e) {
      setCustomStatus("error");
      setCustomError(String(e));
      return [];
    }
  };

  const handleFetchSelected = async () => {
    if (fetching) return;
    resetState();
    setFetching(true);

    const keys = [...selected];
    const hasCustom = customUrl.trim().length > 0;

    // Fetch all sources concurrently
    const [sourceResults, customResult] = await Promise.all([
      Promise.all(keys.map(fetchOne)),
      hasCustom ? fetchCustom() : Promise.resolve([] as ParsedProxy[]),
    ]);

    const all: ParsedProxy[] = [...sourceResults.flat(), ...customResult];
    setFetching(false);

    if (all.length > 0) {
      onFetched(all);
    }
  };

  const statusIcon = (key: string) => {
    const s = statuses[key];
    if (s === "loading") return <Loader2 className="w-3 h-3 animate-spin text-violet-400" />;
    if (s === "done") return <span className="text-[10px] text-green-400 font-mono tabular-nums">+{(counts[key] ?? 0).toLocaleString()}</span>;
    if (s === "error") return <span className="text-[10px] text-red-400">error</span>;
    return null;
  };

  const allOn = selected.size === ALL_KEYS.length;
  const someOn = selected.size > 0 && selected.size < ALL_KEYS.length;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-900/20 h-8 text-xs">
          <Download className="w-3 h-3" /> Fetch Proxies
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f0f17] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">Fetch Proxies from Sources</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1 max-h-[65vh] overflow-y-auto pr-1">

          {/* Select All row */}
          <div className="flex items-center justify-between px-1">
            <button onClick={toggleAll} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white">
              {allOn ? (
                <CheckSquare className="w-4 h-4 text-violet-400" />
              ) : someOn ? (
                <Minus className="w-4 h-4 text-violet-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
              Select All Sources
            </button>
            {selected.size > 0 && (
              <span className="text-[10px] text-slate-500">{selected.size} selected</span>
            )}
          </div>

          {/* Source groups */}
          {GROUPS.map(({ label, keys }) => {
            const gState = groupState(keys);
            return (
              <div key={label} className="glass rounded-xl overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                  <button onClick={() => toggleGroup(keys)} className="flex items-center gap-2">
                    {gState === "all" ? (
                      <CheckSquare className="w-3.5 h-3.5 text-violet-400" />
                    ) : gState === "some" ? (
                      <Minus className="w-3.5 h-3.5 text-violet-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600" />
                    )}
                    <span className="text-xs font-semibold text-white">{label}</span>
                  </button>
                </div>

                {/* Sources */}
                <div className="px-2 py-1.5 space-y-0.5">
                  {keys.map((k) => {
                    const src = PROXY_SOURCES.find((s) => s.key === k);
                    if (!src) return null;
                    const isOn = selected.has(k);
                    return (
                      <button
                        key={k}
                        onClick={() => toggleSource(k)}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${isOn ? "bg-violet-600/10" : "hover:bg-white/5"}`}
                      >
                        {isOn
                          ? <CheckSquare className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                          : <Square className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />}
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 ${TYPE_COLORS[src.type]}`}>
                          {src.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-300 flex-1 text-left">{src.label}</span>
                        <span className="flex-shrink-0">{statusIcon(k)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Custom URL */}
          <div className="glass rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-semibold text-white">Custom URL</span>
              {customStatus === "loading" && <Loader2 className="w-3 h-3 animate-spin text-violet-400 ml-auto" />}
              {customStatus === "done" && <span className="text-[10px] text-green-400 font-mono ml-auto">+{(counts._custom ?? 0).toLocaleString()}</span>}
              {customStatus === "error" && <span className="text-[10px] text-red-400 ml-auto">error</span>}
            </div>
            <Input
              placeholder="https://example.com/proxies.txt"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              disabled={fetching}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 text-xs h-8"
            />
            <div className="flex items-center gap-2">
              <Label className="text-slate-500 text-[10px]">Type:</Label>
              <div className="flex gap-1.5">
                {(["http", "https", "socks4", "socks5"] as ProxyType[]).map((t) => (
                  <button
                    key={t}
                    disabled={fetching}
                    onClick={() => setCustomType(t)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${customType === t ? TYPE_COLORS[t] : "border-white/10 text-slate-600 hover:border-white/20"}`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {customError && (
              <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">{customError}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div className="text-xs text-slate-500">
            {fetching
              ? `Fetching… ${totalFetched.toLocaleString()} found so far`
              : totalFetched > 0
                ? `${totalFetched.toLocaleString()} proxies fetched`
                : totalSelected > 0
                  ? `${totalSelected} source${totalSelected > 1 ? "s" : ""} selected`
                  : "Select sources to fetch"}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={fetching}
              className="h-7 text-xs text-slate-500 hover:text-white">
              {totalFetched > 0 ? "Close" : "Cancel"}
            </Button>
            <Button
              size="sm"
              disabled={fetching || totalSelected === 0}
              onClick={handleFetchSelected}
              className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white h-7 text-xs"
            >
              {fetching
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Fetching…</>
                : <><Download className="w-3 h-3" /> Fetch {totalSelected > 0 ? `(${totalSelected})` : ""}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
