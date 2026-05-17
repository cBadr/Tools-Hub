"use client";

import { useState } from "react";
import { Loader2, Eye, EyeOff, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IMAP_PRESETS } from "@/types/email-extractor-tool";

interface Props { onAdded: () => void; }

export function AddAccountDialog({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(0);
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [host, setHost] = useState(IMAP_PRESETS[0].host);
  const [port, setPort] = useState(IMAP_PRESETS[0].port);
  const [tls, setTls] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; folders?: string[] } | null>(null);
  const [tested, setTested] = useState(false);

  const applyPreset = (idx: number) => {
    setPreset(idx);
    const p = IMAP_PRESETS[idx];
    setHost(p.host);
    setPort(p.port);
    setTls(p.tls);
  };

  const handleTest = async (andSave = false) => {
    setLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/email-extractor/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label || email, email, password, host, port, tls, save: andSave }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, msg: `Connected! Found ${data.folders.length} folders.`, folders: data.folders });
        setTested(true);
        if (andSave) { setOpen(false); onAdded(); }
      } else {
        setTestResult({ ok: false, msg: data.error ?? "Connection failed" });
      }
    } catch {
      setTestResult({ ok: false, msg: "Network error" });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-900/20">
          + Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f0f17] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Connect Email Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Provider presets */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Provider</Label>
            <div className="flex gap-1.5 flex-wrap">
              {IMAP_PRESETS.map((p, i) => (
                <button key={p.label} onClick={() => applyPreset(i)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${preset === i ? "bg-violet-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Label <span className="text-slate-600">(optional)</span></Label>
            <Input placeholder="My Work Gmail" value={label} onChange={(e) => setLabel(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 text-sm" />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Email Address</Label>
            <Input type="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 text-sm" />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Password / App Password</Label>
            <div className="relative">
              <Input type={showPass ? "text" : "password"} placeholder="••••••••••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-600 text-sm font-mono" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {IMAP_PRESETS[preset]?.label === "Gmail" && (
              <p className="text-[10px] text-amber-400/70">Gmail requires an App Password if 2FA is enabled. Enable it in Google Account → Security → App passwords.</p>
            )}
          </div>

          {/* Custom IMAP */}
          {IMAP_PRESETS[preset]?.label === "Custom" && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-slate-400 text-xs">IMAP Host</Label>
                <Input value={host} onChange={(e) => setHost(e.target.value)}
                  className="bg-white/5 border-white/10 text-white text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Port</Label>
                <Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))}
                  className="bg-white/5 border-white/10 text-white text-sm" />
              </div>
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <p className={`text-xs px-3 py-2 rounded-lg border ${testResult.ok ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
              {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="gap-2 flex-1 border-white/10 text-slate-300 hover:bg-white/5"
              disabled={!email || !password || loading} onClick={() => handleTest(false)}>
              {loading && !tested ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              Test Connection
            </Button>
            <Button size="sm" className="gap-2 flex-1 bg-violet-600 hover:bg-violet-500 text-white"
              disabled={!email || !password || loading} onClick={() => handleTest(true)}>
              {loading && !tested ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save Account
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
