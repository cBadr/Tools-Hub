"use client";

import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { EmailAccount } from "@/types/email-extractor-tool";

export interface ScanConfig {
  folders: string[];
  maxMessages: number;
  batchSize: number;
  extractEmails: boolean;
  extractPhones: boolean;
}

interface Props {
  account: EmailAccount;
  availableFolders: string[];
  onStartScan: (config: ScanConfig) => void;
  disabled?: boolean;
}

export function ScanDialog({ account, availableFolders, onStartScan, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<string[]>(["INBOX"]);
  const [allFolders, setAllFolders] = useState(false);
  const [maxMessages, setMaxMessages] = useState(1000);
  const [batchSize, setBatchSize] = useState(50);
  const [extractEmails, setExtractEmails] = useState(true);
  const [extractPhones, setExtractPhones] = useState(true);

  useEffect(() => {
    if (availableFolders.length > 0 && !availableFolders.includes("INBOX")) {
      setSelectedFolders([availableFolders[0]]);
    }
  }, [availableFolders]);

  const toggleFolder = (f: string) =>
    setSelectedFolders((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );

  const handleStart = () => {
    const folders = allFolders ? availableFolders : selectedFolders;
    setOpen(false);
    onStartScan({ folders, maxMessages, batchSize, extractEmails, extractPhones });
  };

  const canStart = (allFolders || selectedFolders.length > 0) && (extractEmails || extractPhones);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}
          className="gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 h-8 text-xs disabled:opacity-40">
          <Play className="w-3 h-3" /> Scan
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f0f17] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">
            Scan: <span className="text-violet-400">{account.label}</span>
          </DialogTitle>
        </DialogHeader>

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
                {availableFolders.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-2">
                    No folders loaded — click Load Folders first
                  </p>
                ) : (
                  availableFolders.map((f) => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 hover:bg-white/5 rounded">
                      <input type="checkbox" checked={selectedFolders.includes(f)}
                        onChange={() => toggleFolder(f)} className="accent-violet-500 w-3.5 h-3.5" />
                      <span className="text-xs text-slate-300">{f}</span>
                    </label>
                  ))
                )}
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
              { label: "Emails", val: extractEmails, set: setExtractEmails },
              { label: "Phones", val: extractPhones, set: setExtractPhones },
            ].map(({ label, val, set }) => (
              <div key={label} className="flex items-center gap-2">
                <Switch checked={val} onCheckedChange={set}
                  className="data-[state=checked]:bg-violet-600 scale-75" />
                <span className="text-xs text-slate-400">Extract {label}</span>
              </div>
            ))}
          </div>

          <Button onClick={handleStart} disabled={!canStart}
            className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white">
            <Play className="w-4 h-4" /> Start Scanning
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
