"use client";

import { useState } from "react";
import { createClientSupabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, User } from "lucide-react";

export default function SettingsPage() {
  const { user } = useUser();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClientSupabase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    await supabase
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account preferences</p>
      </div>

      {/* Profile */}
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
            <User className="w-4 h-4 text-violet-400" />
          </div>
          <h2 className="font-semibold text-white text-sm">Profile</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Email</Label>
            <Input
              value={user?.email ?? ""}
              disabled
              className="bg-white/5 border-white/10 text-slate-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
            />
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : null}
            {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </div>

      <Separator className="bg-white/5" />

      {/* Account info */}
      <div className="text-xs text-slate-600 space-y-1">
        <p>Account plan: <span className="text-slate-400 capitalize">{user?.plan ?? "free"}</span></p>
        <p>Member since: <span className="text-slate-400">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span></p>
      </div>
    </div>
  );
}
