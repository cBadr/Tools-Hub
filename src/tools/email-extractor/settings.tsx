"use client";

import { useState } from "react";
import { Bell, ExternalLink, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTelegramConfig } from "@/lib/hooks/useTelegramConfig";
import type { ToolSettingsProps } from "./../_registry/types";

interface EmailExtractorPrefs {
  notificationsEnabled: boolean;
}

export default function EmailExtractorSettings({ config, onSave }: ToolSettingsProps) {
  const cfg = config as unknown as EmailExtractorPrefs;
  const { config: tgGlobal } = useTelegramConfig();

  const [notificationsEnabled, setNotificationsEnabled] = useState(cfg.notificationsEnabled ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasTelegram = !!(tgGlobal.botToken && tgGlobal.chatId);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ notificationsEnabled });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Telegram status */}
      <div className={`glass rounded-xl p-4 flex items-start gap-3 border ${hasTelegram ? "border-green-500/20" : "border-amber-500/20"}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${hasTelegram ? "bg-green-500/15" : "bg-amber-500/15"}`}>
          <Bell className={`w-4 h-4 ${hasTelegram ? "text-green-400" : "text-amber-400"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">
            {hasTelegram ? "Telegram configured ✓" : "Telegram not configured"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {hasTelegram
              ? "A Telegram report will be sent when extraction completes."
              : "Configure your Telegram bot in Settings to receive extraction reports."}
          </p>
        </div>
        {!hasTelegram && (
          <a href="/settings" className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 flex-shrink-0">
            Go to Settings <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Notification preferences */}
      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm">Notification Preferences</h3>
        <p className="text-xs text-slate-500 -mt-2">Control when extraction reports are sent.</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Send Report on Completion</p>
            <p className="text-xs text-slate-600">Receive a detailed Telegram report when a scan finishes</p>
          </div>
          <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled}
            className="data-[state=checked]:bg-violet-600" />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving || !hasTelegram}
        className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-900/20 disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : null}
        {saved ? "Saved!" : saving ? "Saving..." : "Save Preferences"}
      </Button>
    </div>
  );
}
