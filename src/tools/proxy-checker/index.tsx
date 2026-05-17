"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import useSWR from "swr";
import {
  Play, Trash2, Download, Layers, Settings2, RefreshCw, CheckSquare, XSquare, Filter, AlertCircle, CheckCircle2,
} from "lucide-react";
import { createClientSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FetchSourcesDialog } from "./components/FetchSourcesDialog";
import { ImportDialog } from "./components/ImportDialog";
import { ProxyTable, type ProxyRow } from "./components/ProxyTable";
import { CheckProgressWidget, type CheckProgress } from "./components/CheckProgressWidget";
import type { ParsedProxy, ProxyType } from "./lib/sources";
import type { ToolProps } from "./../_registry/types";

interface CheckSettings {
  testUrl: string;
  testKeyword: string;
  timeoutMs: number;
  concurrency: number;
}

export default function ProxyChecker({ config }: ToolProps) {
  const cfg = config as { defaultTestUrl?: string; defaultTestKeyword?: string; defaultTimeout?: number; defaultConcurrency?: number };

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType,   setFilterType]   = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<CheckSettings>({
    testUrl:    cfg.defaultTestUrl    ?? "https://www.google.com",
    testKeyword: cfg.defaultTestKeyword ?? "",
    timeoutMs:  (cfg.defaultTimeout   ?? 10) * 1000,
    concurrency: cfg.defaultConcurrency ?? 50,
  });

  const [checking,     setChecking]     = useState(false);
  const [checkProgress, setCheckProgress] = useState<CheckProgress | null>(null);
  const stopRef = useRef(false);

  const supabase = createClientSupabase();

  const { data: proxies, isLoading, mutate } = useSWR<ProxyRow[]>(
    "proxies_list",
    async () => {
      const { data } = await supabase.from("proxies").select("*").order("created_at", { ascending: false });
      return (data ?? []) as ProxyRow[];
    },
    { refreshInterval: checking ? 3000 : 0 },
  );

  const stats = useMemo(() => {
    const all = proxies ?? [];
    return {
      total:     all.length,
      live:      all.filter((r) => r.status === "live").length,
      dead:      all.filter((r) => r.status === "dead").length,
      unchecked: all.filter((r) => r.status === "unchecked").length,
    };
  }, [proxies]);

  // ── Save new proxies to DB ──────────────────────────────────────────────
  const saveProxies = async (parsed: ParsedProxy[]) => {
    if (parsed.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const rows = parsed.map((p) => ({
      user_id: user.id,
      type: p.type,
      host: p.host,
      port: p.port,
      status: "unchecked" as const,
    }));

    // Supabase PostgREST fails silently on large payloads — batch into chunks of 500
    const CHUNK = 500;
    let inserted = 0;
    let firstError: string | null = null;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("proxies")
        .upsert(chunk, { onConflict: "user_id,host,port,type", ignoreDuplicates: true });
      if (error) {
        firstError = error.message;
        break;
      }
      inserted += chunk.length;
    }

    if (firstError) {
      setSaveMsg({ type: "err", text: `Save failed: ${firstError}` });
    } else {
      setSaveMsg({ type: "ok", text: `${inserted.toLocaleString()} proxies imported` });
      setTimeout(() => setSaveMsg(null), 4000);
    }
    mutate();
  };

  // ── Selection helpers ───────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () => {
    const visible = (proxies ?? [])
      .filter((r) => (filterStatus === "all" || r.status === filterStatus) && (filterType === "all" || r.type === filterType))
      .map((r) => r.id);
    const allSelected = visible.every((id) => selected.has(id));
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visible));
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const deleteOne = async (id: string) => {
    await supabase.from("proxies").delete().eq("id", id);
    setSelected((p) => { const n = new Set(p); n.delete(id); return n; });
    mutate();
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected proxies?`)) return;
    await supabase.from("proxies").delete().in("id", [...selected]);
    setSelected(new Set());
    mutate();
  };

  const deleteDead = async () => {
    if (!confirm("Delete all dead proxies?")) return;
    await supabase.from("proxies").delete().eq("status", "dead");
    setSelected(new Set());
    mutate();
  };

  const deleteDuplicates = async () => {
    if (!confirm("Remove duplicate proxies (keep newest)?")) return;
    const all = proxies ?? [];
    const seen = new Map<string, string>();
    const toDelete: string[] = [];
    // Iterate from newest (first) to oldest
    for (const p of all) {
      const key = `${p.type}:${p.host}:${p.port}`;
      if (seen.has(key)) toDelete.push(seen.get(key)!);
      else seen.set(key, p.id);
    }
    if (toDelete.length > 0) {
      await supabase.from("proxies").delete().in("id", toDelete);
      mutate();
    }
  };

  // ── Checking ────────────────────────────────────────────────────────────
  const runCheck = useCallback(async (toCheck: ProxyRow[]) => {
    if (toCheck.length === 0 || checking) return;
    stopRef.current = false;
    setChecking(true);
    setCheckProgress({ total: toCheck.length, checked: 0, live: 0, dead: 0, status: "running" });

    const concurrency = Math.min(Math.max(settings.concurrency, 1), 100);
    let checked = 0, live = 0, dead = 0;

    for (let i = 0; i < toCheck.length && !stopRef.current; i += concurrency) {
      const batch = toCheck.slice(i, i + concurrency);

      const res = await fetch("/api/proxy-checker/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proxies: batch.map((p) => ({ id: p.id, type: p.type, host: p.host, port: p.port })),
          testUrl: settings.testUrl,
          testKeyword: settings.testKeyword || undefined,
          timeoutMs: settings.timeoutMs,
        }),
      });

      if (!res.ok) break;
      const data = await res.json();
      const results: Array<{ id: string; status: string; latencyMs?: number; jitterMs?: number; country?: string; countryCode?: string; city?: string; isp?: string; anonymity?: string }> = data.results ?? [];

      // Save results to DB
      for (const r of results) {
        await supabase.from("proxies").update({
          status: r.status,
          latency_ms: r.latencyMs ?? null,
          jitter_ms: r.jitterMs ?? null,
          country: r.country ?? null,
          country_code: r.countryCode ?? null,
          city: r.city ?? null,
          isp: r.isp ?? null,
          anonymity: r.anonymity ?? null,
          last_checked_at: new Date().toISOString(),
        }).eq("id", r.id);

        checked++;
        if (r.status === "live") live++;
        else dead++;
      }

      setCheckProgress({ total: toCheck.length, checked, live, dead, status: "running" });
      mutate();
    }

    setChecking(false);
    setCheckProgress((p) => p ? { ...p, status: stopRef.current ? "cancelled" : "completed" } : null);
    mutate();
  }, [checking, settings, supabase, mutate]);

  const checkSelected = () => {
    const toCheck = (proxies ?? []).filter((r) => selected.has(r.id));
    runCheck(toCheck);
  };

  const checkAll = () => {
    const all = proxies ?? [];
    runCheck(all.filter((r) => r.status !== "live")); // skip already live
  };

  const checkUnchecked = () => {
    runCheck((proxies ?? []).filter((r) => r.status === "unchecked"));
  };

  const checkOne = (proxy: ProxyRow) => runCheck([proxy]);

  // ── Export ──────────────────────────────────────────────────────────────
  const exportCSV = (onlyLive = false) => {
    const rows = (proxies ?? []).filter((r) => !onlyLive || r.status === "live");
    if (rows.length === 0) return;
    const header = ["Type", "Host", "Port", "Status", "Latency (ms)", "Jitter (ms)", "Country", "City", "ISP", "Anonymity", "Last Checked"];
    const lines = rows.map((r) => [
      r.type, r.host, r.port, r.status, r.latency_ms ?? "", r.jitter_ms ?? "",
      r.country ?? "", r.city ?? "", r.isp ?? "", r.anonymity ?? "",
      r.last_checked_at ? new Date(r.last_checked_at).toLocaleString() : "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `proxies-${onlyLive ? "live-" : ""}${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const isDone = checkProgress?.status === "completed" || checkProgress?.status === "cancelled";

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
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {saveMsg.text}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total",     value: stats.total,     color: "text-white" },
          { label: "Live",      value: stats.live,      color: "text-green-400" },
          { label: "Dead",      value: stats.dead,      color: "text-red-400" },
          { label: "Unchecked", value: stats.unchecked, color: "text-slate-500" },
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

        {/* Check dropdown */}
        <div className="flex items-center gap-1 glass rounded-lg px-1 py-1 border border-white/5">
          <Button size="sm" onClick={checkUnchecked} disabled={checking || stats.unchecked === 0}
            className="gap-1.5 bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-600 hover:to-emerald-600 text-white h-7 text-xs shadow-none">
            <Play className="w-3 h-3" /> Check Unchecked
          </Button>
          <Button size="sm" variant="ghost" onClick={checkAll} disabled={checking || stats.total === 0}
            title="Check all (re-check live too)" className="h-7 text-xs text-slate-400 hover:text-white hover:bg-white/5 px-2">
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
          disabled={stats.total === 0}
          className="gap-1.5 border-white/10 text-slate-300 hover:bg-white/5 h-8 text-xs">
          <Download className="w-3 h-3" /> Export All
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportCSV(true)}
          disabled={stats.live === 0}
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
          disabled={stats.dead === 0}
          className="gap-1.5 border-red-500/10 text-red-500/60 hover:bg-red-500/10 hover:text-red-400 h-8 text-xs">
          <XSquare className="w-3 h-3" /> Delete Dead
        </Button>
        <Button size="sm" variant="outline" onClick={deleteDuplicates}
          className="gap-1.5 border-white/10 text-slate-500 hover:bg-white/5 hover:text-white h-8 text-xs">
          <Layers className="w-3 h-3" /> Dedup
        </Button>

        <Button size="sm" variant="ghost" onClick={() => setShowSettings((v) => !v)}
          className={`h-8 text-xs gap-1.5 ${showSettings ? "text-violet-400" : "text-slate-500"} hover:text-white`}>
          <Settings2 className="w-3 h-3" /> Settings
        </Button>
      </div>

      {/* Check settings panel */}
      {showSettings && (
        <div className="glass rounded-xl p-4 space-y-3 border border-white/5">
          <p className="text-xs font-semibold text-white">Check Settings</p>
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
              <Label className="text-slate-500 text-[10px]">Concurrent (max 100)</Label>
              <Input type="number" min={1} max={100}
                value={settings.concurrency}
                onChange={(e) => setSettings((s) => ({ ...s, concurrency: Math.min(Number(e.target.value), 100) }))}
                className="bg-white/5 border-white/10 text-white text-xs h-7" />
            </div>
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
        <button onClick={() => mutate()} className="ml-auto text-slate-600 hover:text-slate-300 p-1">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg bg-white/5" />)}</div>
      ) : stats.total === 0 ? (
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
      {(checking || (checkProgress && !isDone)) && (
        <CheckProgressWidget
          progress={checkProgress}
          checking={checking}
          onStop={() => { stopRef.current = true; }}
          onDismiss={() => setCheckProgress(null)}
        />
      )}
      {isDone && checkProgress && (
        <CheckProgressWidget
          progress={checkProgress}
          checking={false}
          onStop={() => {}}
          onDismiss={() => setCheckProgress(null)}
        />
      )}
    </div>
  );
}
