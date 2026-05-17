"use client";

import {
  createContext, useContext, useRef, useState, useCallback, useMemo, type ReactNode,
} from "react";
import { createClientSupabase } from "@/lib/supabase/client";

export interface CheckProgress {
  total: number;
  checked: number;
  live: number;
  dead: number;
  status: "running" | "completed" | "cancelled";
}

export interface CheckSettings {
  testUrl: string;
  testKeyword: string;
  timeoutMs: number;
  concurrency: number;
  threads: number;
  autoDeleteDead: boolean;
}

export interface ProxyCheckItem {
  id: string;
  type: string;
  host: string;
  port: number;
}

type BatchResult = {
  id: string;
  status: string;
  latencyMs?: number;
  jitterMs?: number;
  country?: string;
  countryCode?: string;
  city?: string;
  isp?: string;
  anonymity?: string;
};

interface ProxyCheckContextValue {
  checking: boolean;
  progress: CheckProgress | null;
  startCheck: (proxies: ProxyCheckItem[], settings: CheckSettings) => void;
  stopCheck: () => void;
  dismissProgress: () => void;
}

const ProxyCheckContext = createContext<ProxyCheckContextValue | null>(null);

export function ProxyCheckProvider({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<CheckProgress | null>(null);

  // Refs so async loops always read the latest values without stale closures
  const stopRef     = useRef(false);
  const checkingRef = useRef(false);

  // Stable supabase client — never recreated across renders
  const supabase = useMemo(() => createClientSupabase(), []);

  const fetchBatch = useCallback(
    async (batch: ProxyCheckItem[], settings: CheckSettings): Promise<BatchResult[]> => {
      try {
        const res = await fetch("/api/proxy-checker/check", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            proxies:     batch,
            testUrl:     settings.testUrl,
            testKeyword: settings.testKeyword || undefined,
            timeoutMs:   settings.timeoutMs,
          }),
        });
        if (!res.ok) return [];
        const data = await res.json() as { results?: BatchResult[] };
        return data.results ?? [];
      } catch {
        return [];
      }
    },
    [], // no deps — all inputs are parameters
  );

  const startCheck = useCallback(
    async (proxies: ProxyCheckItem[], settings: CheckSettings) => {
      if (proxies.length === 0 || checkingRef.current) return;

      checkingRef.current = true;
      stopRef.current     = false;
      setChecking(true);
      setProgress({ total: proxies.length, checked: 0, live: 0, dead: 0, status: "running" });

      const batchSize = Math.min(Math.max(settings.concurrency, 1), 100);
      const threads   = Math.min(Math.max(settings.threads,     1), 10);
      const waveSize  = batchSize * threads;
      const checkedAt = new Date().toISOString();
      let checked = 0, live = 0, dead = 0;

      for (let i = 0; i < proxies.length && !stopRef.current; i += waveSize) {
        // Build `threads` batches for this wave
        const batches: ProxyCheckItem[][] = [];
        for (let t = 0; t < threads; t++) {
          const slice = proxies.slice(i + t * batchSize, i + (t + 1) * batchSize);
          if (slice.length > 0) batches.push(slice);
        }

        // Fire all batches in parallel
        const waveResults  = await Promise.all(batches.map((b) => fetchBatch(b, settings)));
        const allResults   = waveResults.flat();
        const liveResults  = allResults.filter((r) => r.status === "live");
        const deadResults  = allResults.filter((r) => r.status === "dead");

        if (liveResults.length > 0) {
          await Promise.all(
            liveResults.map((r) =>
              supabase.from("proxies").update({
                status:          "live",
                latency_ms:      r.latencyMs      ?? null,
                jitter_ms:       r.jitterMs       ?? null,
                country:         r.country        ?? null,
                country_code:    r.countryCode    ?? null,
                city:            r.city           ?? null,
                isp:             r.isp            ?? null,
                anonymity:       r.anonymity      ?? null,
                last_checked_at: checkedAt,
              }).eq("id", r.id),
            ),
          );
        }

        if (deadResults.length > 0) {
          if (settings.autoDeleteDead) {
            await supabase.from("proxies").delete().in("id", deadResults.map((r) => r.id));
          } else {
            await Promise.all(
              deadResults.map((r) =>
                supabase.from("proxies").update({ status: "dead", last_checked_at: checkedAt }).eq("id", r.id),
              ),
            );
          }
        }

        checked += allResults.length;
        live    += liveResults.length;
        dead    += deadResults.length;

        setProgress({ total: proxies.length, checked, live, dead, status: "running" });
      }

      checkingRef.current = false;
      setChecking(false);
      setProgress((p) =>
        p ? { ...p, status: stopRef.current ? "cancelled" : "completed" } : null,
      );
    },
    [fetchBatch, supabase], // no 'checking' in deps — use checkingRef instead
  );

  const stopCheck       = useCallback(() => { stopRef.current = true; }, []);
  const dismissProgress = useCallback(() => setProgress(null), []);

  return (
    <ProxyCheckContext.Provider value={{ checking, progress, startCheck, stopCheck, dismissProgress }}>
      {children}
    </ProxyCheckContext.Provider>
  );
}

export function useProxyCheck() {
  const ctx = useContext(ProxyCheckContext);
  if (!ctx) throw new Error("useProxyCheck must be used within ProxyCheckProvider");
  return ctx;
}
