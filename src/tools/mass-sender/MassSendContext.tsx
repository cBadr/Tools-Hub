"use client";

import {
  createContext, useContext, useRef, useState, useCallback, useMemo, type ReactNode,
} from "react";
import { createClientSupabase } from "@/lib/supabase/client";

export interface SendProgress {
  total: number;
  sent: number;
  failed: number;
  status: "running" | "completed" | "paused" | "cancelled";
  campaignId: string;
  campaignName: string;
}

interface MassSendContextValue {
  sending: boolean;
  progress: SendProgress | null;
  startSend: (campaignId: string, campaignName: string, total: number, rateLimitPerHour: number) => void;
  pauseSend: () => void;
  resumeSend: () => void;
  dismissProgress: () => void;
}

const MassSendContext = createContext<MassSendContextValue | null>(null);

export function MassSendProvider({ children }: { children: ReactNode }) {
  const [sending,  setSending]  = useState(false);
  const [progress, setProgress] = useState<SendProgress | null>(null);

  const stopRef       = useRef(false);
  const pauseRef      = useRef(false);
  const sendingRef    = useRef(false);
  const campaignIdRef = useRef<string>("");

  const supabase = useMemo(() => createClientSupabase(), []);

  const sendBatch = useCallback(
    async (campaignId: string, batchSize: number): Promise<{ sent: number; failed: number; remaining: number; paused?: boolean }> => {
      try {
        const res = await fetch("/api/mass-sender/send-batch", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ campaignId, batchSize }),
        });
        if (!res.ok) return { sent: 0, failed: 0, remaining: -1 };
        return await res.json() as { sent: number; failed: number; remaining: number; paused?: boolean };
      } catch {
        return { sent: 0, failed: 0, remaining: -1 };
      }
    },
    [],
  );

  const startSend = useCallback(
    async (campaignId: string, campaignName: string, total: number, rateLimitPerHour: number) => {
      if (sendingRef.current) return;

      sendingRef.current  = true;
      stopRef.current     = false;
      pauseRef.current    = false;
      campaignIdRef.current = campaignId;

      setSending(true);
      setProgress({ total, sent: 0, failed: 0, status: "running", campaignId, campaignName });

      // batchSize: how many to send per API call (keep small for IMAP thread lookup latency)
      const batchSize = 3;
      // Delay between batches to respect rate limit (ms per email × batchSize)
      const delayMs = rateLimitPerHour > 0
        ? Math.max((3600000 / rateLimitPerHour) * batchSize, 5000)
        : 10000;

      let totalSent = 0, totalFailed = 0;

      while (!stopRef.current) {
        if (pauseRef.current) {
          await new Promise<void>((res) => {
            const check = setInterval(() => {
              if (!pauseRef.current || stopRef.current) { clearInterval(check); res(); }
            }, 1000);
          });
          if (stopRef.current) break;
        }

        const result = await sendBatch(campaignId, batchSize);

        if (result.paused) {
          pauseRef.current = true;
          setProgress((p) => p ? { ...p, status: "paused" } : null);
          continue;
        }

        totalSent   += result.sent;
        totalFailed += result.failed;

        setProgress({ total, sent: totalSent, failed: totalFailed, status: "running", campaignId, campaignName });

        if (result.remaining === 0) break;
        if (result.remaining < 0)   break; // error

        await new Promise((res) => setTimeout(res, delayMs + Math.random() * 5000));
      }

      sendingRef.current = false;
      setSending(false);
      setProgress((p) =>
        p ? { ...p, status: stopRef.current ? "cancelled" : "completed" } : null,
      );
    },
    [sendBatch],
  );

  const pauseSend = useCallback(async () => {
    pauseRef.current = true;
    if (campaignIdRef.current) {
      await fetch("/api/mass-sender/pause", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ campaignId: campaignIdRef.current }),
      }).catch(() => {});
    }
    setProgress((p) => p ? { ...p, status: "paused" } : null);
  }, []);

  const resumeSend = useCallback(async () => {
    if (!campaignIdRef.current) return;
    pauseRef.current = false;
    await fetch("/api/mass-sender/resume", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ campaignId: campaignIdRef.current }),
    }).catch(() => {});
    setProgress((p) => p ? { ...p, status: "running" } : null);
  }, []);

  const dismissProgress = useCallback(() => {
    stopRef.current = true;
    setProgress(null);
  }, []);

  return (
    <MassSendContext.Provider value={{ sending, progress, startSend, pauseSend, resumeSend, dismissProgress }}>
      {children}
    </MassSendContext.Provider>
  );
}

export function useMassSend() {
  const ctx = useContext(MassSendContext);
  if (!ctx) throw new Error("useMassSend must be used within MassSendProvider");
  return ctx;
}
