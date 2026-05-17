"use client";

import { useState } from "react";
import { createClientSupabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { useTelegramConfig } from "@/lib/hooks/useTelegramConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, User, Send, Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const { user } = useUser();
  const { config: tgConfig, saveConfig: saveTgConfig, isLoading: tgLoading } = useTelegramConfig();
  const supabase = createClientSupabase();

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tgSaving, setTgSaving] = useState(false);
  const [tgSaved, setTgSaved] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Populate telegram fields once loaded
  const [tgInitialized, setTgInitialized] = useState(false);
  if (!tgLoading && !tgInitialized) {
    setBotToken(tgConfig.botToken ?? "");
    setChatId(tgConfig.chatId ?? "");
    setTgInitialized(true);
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    await supabase.from("profiles").update({ full_name: fullName, updated_at: new Date().toISOString() }).eq("id", user.id);
    setProfileSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const handleTgSave = async () => {
    setTgSaving(true);
    try {
      await saveTgConfig({ botToken: botToken.trim(), chatId: chatId.trim() });
      setTgSaved(true);
      setTimeout(() => setTgSaved(false), 2500);
    } finally {
      setTgSaving(false);
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
          text: "✅ <b>Tools Hub</b> — Telegram connection is working!",
          parse_mode: "HTML",
        }),
      });
      const data = await res.json();
      setTestResult(data.ok
        ? { ok: true, msg: "Message sent successfully!" }
        : { ok: false, msg: data.description ?? "Unknown error" });
    } catch (err) {
      setTestResult({ ok: false, msg: String(err) });
    }
    setTestLoading(false);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account and notification preferences</p>
      </div>

      {/* Profile */}
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
            <User className="w-4 h-4 text-violet-400" />
          </div>
          <h2 className="font-semibold text-white text-sm">Profile</h2>
        </div>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Email</Label>
            <Input value={user?.email ?? ""} disabled className="bg-white/5 border-white/10 text-slate-500" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name" className="bg-white/5 border-white/10 text-white placeholder:text-slate-600" />
          </div>
          <Button type="submit" disabled={profileSaving}
            className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white">
            {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : profileSaved ? <CheckCircle className="w-4 h-4" /> : null}
            {profileSaved ? "Saved!" : profileSaving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </div>

      <Separator className="bg-white/5" />

      {/* Global Telegram */}
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#0088cc]/20 flex items-center justify-center">
            <Send className="w-4 h-4 text-[#0088cc]" />
          </div>
          <div>
            <h2 className="font-semibold text-white text-sm">Telegram Notifications</h2>
            <p className="text-xs text-slate-500">One bot for all tools — configure once, used everywhere</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Bot Token</Label>
            <div className="relative">
              <Input type={showToken ? "text" : "password"}
                placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                value={botToken} onChange={(e) => setBotToken(e.target.value)}
                className="pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-600 font-mono text-xs" />
              <button type="button" onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-600">
              Create a bot with <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">@BotFather</a> on Telegram
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Chat ID</Label>
            <Input placeholder="-1001234567890 or 123456789"
              value={chatId} onChange={(e) => setChatId(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 font-mono text-xs" />
            <p className="text-[10px] text-slate-600">
              Use <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">@userinfobot</a> to find your Chat ID.
            </p>
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
              {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
            </p>
          )}
        </div>

        <Button onClick={handleTgSave} disabled={tgSaving}
          className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white">
          {tgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : tgSaved ? <CheckCircle className="w-4 h-4" /> : null}
          {tgSaved ? "Saved!" : tgSaving ? "Saving..." : "Save Telegram Settings"}
        </Button>
      </div>

      <Separator className="bg-white/5" />

      <div className="text-xs text-slate-600 space-y-1">
        <p>Account plan: <span className="text-slate-400 capitalize">{user?.plan ?? "free"}</span></p>
        <p>Member since: <span className="text-slate-400">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span></p>
      </div>
    </div>
  );
}
