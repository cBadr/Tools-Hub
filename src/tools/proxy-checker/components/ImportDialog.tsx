"use client";

import { useState } from "react";
import { ClipboardPaste, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { parseProxyText } from "../lib/sources";
import type { ParsedProxy, ProxyType } from "../lib/sources";

const TYPE_COLORS: Record<string, string> = {
  http:   "bg-sky-500/15 text-sky-400 border-sky-500/20",
  https:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  socks4: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  socks5: "bg-violet-500/15 text-violet-400 border-violet-500/20",
};

interface Props {
  onImport: (proxies: ParsedProxy[]) => void;
}

export function ImportDialog({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [defaultType, setDefaultType] = useState<ProxyType>("http");

  const parsed = text.trim() ? parseProxyText(text, defaultType) : [];

  const handleImport = () => {
    if (parsed.length === 0) return;
    onImport(parsed);
    setText("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"
          className="gap-1.5 border-white/10 text-slate-300 hover:bg-white/5 h-8 text-xs">
          <ClipboardPaste className="w-3 h-3" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f0f17] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">Import Proxies</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Default Type (when not specified in the list)</Label>
            <div className="flex gap-1.5">
              {(["http", "https", "socks4", "socks5"] as ProxyType[]).map((t) => (
                <button key={t} onClick={() => setDefaultType(t)}
                  className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${defaultType === t ? TYPE_COLORS[t] : "border-white/10 text-slate-600 hover:border-white/20"}`}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">
              Paste proxies — one per line (formats: <code className="text-violet-400">ip:port</code> or <code className="text-violet-400">socks5://ip:port</code>)
            </Label>
            <textarea
              className="w-full h-48 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono placeholder:text-slate-700 resize-none focus:outline-none focus:border-violet-500/50"
              placeholder={"1.2.3.4:8080\nsocks5://5.6.7.8:1080\n192.168.1.1:3128"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {parsed.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-green-400 font-medium">{parsed.length}</span> proxies detected
              {(["http", "https", "socks4", "socks5"] as ProxyType[]).map((t) => {
                const count = parsed.filter((p) => p.type === t).length;
                if (!count) return null;
                return (
                  <span key={t} className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${TYPE_COLORS[t]}`}>
                    {t.toUpperCase()} {count}
                  </span>
                );
              })}
            </div>
          )}

          <Button onClick={handleImport} disabled={parsed.length === 0}
            className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white">
            <Upload className="w-4 h-4" />
            Import {parsed.length > 0 ? `${parsed.length} Proxies` : "Proxies"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
