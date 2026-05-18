"use client";

import { useState, useCallback } from "react";
import { Tag, Eye, Code2, MessageSquareReply, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InboxScorePanel } from "./InboxScorePanel";
import type { OptimizeOptions } from "../lib/html-scorer";
import { cn } from "@/lib/utils";

interface Props {
  subject: string;
  bodyHtml: string;
  mode: "new" | "reply";
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onModeChange: (v: "new" | "reply") => void;
}

const TAGS = ["{{firstName}}", "{{lastName}}", "{{company}}", "{{email}}"];

export function ComposeStep({ subject, bodyHtml, mode, onSubjectChange, onBodyChange, onModeChange }: Props) {
  const [showPreview, setShowPreview] = useState(false);

  // Preview: replace tags with sample data
  const previewHtml = bodyHtml
    .replace(/\{\{firstName\}\}/gi, "أحمد")
    .replace(/\{\{lastName\}\}/gi,  "محمد")
    .replace(/\{\{company\}\}/gi,   "شركة مثال")
    .replace(/\{\{email\}\}/gi,     "ahmed@example.com");

  const insertTag = useCallback((tag: string) => {
    onBodyChange(bodyHtml + tag);
  }, [bodyHtml, onBodyChange]);

  async function handleOptimize(opts: OptimizeOptions) {
    try {
      const res = await fetch("/api/mass-sender/optimize-html", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ html: bodyHtml, options: opts }),
      });
      if (!res.ok) return;
      const { html } = await res.json() as { html: string };
      onBodyChange(html);
    } catch { /* non-fatal */ }
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onModeChange("new")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all",
            mode === "new"
              ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
              : "bg-white/3 border-white/8 text-slate-400 hover:text-slate-300"
          )}
        >
          <Mail className="w-3.5 h-3.5" />
          إيميل جديد
        </button>
        <button
          type="button"
          onClick={() => onModeChange("reply")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all",
            mode === "reply"
              ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300"
              : "bg-white/3 border-white/8 text-slate-400 hover:text-slate-300"
          )}
        >
          <MessageSquareReply className="w-3.5 h-3.5" />
          رد على محادثة موجودة
        </button>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <label className="text-xs text-slate-400 font-medium">الموضوع</label>
        <Input
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="مرحباً {{firstName}}، لدينا عرض خاص لك"
          className="h-9 bg-white/3 border-white/8 text-sm"
        />
      </div>

      {/* Personalization tags */}
      <div className="flex flex-wrap gap-1.5">
        {TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => insertTag(tag)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-300 hover:bg-violet-500/20 transition-colors"
          >
            <Tag className="w-2.5 h-2.5" />
            {tag}
          </button>
        ))}
      </div>

      {/* Editor / Preview toggle */}
      <div className="flex gap-1.5 border-b border-white/5 pb-2">
        <button
          type="button"
          onClick={() => setShowPreview(false)}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            !showPreview ? "bg-white/8 text-slate-200" : "text-slate-500 hover:text-slate-400")}
        >
          <Code2 className="w-3.5 h-3.5" /> HTML
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            showPreview ? "bg-white/8 text-slate-200" : "text-slate-500 hover:text-slate-400")}
        >
          <Eye className="w-3.5 h-3.5" /> معاينة
        </button>
      </div>

      {showPreview ? (
        <div className="border border-white/8 rounded-xl overflow-hidden bg-white">
          <iframe
            srcDoc={previewHtml}
            className="w-full h-80"
            sandbox="allow-same-origin"
            title="Email preview"
          />
        </div>
      ) : (
        <textarea
          value={bodyHtml}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="<p>مرحباً {{firstName}}،</p><p>رسالتك هنا...</p>"
          className="w-full h-64 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-slate-300 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/50 placeholder:text-slate-600"
          spellCheck={false}
        />
      )}

      {/* Inbox Score */}
      {bodyHtml.length > 10 && (
        <InboxScorePanel html={bodyHtml} onOptimize={handleOptimize} />
      )}
    </div>
  );
}
