"use client";

import { useState } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipientStep, type RecipientRow } from "./RecipientStep";
import { ComposeStep } from "./ComposeStep";
import { SenderStep, type SenderSettings } from "./SenderStep";
import { ReviewStep } from "./ReviewStep";
import { useMassSend } from "../MassSendContext";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const STEPS = ["Recipients", "Compose", "Send Settings", "Review & Launch"];

const DEFAULT_SETTINGS: SenderSettings = {
  rateLimitPerHour:   20,
  useProxy:           false,
  threadSearchFolder: "all",
  threadCustomFolder: "",
  addRePrefix:        false,
};

export function CampaignWizard({ onClose, onCreated }: Props) {
  const { startSend } = useMassSend();

  const [step, setStep] = useState(0);
  const [name, setName]           = useState("");
  const [subject, setSubject]     = useState("");
  const [bodyHtml, setBodyHtml]   = useState("");
  const [mode, setMode]           = useState<"new" | "reply">("new");
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [settings, setSettings]   = useState<SenderSettings>(DEFAULT_SETTINGS);
  const [launching, setLaunching] = useState(false);

  const canNext =
    step === 0 ? recipients.length > 0 :
    step === 1 ? subject.trim().length > 0 && bodyHtml.trim().length > 10 :
    step === 2 ? true :
    true;

  async function launch() {
    if (!name.trim()) return;
    setLaunching(true);
    try {
      const res = await fetch("/api/mass-sender/create-campaign", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:                 name.trim(),
          subject,
          body_html:            bodyHtml,
          mode,
          thread_search_folder: settings.threadSearchFolder,
          thread_custom_folder: settings.threadCustomFolder || null,
          add_re_prefix:        settings.addRePrefix,
          use_proxy:            settings.useProxy,
          rate_limit_per_hour:  settings.rateLimitPerHour,
          recipients,
        }),
      });
      if (!res.ok) throw new Error("Failed to create campaign");
      const { campaignId } = await res.json() as { campaignId: string };

      // Start background sending
      startSend(campaignId, name.trim(), recipients.length, settings.rateLimitPerHour);
      onCreated();
    } catch {
      setLaunching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#0e0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h2 className="text-base font-bold text-slate-100">New Campaign</h2>
            <p className="text-xs text-slate-500 mt-0.5">{STEPS[step]}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className={cn(
                  "w-6 h-6 rounded-full text-[10px] font-bold transition-all flex items-center justify-center",
                  i === step   ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40" :
                  i < step     ? "bg-violet-500/20 text-violet-400 cursor-pointer hover:bg-violet-500/30" :
                                 "bg-white/5 text-slate-600",
                )}
              >
                {i + 1}
              </button>
              <span className={cn("text-[10px] hidden sm:block",
                i === step ? "text-slate-300 font-medium" : "text-slate-600"
              )}>
                {label}
              </span>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-700" />}
            </div>
          ))}
        </div>

        {/* Campaign name (always visible) */}
        {step === 0 && (
          <div className="px-6 pt-4">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaign name (for your reference)"
              className="h-9 bg-white/3 border-white/8 text-sm"
            />
          </div>
        )}

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 0 && (
            <RecipientStep selected={recipients} onChange={setRecipients} />
          )}
          {step === 1 && (
            <ComposeStep
              subject={subject}
              bodyHtml={bodyHtml}
              mode={mode}
              onSubjectChange={setSubject}
              onBodyChange={setBodyHtml}
              onModeChange={setMode}
            />
          )}
          {step === 2 && (
            <SenderStep mode={mode} settings={settings} onChange={setSettings} />
          )}
          {step === 3 && (
            <ReviewStep
              campaignName={name}
              subject={subject}
              recipients={recipients}
              settings={settings}
              mode={mode}
              launching={launching}
              onLaunch={launch}
            />
          )}
        </div>

        {/* Footer nav */}
        {step < 3 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="gap-1.5 text-slate-400"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="gap-1.5 bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
