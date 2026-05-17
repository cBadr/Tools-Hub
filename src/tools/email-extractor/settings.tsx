"use client";

import { useState } from "react";
import { Send, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ToolSettingsProps } from "./../_registry/types";
import type { TelegramConfig } from "@/types/email-tracker";

export default function EmailExtractorSettings({ config, onSave }: ToolSettingsProps) {
  const cfg = config as unknown as TelegramConfig;
  const [botToken, setBotToken] = useState(cfg.telegramBotToken ?? "");
  const [chatId, setChatId] = useState(cfg.telegramChatId ?? "");
  const [notificationsEnabled, setNotificationsEnabled] = useState(cfg.notificationsEnabled ?? true);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ telegramBotToken: botToken, telegramChatId: chatId, notificationsEnabled });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!botToken || !chatId) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ <b>Tools Hub — Email Extractor</b>\nTelegram connection is working!",
          parse_mode: "HTML",
        }),
      });
      const data = await res.json();
      setTestResult(data.ok
        ? { ok: true, message: "Message sent successfully!" }
        : { ok: false, message: data.description ?? "Unknown error" });
    } catch (err) {
      setTestResult({ ok: false, message: String(err) });
    }
    setTestLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0088cc]/20 flex items-center justify-center">
            <Send className="w-4 h-4 text-[#0088cc]" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Telegram Notifications</h3>
            <p className="text-xs text-slate-500">Receive a detailed report when extraction completes</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Bot Token</Label>
            <div className="relative">
              <Input type={showToken ? "text" : "password"}
                placeholder="1234567890:ABCdef..."
                value={botToken} onChange={(e) => setBotToken(e.target.value)}
                className="pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-600 font-mono text-xs" />
              <button type="button" onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Chat ID</Label>
            <Input placeholder="-1001234567890 or 123456789"
              value={chatId} onChange={(e) => setChatId(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 font-mono text-xs" />
          </div>

          {botToken && chatId && (
            <Button type="button" variant="outline" size="sm"
              className="gap-2 border-white/10 text-slate-300 hover:bg-white/5"
              onClick={handleTest} disabled={testLoading}>
              {testLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send Test Message
            </Button>
          )}

          {testResult && (
            <p className={`text-xs px-3 py-2 rounded-lg border ${testResult.ok ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
              {testResult.ok ? "✓ " : "✗ "}{testResult.message}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm text-slate-300">Enable Notifications</p>
              <p className="text-xs text-slate-600">Send report on extraction complete</p>
            </div>
            <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled}
              className="data-[state=checked]:bg-violet-600" />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}
        className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-900/20">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : null}
        {saved ? "Saved!" : saving ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}
