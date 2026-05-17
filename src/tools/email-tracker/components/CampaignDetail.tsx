"use client";

import { useState } from "react";
import useSWR from "swr";
import { ArrowLeft, Copy, Check, Eye, Globe, Clock, Mail, Trash2, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { createClientSupabase } from "@/lib/supabase/client";
import { formatRelativeTime, formatDateTime, getCountryFlag, getDeviceIcon } from "@/lib/utils";
import { getPixelUrl, getSnippet, TRACKING_TYPES, type TrackingType } from "../lib/pixel";
import type { Campaign, OpenEvent } from "@/types/email-tracker";

interface Props {
  campaign: Campaign;
  onBack: () => void;
  baseUrl: string;
}

const COMPATIBILITY_COLORS = {
  high: "bg-green-500/15 text-green-400 border-green-500/20",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  low: "bg-red-500/15 text-red-400 border-red-500/20",
};

export function CampaignDetail({ campaign, onBack, baseUrl }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<TrackingType>("img");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [deleting, setDeleting] = useState<"all" | "dupes" | null>(null);
  const supabase = createClientSupabase();

  const { data: events, isLoading, mutate } = useSWR(
    ["open_events", campaign.id],
    async () => {
      const { data } = await supabase
        .from("email_open_events")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("opened_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    { refreshInterval: 10000 }
  );

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Delete all ${events?.length ?? 0} events for this campaign? This cannot be undone.`)) return;
    setDeleting("all");
    await supabase.from("email_open_events").delete().eq("campaign_id", campaign.id);
    await supabase.from("email_campaigns").update({ open_count: 0, last_opened_at: null }).eq("id", campaign.id);
    await mutate([]);
    setDeleting(null);
  };

  const handleDeleteDuplicates = async () => {
    if (!events || events.length === 0) return;

    // Keep the earliest event per IP; delete the rest (IPs without address grouped together)
    const seen = new Set<string>();
    const toDelete: number[] = [];

    // Sort oldest first so we keep the first occurrence
    const sorted = [...events].sort(
      (a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
    );

    for (const e of sorted) {
      const key = e.ip_address ?? `__no_ip_${e.id}`;
      if (seen.has(key)) {
        toDelete.push(e.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length === 0) {
      alert("No duplicate events found.");
      return;
    }

    if (!confirm(`Delete ${toDelete.length} duplicate event(s)? Only the first open per IP will be kept.`)) return;

    setDeleting("dupes");
    await supabase.from("email_open_events").delete().in("id", toDelete);
    const newCount = events.length - toDelete.length;
    await supabase.from("email_campaigns").update({ open_count: newCount }).eq("id", campaign.id);
    await mutate();
    setDeleting(null);
  };

  const email = recipientEmail.trim() || undefined;
  const snippetUrl = getPixelUrl(campaign.tracking_id, baseUrl, activeType, email);
  const snippetCode = getSnippet(campaign.tracking_id, baseUrl, activeType, email);
  const activeTypeInfo = TRACKING_TYPES.find((t) => t.type === activeType)!;

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-slate-400 hover:text-white hover:bg-white/5"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-white text-lg truncate">{campaign.name}</h2>
          {campaign.description && (
            <p className="text-xs text-slate-500 truncate">{campaign.description}</p>
          )}
        </div>
        <Badge className={`text-xs ${campaign.is_active ? "bg-green-500/15 text-green-400 border-green-500/20" : "bg-slate-500/15 text-slate-400 border-slate-500/20"}`}>
          {campaign.is_active ? "Active" : "Paused"}
        </Badge>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Eye className="w-4 h-4 text-violet-400" />} label="Total Opens" value={campaign.open_count} />
        <StatCard icon={<Globe className="w-4 h-4 text-indigo-400" />} label="Last Open" value={campaign.last_opened_at ? formatRelativeTime(campaign.last_opened_at) : "Never"} />
        <StatCard icon={<Clock className="w-4 h-4 text-cyan-400" />} label="Created" value={formatRelativeTime(campaign.created_at)} />
      </div>

      {/* Tracking snippet */}
      <div className="glass rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Tracking Snippet</h3>

        {/* Recipient email input */}
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Recipient Email <span className="text-slate-700">(optional — personalizes tracking per recipient)</span></label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="pl-8 h-8 text-xs bg-white/5 border-white/10 text-slate-300 placeholder:text-slate-700 focus-visible:ring-violet-500/30"
            />
          </div>
        </div>

        {/* Tracking type tabs */}
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {TRACKING_TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => setActiveType(t.type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeType === t.type
                    ? "bg-violet-600 text-white"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-start gap-2">
            <Badge className={`text-[10px] px-1.5 flex-shrink-0 ${COMPATIBILITY_COLORS[activeTypeInfo.compatibility]}`}>
              {activeTypeInfo.compatibility === "high" ? "High compatibility" : activeTypeInfo.compatibility === "medium" ? "Medium compatibility" : "Low compatibility"}
            </Badge>
            <p className="text-[11px] text-slate-600 leading-tight">{activeTypeInfo.description}</p>
          </div>
        </div>

        {/* Snippet rows */}
        <div className="space-y-2">
          <SnippetRow
            label="URL"
            value={snippetUrl}
            copyKey="url"
            copied={copied}
            onCopy={copyText}
          />
          <SnippetRow
            label="HTML"
            value={snippetCode}
            copyKey="html"
            copied={copied}
            onCopy={copyText}
          />
        </div>
      </div>

      {/* Events table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-300 shrink-0">
            Open Events
            {events && <span className="ml-2 text-slate-600 font-normal">({events.length})</span>}
          </h3>
          <div className="flex items-center gap-2">
            {events && events.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!!deleting}
                  onClick={handleDeleteDuplicates}
                  className="h-7 gap-1.5 text-xs text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20"
                >
                  {deleting === "dupes"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Filter className="w-3 h-3" />}
                  Delete duplicates
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!!deleting}
                  onClick={handleDeleteAll}
                  className="h-7 gap-1.5 text-xs text-red-400/70 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                >
                  {deleting === "all"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" />}
                  Delete all
                </Button>
              </>
            )}
            <span className="text-[10px] text-slate-700 shrink-0">Auto-refreshes every 10s</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full bg-white/5 rounded-lg" />)}
          </div>
        ) : !events || events.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <Eye className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-600">No opens yet</p>
            <p className="text-xs text-slate-700 mt-1">Embed the snippet in an email and send it</p>
          </div>
        ) : (
          <div className="glass rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-xs text-slate-500 font-medium">Time</TableHead>
                    <TableHead className="text-xs text-slate-500 font-medium">Recipient</TableHead>
                    <TableHead className="text-xs text-slate-500 font-medium">Location</TableHead>
                    <TableHead className="text-xs text-slate-500 font-medium">Device</TableHead>
                    <TableHead className="text-xs text-slate-500 font-medium">Browser / OS</TableHead>
                    <TableHead className="text-xs text-slate-500 font-medium">IP</TableHead>
                    <TableHead className="text-xs text-slate-500 font-medium">Notif.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: OpenEvent }) {
  return (
    <TableRow className="border-b border-white/5 hover:bg-white/[0.02]">
      <TableCell className="text-xs text-slate-400 whitespace-nowrap py-3">
        <span title={formatDateTime(event.opened_at)}>{formatRelativeTime(event.opened_at)}</span>
      </TableCell>
      <TableCell className="text-xs py-3 max-w-[160px]">
        {event.recipient_email ? (
          <span className="text-violet-300 font-mono truncate block" title={event.recipient_email}>
            {event.recipient_email}
          </span>
        ) : event.referer ? (
          <span className="text-slate-500 truncate block" title={event.referer}>
            <span className="text-slate-600 text-[10px]">via </span>
            {(() => {
              try { return new URL(event.referer).hostname; } catch { return event.referer.slice(0, 30); }
            })()}
          </span>
        ) : (
          <span className="text-slate-700">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs py-3">
        {event.country ? (
          <div>
            <span className="text-white">
              {getCountryFlag(event.country_code ?? "")} {event.country}
            </span>
            {event.city && <div className="text-slate-600">{event.city}</div>}
          </div>
        ) : (
          <span className="text-slate-600">Unknown</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-slate-400 py-3">
        <span title={[event.device_vendor, event.device_model].filter(Boolean).join(" ") || undefined}>
          {getDeviceIcon(event.device_type)} {event.device_type ?? "Desktop"}
        </span>
      </TableCell>
      <TableCell className="text-xs py-3">
        {event.browser && (
          <div className="text-white">{event.browser} {event.browser_major ?? ""}</div>
        )}
        {event.os && (
          <div className="text-slate-500">{event.os} {event.os_version ?? ""}</div>
        )}
      </TableCell>
      <TableCell className="text-xs text-slate-500 font-mono py-3 whitespace-nowrap">
        {event.ip_address ?? "—"}
        {event.ip_is_proxy && <Badge className="ml-1 text-[8px] px-1 bg-orange-500/20 text-orange-400 border-orange-500/20">VPN</Badge>}
      </TableCell>
      <TableCell className="text-xs py-3">
        {event.telegram_sent ? (
          <span className="text-green-500" title="Sent">✓</span>
        ) : event.telegram_error ? (
          <span className="text-red-500" title={event.telegram_error}>✗</span>
        ) : (
          <span className="text-slate-700">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="glass rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="font-semibold text-white text-sm">{value}</div>
      </div>
    </div>
  );
}

function SnippetRow({
  label,
  value,
  copyKey,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-10 flex-shrink-0">{label}</span>
      <code className="flex-1 text-xs bg-white/5 rounded-lg px-3 py-2 text-violet-300 font-mono truncate min-w-0">
        {value}
      </code>
      <Button
        variant="ghost"
        size="icon"
        className="w-8 h-8 flex-shrink-0 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10"
        onClick={() => onCopy(value, copyKey)}
      >
        {copied === copyKey ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
}
