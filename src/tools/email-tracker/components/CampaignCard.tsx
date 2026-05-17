"use client";

import { useState } from "react";
import { Mail, Eye, Copy, Check, MoreVertical, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/utils";
import { getHtmlSnippet, getPixelUrl } from "../lib/pixel";
import type { Campaign } from "@/types/email-tracker";

interface Props {
  campaign: Campaign;
  onSelect: (campaign: Campaign) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
  baseUrl: string;
}

export function CampaignCard({ campaign, onSelect, onDelete, onToggle, baseUrl }: Props) {
  const [copied, setCopied] = useState<"url" | "html" | null>(null);

  const copyText = async (text: string, type: "url" | "html") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div
      className="glass rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:border-violet-500/25 hover:bg-violet-500/3 transition-all duration-200 group"
      onClick={() => onSelect(campaign)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-white truncate">{campaign.name}</h3>
            {campaign.description && (
              <p className="text-xs text-slate-500 truncate">{campaign.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Badge
            className={`text-[9px] px-1.5 ${
              campaign.is_active
                ? "bg-green-500/15 text-green-400 border-green-500/20"
                : "bg-slate-500/15 text-slate-400 border-slate-500/20"
            }`}
          >
            {campaign.is_active ? "Active" : "Paused"}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-500 hover:text-slate-300">
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#12121f] border-violet-900/30 text-slate-300">
              <DropdownMenuItem
                onClick={() => onToggle(campaign.id, !campaign.is_active)}
                className="hover:bg-white/5 focus:bg-white/5"
              >
                {campaign.is_active
                  ? <><ToggleLeft className="w-3.5 h-3.5 mr-2" /> Pause</>
                  : <><ToggleRight className="w-3.5 h-3.5 mr-2" /> Activate</>
                }
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(campaign.id)}
                className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Eye className="w-3.5 h-3.5 text-violet-400" />
          <span className="font-semibold text-white">{campaign.open_count}</span>
          <span>opens</span>
        </div>
        {campaign.last_opened_at && (
          <span className="text-slate-600">
            Last: {formatRelativeTime(campaign.last_opened_at)}
          </span>
        )}
      </div>

      {/* Copy buttons */}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 px-2.5"
          onClick={() => copyText(getPixelUrl(campaign.tracking_id, baseUrl), "url")}
        >
          {copied === "url" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied === "url" ? "Copied!" : "Pixel URL"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 px-2.5"
          onClick={() => copyText(getHtmlSnippet(campaign.tracking_id, baseUrl), "html")}
        >
          {copied === "html" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied === "html" ? "Copied!" : "HTML Snippet"}
        </Button>
      </div>
    </div>
  );
}
