"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Play, Trash2, Download, Layers, Settings2, RefreshCw, CheckSquare, XSquare,
  Filter, AlertCircle, CheckCircle2, Zap,
} from "lucide-react";
import { createClientSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FetchSourcesDialog } from "./components/FetchSourcesDialog";
import { ImportDialog } from "./components/ImportDialog";
import { ProxyTable, type ProxyRow } from "./components/ProxyTable";
import { CheckProgressWidget } from "./components/CheckProgressWidget";
import { useProxyCheck, type CheckSettings } from "./CheckContext";
import type { ParsedProxy } from "./lib/sources";
import type { ToolProps } from "./../_registry/types";

export default function ProxyChecker({ config }: ToolProps) {
  const cfg = config as {
    defaultTestUrl?: string;
    defaultTestKeyword?: string;
    defaultTimeout?: number;
    defaultConcurrency?: number;
  };

  const { checking, progress, startCheck, stopCheck, dismissProgress } = useProxyCheck();

  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [saveMsg,       setSaveMsg]        = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [filterStatus,  setFilterStatus]   = useState("all");
  const [filterType,    setFilterType]     = useState("all");
  const [showSettings,  setShowSettings]   = useState(false);
  const [settings, setSettings] = useState<CheckSettings>({
    testUrl:       cfg.defaultTestUrl    ?? "https://www.google.com",
    testKeyword:   cfg.defaultTestKeyword ?? "",
    timeoutMs:     (cfg.defaultTimeout   ?? 10) * 1000,
    concurrency:   cfg.defaultConcurrency ?? 50,
    threads:       3,
    autoDeleteDead: false,
  });

  const supabase = createClientSupabase();

  // ── Proxy list (table data) ──────────────────────────────────────────────
  const { data: proxies, isLoading, mutate } = useSWR<ProxyRow[]>(
    "proxies_list",
    async () => {
      const { data } = await supabase
        .from("proxies")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 4999);
      return (data ?? []) as ProxyRow[];
    },
    { refreshInterval: checking ? 3000 : 0 },
  );

  // ── Accurate stats via count queries ────────────────────────────────────
  const { data: stats, mutate: mutateStats } = useSWR(
    "proxy_stats",
    async () => {
      const [total, live, dead, unchecked] = await Promise.all([
        supabase.from("proxies").select("*", { count: "exact", head: true }),
        supabase.from("proxies").select("*", { count: "exact", head: true }).eq("status", "live"),
        supabase.from("proxies").select("*", { count: "exact", head: true }).eq("status", "dead"),
        supabase.from("proxies").select("*", { count: "exact", head: true }).eq("status", "unchecked"),
      ]);
      return {
        total:     total.count     ?? 0,
        live:      live.count      ?? 0,
        dead:      dead.count      ?? 0,
        unchecked: unchecked.count ?? 0,
      };
    },
    { refreshInterval: checking ? 4000 : 30000 },
  );

  const safeStats = stats ?? { total: 0, live: 0, dead: 0, unchecked: 0 };

  const refreshAll = () => { mutate(); mutateStats(); };

  // ── Save new proxies to DB ───────────────────────────────────────────────
  const saveProxies = async (parsed: ParsedProxy[]) => {
    if (parsed.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const rows = parsed.map((p) => ({
      user_id: user.id,
      type:    p.type,
      host:    p.host,
      port:    p.port,
      status:  "unchecked" as const,
    }));

    const CHUNK = 500;
    let inserted = 0;
    let firstError: string | null = null;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase
        .from("proxies")
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "user_id,host,port,type", ignoreDuplicates: true });
      if (error) { firstError = error.message; break; }
      inserted += Math.min(CHUNK, rows.length - i);
    }

    if (firstError) {
      setSaveMsg({ type: "err", text: `Save failed: ${firstError}` });
    } else {
      setSaveMsg({ type: "ok", text: `${inserted.toLocaleString()} proxies imported` });
      setTimeout(() => setSaveMsg(null), 4000);
    }
    refreshAll();
  };

  // ── Selection helpers ────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () => {
    const visible = (proxies ?? [])
      .filter((r) => (filterStatus === "all" || r.status === filterStatus) && (filterType === "all" || r.type === filterType))
      .map((r) => r.id);
    const allSel = visible.every((id) => selected.has(id));
    setSelected(allSel ? new Set() : new Set(visible));
  };

  // ── Delete helpers ───────────────────────────────────────────────────────
  const deleteOne = async (id: string) => {
    await supabase.from("proxies").delete().eq("id", id);
    setSelected((p) => { const n = new Set(p); n.delete(id); return n; });
    refreshAll();
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected proxies?`)) return;
    await supabase.from("proxies").delete().in("id", [...selected]);
    setSelected(new Set());
    refreshAll();
  };

  const deleteDead = async () => {
    if (!confirm("Delete all dead proxies?")) return;
    await supabase.from("proxies").delete().eq("status", "dead");
    setSelected(new Set());
    refreshAll();
  };

  const deleteAll = async () => {
    if (!confirm(`Delete ALL ${safeStats.total.toLocaleString()} proxies? This cannot be undone.`)) return;
    // Delete in batches using user RLS
    await supabase.from("proxies").delete().in("status", ["unchecked", "live", "dead"]);
    setSelected(new Set());
    refreshAll();
  };

  const deleteDuplicates = async () => {
    if (!confirm("Remove duplicate proxies (keep newest)?")) return;
    const all = proxies ?? [];
    const seen = new Map<string, string>();
    const toDelete: string[] = [];
    for (const p of all) {
      const key = `${p.type}:${p.host}:${p.port}`;
      if (seen.has(key)) toDelete.push(seen.get(key)!);
      else seen.set(key, p.id);
    }
    if (toDelete.length > 0) {
      await supabase.from("proxies").delete().in("id", toDelete);
      refreshAll();
    }
  };

  // ── Check helpers (delegate to context) ─────────────────────────────────
  const toCheckItems = (rows: ProxyRow[]) =>
    rows.map((p) => ({ id: p.id, type: p.type, host: p.host, port: p.port }));

  const checkSelected  = () => startCheck(toCheckItems((proxies ?? []).filter((r) => selected.has(r.id))), settings);
  const checkAll       = () => startCheck(toCheckItems(proxies ?? []), settings);
  const checkUnchecked = () => startCheck(toCheckItems((proxies ?? []).filter((r) => r.status === "unchecked")), settings);
  const checkOne       = (proxy: ProxyRow) => startCheck(toCheckItems([proxy]), settings);

  // ── Export ───────────────────────────────────────────────────────────────
  const exportCSV = (onlyLive = false) => {
    const rows = (proxies ?? []).filter((r) => !onlyLive || r.status === "live");
    if (rows.length === 0) return;
    const header = ["Type","Host","Port","Status","Latency (ms)","Jitter (ms)","Country","City","ISP","Anonymity","Last Checked"];
    const lines = rows.map((r) => [
      r.type, r.host, r.port, r.status, r.latency_ms ?? "", r.jitter_ms ?? "",
      r.country ?? "", r.city ?? "", r.isp ?? "", r.anonymity ?? "",
      r.last_checked_at ? new Date(r.last_checked_at).toLocaleString() : "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv  = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `proxies-${onlyLive ? "live-" : ""}${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isDone = progress?.status === "completed" || progress?.status === "cancelled";

  return (
    <div className="space-y-5">
      {/* Save feedback banner */}
      {saveMsg && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${
          saveMsg.type === "ok"
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {saveMsg.type === "ok"
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle  className="w-4 h-4 flex-shrink-0" />}
          {saveMsg.text}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total",     value: safeStats.total,     color: "text-white" },
          { label: "Live",      value: safeStats.live,      color: "text-green-400" },
          { label: "Dead",      value: safeStats.dead,      color: "text-red-400" },
          { label: "Unchecked", value: safeStats.unchecked, color: "text-slate-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <FetchSourcesDialog onFetched={saveProxies} />
        <ImportDialog onImport={saveProxies} />

        {/* Check group */}
        <div className="flex items-center gap-1 glass rounded-lg px-1 py-1 border border-white/5">
          <Button size="sm" onClick={checkUnchecked} disabled={checking || safeStats.unchecked === 0}
            className="gap-1.5 bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-600 hover:to-emerald-600 text-white h-7 text-xs shadow-none">
            <Play className="w-3 h-3" /> Check Unchecked
          </Button>
          <Button size="sm" variant="ghost" onClick={checkAll} disabled={checking || safeStats.total === 0}
            title="Re-check all" className="h-7 text-xs text-slate-400 hover:text-white hover:bg-white/5 px-2">
            All
          </Button>
          {selected.size > 0 && (
            <Button size="sm" variant="ghost" onClick={checkSelected} disabled={checking}
              className="h-7 text-xs text-violet-400 hover:text-white hover:bg-white/5 px-2">
              Selected ({selected.size})
            </Button>
          )}
        </div>

        <div className="flex-1" />

        {/* Export */}
        <Button size="sm" variant="outline" onClick={() => exportCSV(false)}
          disabled={safeStats.total === 0}
          className="gap-1.5 border-white/10 text-slate-300 hover:bg-white/5 h-8 text-xs">
          <Download className="w-3 h-3" /> Export All
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportCSV(true)}
          disabled={safeStats.live === 0}
          className="gap-1.5 border-green-500/20 text-green-400 hover:bg-green-500/10 h-8 text-xs">
          <Download className="w-3 h-3" /> Live CSV
        </Button>

        {/* Bulk delete */}
        {selected.size > 0 && (
          <Button size="sm" variant="outline" onClick={deleteSelected}
            className="gap-1.5 border-red-500/20 text-red-400 hover:bg-red-500/10 h-8 text-xs">
            <Trash2 className="w-3 h-3" /> Delete ({selected.size})
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={deleteDead}
          disabled={safeStats.dead === 0}
          className="gap-1.5 border-red-500/10 text-red-500/60 hover:bg-red-500/10 hover:text-red-400 h-8 text-xs">
          <XSquare className="w-3 h-3" /> Delete Dead
        </Button>
        <Button size="sm" variant="outline" onClick={deleteDuplicates}
          className="gap-1.5 border-white/10 text-slate-500 hover:bg-white/5 hover:text-white h-8 text-xs">
          <Layers className="w-3 h-3" /> Dedup
        </Button>
        <Button size="sm" variant="outline" onClick={deleteAll}
          disabled={safeStats.total === 0}
          className="gap-1.5 border-red-500/30 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 h-8 text-xs">
          <Trash2 className="w-3 h-3" /> Delete All
        </Button>

        <Button size="sm" variant="ghost" onClick={() => setShowSettings((v) => !v)}
          className={`h-8 text-xs gap-1.5 ${showSettings ? "text-violet-400" : "text-slate-500"} hover:text-white`}>
          <Settings2 className="w-3 h-3" /> Settings
        </Button>
      </div>

      {/* Check settings panel */}
      {showSettings && (
        <div className="glass rounded-xl p-4 space-y-4 border border-white/5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white">Check Settings</p>
            <span className="text-[10px] text-slate-500">
              Max simultaneous:{" "}
              <span className="text-violet-400 font-semibold tabular-nums">
                {Math.min(settings.concurrency, 100) * Math.min(settings.threads, 10)}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-500 text-[10px]">Test URL</Label>
              <Input value={settings.testUrl}
                onChange={(e) => setSettings((s) => ({ ...s, testUrl: e.target.value }))}
                className="bg-white/5 border-white/10 text-white text-xs h-7" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-500 text-[10px]">Keyword (optional)</Label>
              <Input placeholder="e.g. Google"
                value={settings.testKeyword}
                onChange={(e) => setSettings((s) => ({ ...s, testKeyword: e.target.value }))}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-700 text-xs h-7" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-500 text-[10px]">Timeout (ms)</Label>
              <Input type="number" min={2000} max={30000} step={1000}
                value={settings.timeoutMs}
                onChange={(e) => setSettings((s) => ({ ...s, timeoutMs: Number(e.target.value) }))}
                className="bg-white/5 border-white/10 text-white text-xs h-7" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-500 text-[10px]">Per Thread (max 100)</Label>
              <Input type="number" min={1} max={100}
                value={settings.concurrency}
                onChange={(e) => setSettings((s) => ({ ...s, concurrency: Math.min(Number(e.target.value), 100) }))}
                className="bg-white/5 border-white/10 text-white text-xs h-7" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] flex items-center gap-1.5 text-violet-400/80">
                Threads <span className="text-[9px] text-slate-600 font-normal">parallel calls</span>
              </Label>
              <div className="flex gap-1">
                {[1, 2, 3, 5, 10].map((n) => (
                  <button key={n} onClick={() => setSettings((s) => ({ ...s, threads: n }))}
                    className={`flex-1 text-[11px] font-semibold py-1 rounded border transition-colors ${
                      settings.threads === n
                        ? "bg-violet-600/30 border-violet-500/40 text-violet-300"
                        : "border-white/10 text-slate-500 hover:border-white/20 hover:text-white"
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Auto-delete dead toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div>
              <p className="text-xs font-medium text-white">Auto-delete dead proxies</p>
              <p className="text-[10px] text-slate-600 mt-0.5">Immediately remove proxies that fail the check</p>
            </div>
            <button
              onClick={() => setSettings((s) => ({ ...s, autoDeleteDead: !s.autoDeleteDead }))}
              className={`relative w-9 h-5 rounded-full transition-colors ${settings.autoDeleteDead ? "bg-red-500/70" : "bg-white/10"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${settings.autoDeleteDead ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 glass rounded-lg px-2 py-1 border border-white/5">
          <Filter className="w-3 h-3 text-slate-600" />
          {["all", "unchecked", "live", "dead"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${filterStatus === s ? "bg-violet-600/30 text-violet-300" : "text-slate-500 hover:text-white"}`}>
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 glass rounded-lg px-2 py-1 border border-white/5">
          {["all", "http", "https", "socks4", "socks5"].map((t) => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${filterType === t ? "bg-violet-600/30 text-violet-300" : "text-slate-500 hover:text-white"}`}>
              {t === "all" ? "All Types" : t.toUpperCase()}
            </button>
          ))}
        </div>
        <button onClick={refreshAll} className="ml-auto text-slate-600 hover:text-slate-300 p-1">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg bg-white/5" />)}</div>
      ) : safeStats.total === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-600/10 flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-7 h-7 text-violet-400" />
          </div>
          <p className="text-white font-semibold mb-1">No proxies yet</p>
          <p className="text-sm text-slate-500">Fetch from a source or import your own list</p>
        </div>
      ) : (
        <ProxyTable
          proxies={proxies ?? []}
          selected={selected}
          onSelectToggle={toggleSelect}
          onSelectAll={toggleAll}
          onCheckOne={checkOne}
          onDeleteOne={deleteOne}
          filterStatus={filterStatus}
          filterType={filterType}
        />
      )}

      {/* Progress widget */}
      {(checking || (progress && !isDone)) && (
        <CheckProgressWidget
          progress={progress}
          checking={checking}
          onStop={stopCheck}
          onDismiss={dismissProgress}
        />
      )}
      {isDone && progress && (
        <CheckProgressWidget
          progress={progress}
          checking={false}
          onStop={() => {}}
          onDismiss={dismissProgress}
        />
      )}
    </div>
  );
}
