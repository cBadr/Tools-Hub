"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Trash2, RefreshCw, Mail, CheckCircle2, AlertCircle, Download, Layers } from "lucide-react";
import { createClientSupabase } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { ScanDialog, type ScanConfig } from "./components/ScanDialog";
import { ScanStatusWidget, type ScanProgress } from "./components/ScanStatusWidget";
import { JobCard } from "./components/JobCard";
import { ContactsTable } from "./components/ContactsTable";
import type { EmailAccount, ExtractionJob } from "@/types/email-extractor-tool";
import type { ToolProps } from "./../_registry/types";

export default function EmailExtractor({ config }: ToolProps) {
  const [selectedJob, setSelectedJob] = useState<(ExtractionJob & { accountLabel: string }) | null>(null);
  const [accountFolders, setAccountFolders] = useState<Record<string, string[]>>({});
  const [oauthBanner, setOauthBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [deletingDupes, setDeletingDupes] = useState(false);

  // Scan state (lifted from ScanDialog)
  const [activeScan, setActiveScan] = useState<{ jobId: string; accountLabel: string } | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanning, setScanning] = useState(false);
  const stopRef = useRef(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClientSupabase();

  useEffect(() => {
    const oauth    = searchParams.get("oauth");
    const error    = searchParams.get("error");
    const provider = searchParams.get("provider");
    if (oauth === "success") {
      setOauthBanner({ type: "success", msg: `${provider === "gmail" ? "Gmail" : "Outlook"} account connected successfully.` });
      router.replace(window.location.pathname);
    } else if (error) {
      const msgs: Record<string, string> = {
        oauth_denied: "OAuth access was denied.",
        invalid_state: "Security check failed. Please try again.",
        token_exchange_failed: "Failed to get access token from provider.",
        no_email: "Could not retrieve email address from provider.",
        db_error: "Account saved but encountered a database error.",
      };
      setOauthBanner({ type: "error", msg: msgs[error] ?? `OAuth error: ${error}` });
      router.replace(window.location.pathname);
    }
  }, [searchParams, router]);

  const { data: accounts, isLoading: accLoading, mutate: refetchAccounts } = useSWR(
    "email_accounts",
    async () => {
      const { data } = await supabase.from("email_accounts").select("*").order("created_at");
      return (data ?? []) as EmailAccount[];
    }
  );

  const { data: jobs, isLoading: jobsLoading, mutate: refetchJobs } = useSWR(
    "extraction_jobs",
    async () => {
      const { data } = await supabase.from("extraction_jobs").select("*").order("created_at", { ascending: false }).limit(20);
      return (data ?? []) as ExtractionJob[];
    },
    { refreshInterval: 5000 }
  );

  const loadFolders = async (account: EmailAccount) => {
    if (accountFolders[account.id]) return;
    try {
      const res = await fetch("/api/email-extractor/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: account.label, email: account.email,
          password: "__REUSE__",
          host: account.imap_host, port: account.imap_port, tls: account.imap_tls,
          save: false, reuse: account.id,
        }),
      });
      const data = await res.json();
      if (data.folders) {
        setAccountFolders((prev) => ({ ...prev, [account.id]: data.folders }));
      }
    } catch { /* ignore */ }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Delete this account and all its scan data?")) return;
    await supabase.from("email_accounts").delete().eq("id", id);
    refetchAccounts();
    refetchJobs();
  };

  // Background scan loop
  const handleStartScan = useCallback(async (account: EmailAccount, scanConfig: ScanConfig) => {
    stopRef.current = false;
    setScanning(true);
    setScanProgress(null);

    // Create job
    const startRes = await fetch("/api/email-extractor/scan/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        ...scanConfig,
      }),
    });
    const startData = await startRes.json();
    if (!startData.jobId) {
      setScanning(false);
      setScanProgress({ totalScanned: 0, totalEmails: 0, totalPhones: 0, currentFolder: "", folderProgress: "", status: "failed", error: startData.error ?? "Failed to start scan" });
      setActiveScan({ jobId: "", accountLabel: account.label });
      return;
    }

    setActiveScan({ jobId: startData.jobId, accountLabel: account.label });

    // Run batches
    while (!stopRef.current) {
      const batchRes = await fetch("/api/email-extractor/scan/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: startData.jobId }),
      });
      const batchData = await batchRes.json();

      if (batchData.error) {
        setScanProgress((prev) => ({ ...(prev ?? { totalScanned: 0, totalEmails: 0, totalPhones: 0, currentFolder: "", folderProgress: "" }), status: "failed", error: batchData.error }));
        break;
      }

      setScanProgress({
        totalScanned:  batchData.totalScanned  ?? 0,
        totalEmails:   batchData.totalEmails   ?? 0,
        totalPhones:   batchData.totalPhones   ?? 0,
        currentFolder: batchData.currentFolder ?? "",
        folderProgress: batchData.folderProgress ?? "",
        status: batchData.done ? "completed" : "running",
      });

      if (batchData.done) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    if (stopRef.current) {
      setScanProgress((prev) => prev ? { ...prev, status: "cancelled" } : null);
    }

    setScanning(false);
    refetchJobs();
  }, [refetchJobs]);

  // Export all unique emails across all jobs
  const handleExportAllEmails = async () => {
    setExportingAll(true);
    try {
      const { data } = await supabase
        .from("extracted_contacts")
        .select("value, source_from, source_date")
        .eq("type", "email")
        .order("value");

      if (!data || data.length === 0) { setExportingAll(false); return; }

      // Deduplicate by value
      const seen = new Set<string>();
      const unique = data.filter((r) => {
        if (seen.has(r.value)) return false;
        seen.add(r.value);
        return true;
      });

      const rows = [
        ["Email", "Source From", "Source Date"],
        ...unique.map((r) => [r.value, r.source_from ?? "", r.source_date ?? ""]),
      ];
      const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `all-emails-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingAll(false);
    }
  };

  // Delete duplicate emails across all jobs (keep oldest per value)
  const handleDeleteDuplicates = async () => {
    if (!confirm("This will delete duplicate email entries across all scans, keeping the oldest occurrence of each email. Continue?")) return;
    setDeletingDupes(true);
    try {
      const { data } = await supabase
        .from("extracted_contacts")
        .select("id, value, type, created_at")
        .eq("type", "email")
        .order("created_at", { ascending: true });

      if (!data) return;

      const seen = new Map<string, number>(); // value → first id
      const toDelete: number[] = [];

      for (const row of data) {
        if (seen.has(row.value)) {
          toDelete.push(row.id);
        } else {
          seen.set(row.value, row.id);
        }
      }

      if (toDelete.length === 0) {
        alert("No duplicates found.");
        return;
      }

      // Delete in chunks of 100
      for (let i = 0; i < toDelete.length; i += 100) {
        const chunk = toDelete.slice(i, i + 100);
        await supabase.from("extracted_contacts").delete().in("id", chunk);
      }

      alert(`Deleted ${toDelete.length} duplicate email(s).`);
      refetchJobs();
    } finally {
      setDeletingDupes(false);
    }
  };

  if (selectedJob) {
    return (
      <ContactsTable
        jobId={selectedJob.id}
        jobLabel={`${selectedJob.accountLabel} — ${new Date(selectedJob.created_at).toLocaleDateString()}`}
        onBack={() => setSelectedJob(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* OAuth result banner */}
      {oauthBanner && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
          oauthBanner.type === "success"
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {oauthBanner.type === "success"
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {oauthBanner.msg}
          <button onClick={() => setOauthBanner(null)} className="ml-auto text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
        </div>
      )}

      {/* Accounts section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600">Connected Accounts</h2>
          <AddAccountDialog onAdded={refetchAccounts} />
        </div>

        {accLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-24 bg-white/5 rounded-xl" />)}
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <Mail className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No accounts connected</p>
            <p className="text-xs text-slate-700 mt-1">Add an account to start extracting contacts</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accounts.map((acc) => (
              <div key={acc.id} className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm text-white truncate">{acc.label}</p>
                      {acc.oauth_provider && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/20 font-medium flex-shrink-0">
                          {acc.oauth_provider === "gmail" ? "Gmail OAuth" : "Outlook OAuth"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{acc.email}</p>
                    <p className="text-[10px] text-slate-700 mt-0.5">{acc.imap_host}:{acc.imap_port}</p>
                  </div>
                  <Button variant="ghost" size="icon"
                    className="w-7 h-7 text-slate-600 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                    onClick={() => handleDeleteAccount(acc.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm"
                    className="gap-1.5 border-white/10 text-slate-400 hover:bg-white/5 h-7 text-xs flex-1"
                    onClick={() => loadFolders(acc)}>
                    <RefreshCw className="w-3 h-3" />
                    {accountFolders[acc.id] ? `${accountFolders[acc.id].length} folders` : "Load Folders"}
                  </Button>
                  <ScanDialog
                    account={acc}
                    availableFolders={accountFolders[acc.id] ?? []}
                    onStartScan={(cfg) => handleStartScan(acc, cfg)}
                    disabled={scanning}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Jobs section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600">Scan History</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDeleteDuplicates} disabled={deletingDupes}
              className="h-7 gap-1.5 text-xs text-slate-500 hover:text-amber-400">
              <Layers className="w-3 h-3" />
              {deletingDupes ? "Deleting…" : "Delete Duplicates"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportAllEmails} disabled={exportingAll}
              className="h-7 gap-1.5 text-xs text-slate-500 hover:text-violet-400">
              <Download className="w-3 h-3" />
              {exportingAll ? "Exporting…" : "Export All Emails"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetchJobs()}
              className="h-7 gap-1.5 text-xs text-slate-500 hover:text-slate-300">
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </div>
        </div>

        {jobsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-32 bg-white/5 rounded-xl" />)}
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-slate-600">No scans yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {jobs.map((job) => {
              const acc = accounts?.find((a) => a.id === job.account_id);
              return (
                <JobCard
                  key={job.id}
                  job={job}
                  accountLabel={acc?.label ?? acc?.email ?? "Unknown"}
                  onSelect={(j) => setSelectedJob({ ...j, accountLabel: acc?.label ?? acc?.email ?? "Unknown" })}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Floating scan status widget */}
      {activeScan && (
        <ScanStatusWidget
          accountLabel={activeScan.accountLabel}
          progress={scanProgress}
          scanning={scanning}
          onStop={() => { stopRef.current = true; }}
          onDismiss={() => { setActiveScan(null); setScanProgress(null); }}
        />
      )}
    </div>
  );
}
