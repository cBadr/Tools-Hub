"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Eye, EyeOff, Wifi, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { detectFromEmail } from "@/tools/email-extractor/lib/detect";
import type { DetectedSettings } from "@/tools/email-extractor/lib/detect";

interface Props { onAdded: () => void; }

export function AddAccountDialog({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(993);
  const [tls, setTls] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; folders?: string[] } | null>(null);
  const [tested, setTested] = useState(false);
  const [detected, setDetected] = useState<DetectedSettings | null>(null);
  const [detecting, setDetecting] = useState(false);
  const detectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-detect IMAP settings when email changes
  useEffect(() => {
    setDetected(null);
    setTestResult(null);
    setTested(false);

    if (!email.includes("@")) return;

    // Try client-side map first
    const fromMap = detectFromEmail(email);
    if (fromMap) {
      setDetected(fromMap);
      setHost(fromMap.host);
      setPort(fromMap.port);
      setTls(fromMap.tls);
      return;
    }

    // Debounce DNS lookup
    if (detectTimeout.current) clearTimeout(detectTimeout.current);
    detectTimeout.current = setTimeout(async () => {
      setDetecting(true);
      try {
        const res = await fetch("/api/email-extractor/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.ok && data.settings) {
          setDetected(data.settings);
          setHost(data.settings.host);
          setPort(data.settings.port);
          setTls(data.settings.tls);
        }
      } catch { /* ignore */ }
      setDetecting(false);
    }, 600);
  }, [email]);

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

  const handleOAuth = (provider: "google" | "microsoft") => {
    const w = 600, h = 700;
    const left = Math.round(window.screenX + (window.outerWidth  - w) / 2);
    const top  = Math.round(window.screenY + (window.outerHeight - h) / 2);
    const popup = window.open(
      `/api/email-extractor/oauth/${provider}`,
      `oauth_${provider}`,
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    // Fallback: popup blocked
    if (!popup || popup.closed) {
      window.location.href = `/api/email-extractor/oauth/${provider}`;
      return;
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "oauth_complete") return;
      window.removeEventListener("message", handleMessage);
      if (e.data.success) {
        setOpen(false);
        onAdded();
      } else {
        const msgs: Record<string, string> = {
          oauth_denied: "تم رفض الصلاحية.",
          invalid_state: "فشل التحقق الأمني، حاول مرة أخرى.",
          token_exchange_failed: "فشل الحصول على التوكن.",
          no_email: "تعذّر جلب عنوان البريد.",
          db_error: "خطأ في حفظ الحساب.",
        };
        setTestResult({ ok: false, msg: msgs[e.data.error] ?? `OAuth error: ${e.data.error}` });
      }
    };

    window.addEventListener("message", handleMessage);
  };

  const isCustomHost = detected === null && email.includes("@");
  const isGmail = detected?.provider === "gmail";
  const isOutlook = detected?.provider === "outlook";

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
          {/* OAuth buttons */}
          <div className="space-y-2">
            <button
              onClick={() => handleOAuth("google")}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-sm font-medium text-slate-200 transition-all"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            <button
              onClick={() => handleOAuth("microsoft")}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-sm font-medium text-slate-200 transition-all"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Continue with Microsoft
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-slate-600">or use app password</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Email Address</Label>
            <div className="relative">
              <Input type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 text-sm pr-8" />
              {detecting && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 animate-spin" />
              )}
            </div>
            {detected && (
              <p className="flex items-center gap-1.5 text-[11px] text-green-400/80">
                <CheckCircle2 className="w-3 h-3" />
                Auto-detected: {detected.host}:{detected.port}
              </p>
            )}
            {isGmail && (
              <p className="text-[10px] text-amber-400/70">
                Gmail requires an App Password if 2FA is enabled. Enable it in Google Account → Security → App passwords.
              </p>
            )}
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
          </div>

          {/* Custom IMAP host (shown when not auto-detected) */}
          {isCustomHost && (
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

          {/* Label (optional) */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Label <span className="text-slate-600">(optional)</span></Label>
            <Input placeholder={email || "My Work Email"} value={label} onChange={(e) => setLabel(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 text-sm" />
          </div>

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
              Test
            </Button>
            <Button size="sm" className="gap-2 flex-1 bg-violet-600 hover:bg-violet-500 text-white"
              disabled={!email || !password || loading} onClick={() => handleTest(true)}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Save Account
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
