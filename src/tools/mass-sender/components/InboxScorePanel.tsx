"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scoreHtml, type HtmlIssue, type OptimizeOptions } from "../lib/html-scorer";
import { cn } from "@/lib/utils";

interface Props {
  html: string;
  onOptimize: (opts: OptimizeOptions) => void;
  baseUrl?: string;
}

const FIX_LABELS: Partial<Record<keyof OptimizeOptions, string>> = {
  fixMissingAlt:     "إضافة alt للصور",
  fixImageDimensions: "تحديد أبعاد الصور",
  replaceCssLayouts: "تحويل Flex/Grid لجداول",
  removeDisplayNone: "إزالة العناصر المخفية",
  fixRelativeLinks:  "إصلاح الروابط النسبية",
  inlineCss:         "تحويل CSS إلى Inline",
  addPlainText:      "إضافة نسخة Plain Text",
  imagesToBase64:    "تحويل الصور لـ Base64",
};

export function InboxScorePanel({ html, onOptimize, baseUrl }: Props) {
  const { score, issues } = useMemo(() => scoreHtml(html), [html]);
  const [expanded, setExpanded] = useState(true);

  const scoreColor =
    score >= 85 ? "text-green-400"  :
    score >= 60 ? "text-yellow-400" :
                  "text-red-400";

  const scoreBg =
    score >= 85 ? "from-green-500/20 to-green-500/5"   :
    score >= 60 ? "from-yellow-500/20 to-yellow-500/5" :
                  "from-red-500/20 to-red-500/5";

  const barColor =
    score >= 85 ? "bg-green-500"  :
    score >= 60 ? "bg-yellow-500" :
                  "bg-red-500";

  function fixAll() {
    const opts: OptimizeOptions = { baseUrl };
    for (const issue of issues) {
      if (issue.fixKey) (opts as Record<string, unknown>)[issue.fixKey] = true;
    }
    onOptimize(opts);
  }

  return (
    <div className="rounded-xl border border-white/8 bg-gradient-to-b from-white/3 to-transparent overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center", scoreBg)}>
            <span className={cn("text-sm font-bold tabular-nums", scoreColor)}>{score}</span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-200">Inbox Score</p>
            <p className="text-[11px] text-slate-500">
              {score >= 85 ? "جيد جداً" : score >= 60 ? "يحتاج تحسين" : "خطر Spam"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${score}%` }} />
          </div>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </button>

      {/* Issues list */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
          {issues.length === 0 ? (
            <p className="text-[12px] text-green-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> لا توجد مشاكل — ممتاز!
            </p>
          ) : (
            issues.map((issue) => <IssueRow key={issue.id} issue={issue} onFix={(key) => onOptimize({ [key]: true, baseUrl })} />)
          )}

          {issues.some((i) => i.fixKey) && (
            <Button
              size="sm"
              variant="outline"
              onClick={fixAll}
              className="mt-3 w-full h-8 text-xs border-violet-500/30 text-violet-300 hover:bg-violet-500/10 gap-1.5"
            >
              <Zap className="w-3 h-3" />
              إصلاح كل شيء تلقائياً
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue, onFix }: { issue: HtmlIssue; onFix: (key: keyof OptimizeOptions) => void }) {
  const Icon =
    issue.severity === "error"   ? XCircle       :
    issue.severity === "warning" ? AlertTriangle  :
                                   CheckCircle2;
  const color =
    issue.severity === "error"   ? "text-red-400"    :
    issue.severity === "warning" ? "text-yellow-400" :
                                   "text-blue-400";

  const fixLabel = issue.fixKey ? FIX_LABELS[issue.fixKey] : undefined;

  return (
    <div className="flex items-start justify-between gap-2 text-[11px]">
      <div className="flex items-start gap-1.5 flex-1 min-w-0">
        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", color)} />
        <span className="text-slate-400 leading-relaxed">{issue.message}</span>
      </div>
      {fixLabel && issue.fixKey && (
        <button
          type="button"
          onClick={() => onFix(issue.fixKey!)}
          className="flex-shrink-0 text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
        >
          {fixLabel}
        </button>
      )}
    </div>
  );
}
