"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Trash2, RefreshCw, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { createClientSupabase } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { ScanDialog } from "./components/ScanDialog";
import { JobCard } from "./components/JobCard";
import { ContactsTable } from "./components/ContactsTable";
import type { EmailAccount, ExtractionJob } from "@/types/email-extractor-tool";
import type { ToolProps } from "./../_registry/types";

export default function EmailExtractor({ config }: ToolProps) {
  const [selectedJob, setSelectedJob] = useState<(ExtractionJob & { accountLabel: string }) | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [oauthBanner, setOauthBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    const oauth = searchParams.get("oauth");
    const error = searchParams.get("error");
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
  const [accountFolders, setAccountFolders] = useState<Record<string, string[]>>({});
  const supabase = createClientSupabase();

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
          <button onClick={() => setOauthBanner(null)} className="ml-auto text-slate-500 hover:text-slate-300">✕</button>
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
                    Load Folders
                  </Button>
                  <ScanDialog
                    account={acc}
                    availableFolders={accountFolders[acc.id] ?? []}
                    onComplete={() => refetchJobs()}
                  />
                </div>
                {accountFolders[acc.id] && (
                  <p className="text-[10px] text-slate-600">{accountFolders[acc.id].length} folders available</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Jobs section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600">Scan History</h2>
          <Button variant="ghost" size="sm" onClick={() => refetchJobs()}
            className="h-7 gap-1.5 text-xs text-slate-500 hover:text-slate-300">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
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
    </div>
  );
}
