"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { EmailAccount } from "@/types/email-extractor-tool";

interface Props {
  account: EmailAccount;
  availableFolders: string[];
  onComplete: () => void;
}

interface Progress {
  totalScanned: number;
  totalEmails: number;
  totalPhones: number;
  currentFolder: string;
  folderProgress: string;
  status: string;
}

export function ScanDialog({ account, availableFolders, onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<string[]>(["INBOX"]);
  const [allFolders, setAllFolders] = useState(false);
  const [maxMessages, setMaxMessages] = useState(1000);
  const [batchSize, setBatchSize] = useState(50);
  const [extractEmails, setExtractEmails] = useState(true);
  const [extractPhones, setExtractPhones] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    if (availableFolders.length > 0 && !availableFolders.includes("INBOX")) {
      setSelectedFolders([availableFolders[0]]);
    }
  }, [availableFolders]);

  const toggleFolder = (f: string) => {
    setSelectedFolders((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const handleStart = async () => {
    setScanning(true);
    setError(null);
    stopRef.current = false;

    const folders = allFolders ? availableFolders : selectedFolders;

    // Create job
    const startRes = await fetch("/api/email-extractor/scan/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        folders,
        maxMessages,
        batchSize,
        extractEmails,
        extractPhones,
      }),
    });
    const startData = await startRes.json();
    if (!startData.jobId) {
      setError(startData.error ?? "Failed to start job");
      setScanning(false);
      return;
    }

    const jobId = startData.jobId;

    // Run batches
    while (!stopRef.current) {
      const batchRes = await fetch("/api/email-extractor/scan/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const batchData = await batchRes.json();

      if (batchData.error) {
        setError(batchData.error);
        break;
      }

      setProgress({
        totalScanned: batchData.totalScanned ?? 0,
        totalEmails: batchData.totalEmails ?? 0,
        totalPhones: batchData.totalPhones ?? 0,
        currentFolder: batchData.currentFolder ?? "",
        folderProgress: batchData.folderProgress ?? "",
        status: batchData.status ?? "running",
      });

      if (batchData.done) break;

      // Small delay to avoid hammering the server
      await new Promise((r) => setTimeout(r, 200));
    }

    setScanning(false);
    onComplete();
  };

  const handleStop = () => {
    stopRef.current = true;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!scanning) setOpen(v); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"
          className="gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 h-8 text-xs">
          <Play className="w-3 h-3" /> Scan
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f0f17] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">
            Scan: <span className="text-violet-400">{account.label}</span>
          </DialogTitle>
        </DialogHeader>

        {!scanning ? (
          <div className="space-y-4 py-2">
            {/* Folder selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-400 text-xs">Folders to scan</Label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600">All folders</span>
                  <Switch checked={allFolders} onCheckedChange={setAllFolders}
                    className="data-[state=checked]:bg-violet-600 scale-75" />
                </div>
              </div>
              {!allFolders && (
                <div className="max-h-36 overflow-y-auto space-y-1 glass rounded-lg p-2">
                  {availableFolders.length === 0 && (
                    <p className="text-xs text-slate-600 text-center py-2">No folders loaded yet</p>
                  )}
                  {availableFolders.map((f) => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 hover:bg-white/5 rounded">
                      <input type="checkbox" checked={selectedFolders.includes(f)}
                        onChange={() => toggleFolder(f)} className="accent-violet-500 w-3.5 h-3.5" />
                      <span className="text-xs text-slate-300">{f}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Max messages</Label>
                <Input type="number" value={maxMessages} min={10} max={50000}
                  onChange={(e) => setMaxMessages(Number(e.target.value))}
                  className="bg-white/5 border-white/10 text-white text-sm h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Batch size</Label>
                <Input type="number" value={batchSize} min={10} max={100}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="bg-white/5 border-white/10 text-white text-sm h-8" />
              </div>
            </div>

            {/* Extract toggles */}
            <div className="flex gap-4">
              {[
                { label: "Extract Emails", val: extractEmails, set: setExtractEmails },
                { label: "Extract Phones", val: extractPhones, set: setExtractPhones },
              ].map(({ label, val, set }) => (
                <div key={label} className="flex items-center gap-2">
                  <Switch checked={val} onCheckedChange={set}
                    className="data-[state=checked]:bg-violet-600 scale-75" />
                  <span className="text-xs text-slate-400">{label}</span>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">✗ {error}</p>
            )}

            <Button onClick={handleStart} disabled={(!allFolders && selectedFolders.length === 0) || (!extractEmails && !extractPhones)}
              className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white">
              <Play className="w-4 h-4" /> Start Scanning
            </Button>
          </div>
        ) : (
          <div className="space-y-5 py-4">
            {/* Live progress */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                <span className="text-sm text-slate-300">
                  {progress?.status === "completed" ? "Scan complete!" : "Scanning…"}
                </span>
                {progress?.folderProgress && (
                  <span className="text-xs text-slate-600 ml-auto">Folder {progress.folderProgress}</span>
                )}
              </div>

              {progress && (
                <div className="glass rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
                  <StatMini label="Scanned" value={progress.totalScanned} />
                  <StatMini label="Emails" value={progress.totalEmails} color="text-violet-400" />
                  <StatMini label="Phones" value={progress.totalPhones} color="text-cyan-400" />
                </div>
              )}

              {progress?.currentFolder && (
                <p className="text-[11px] text-slate-600 truncate">
                  Current folder: <span className="text-slate-500">{progress.currentFolder}</span>
                </p>
              )}
            </div>

            {progress?.status !== "completed" && (
              <Button variant="outline" size="sm" onClick={handleStop}
                className="gap-2 border-red-500/20 text-red-400 hover:bg-red-500/10 w-full">
                <X className="w-3.5 h-3.5" /> Stop
              </Button>
            )}

            {progress?.status === "completed" && (
              <Button onClick={() => { setOpen(false); setScanning(false); setProgress(null); }}
                className="w-full bg-green-600 hover:bg-green-500 text-white">
                Done
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatMini({ label, value, color = "text-white" }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] text-slate-600">{label}</div>
    </div>
  );
}
