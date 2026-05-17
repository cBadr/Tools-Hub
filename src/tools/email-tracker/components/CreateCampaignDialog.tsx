"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClientSupabase } from "@/lib/supabase/client";

interface Props {
  onCreated: () => void;
}

export function CreateCampaignDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClientSupabase();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    const { error } = await supabase.from("email_campaigns").insert({
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
    });

    if (error) {
      setError(error.message);
    } else {
      setOpen(false);
      setName("");
      setDescription("");
      onCreated();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-900/20">
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-[#0f0f1a] border-violet-900/30 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Create Campaign</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Campaign Name *</Label>
            <Input
              placeholder="e.g. April Newsletter"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Description (optional)</Label>
            <Input
              placeholder="e.g. Q2 product announcement"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              className="text-slate-400 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
