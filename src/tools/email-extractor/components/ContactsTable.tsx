"use client";

import { useState } from "react";
import useSWR from "swr";
import { Mail, Phone, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { createClientSupabase } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import type { ExtractedContact } from "@/types/email-extractor-tool";

interface Props { jobId: string; jobLabel: string; onBack: () => void; }

export function ContactsTable({ jobId, jobLabel, onBack }: Props) {
  const [filter, setFilter] = useState<"all" | "email" | "phone">("all");
  const [search, setSearch] = useState("");
  const supabase = createClientSupabase();

  const { data: contacts, isLoading } = useSWR(
    ["contacts", jobId],
    async () => {
      const { data } = await supabase
        .from("extracted_contacts")
        .select("*")
        .eq("job_id", jobId)
        .order("type")
        .order("value");
      return data ?? [];
    }
  );

  const filtered = (contacts ?? []).filter((c) => {
    if (filter !== "all" && c.type !== filter) return false;
    if (search && !c.value.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const emailCount = contacts?.filter((c) => c.type === "email").length ?? 0;
  const phoneCount = contacts?.filter((c) => c.type === "phone").length ?? 0;

  const handleExportCSV = () => {
    if (!contacts || contacts.length === 0) return;
    const rows = [
      ["Type", "Value", "Source Folder", "Subject", "From", "Date"],
      ...contacts.map((c) => [
        c.type, c.value,
        c.source_folder ?? "", c.source_subject ?? "",
        c.source_from ?? "", c.source_date ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `contacts-${jobId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm">← Back</button>
        <h2 className="font-bold text-white flex-1 truncate">{jobLabel}</h2>
        <Button variant="outline" size="sm" onClick={handleExportCSV}
          className="gap-1.5 border-white/10 text-slate-300 hover:bg-white/5 h-8 text-xs">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        {[
          { label: "all", text: `All (${(contacts?.length ?? 0).toLocaleString()})` },
          { label: "email", text: `Emails (${emailCount.toLocaleString()})` },
          { label: "phone", text: `Phones (${phoneCount.toLocaleString()})` },
        ].map(({ label, text }) => (
          <button key={label} onClick={() => setFilter(label as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === label ? "bg-violet-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
            {text}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs bg-white/5 border-white/10 text-slate-300 placeholder:text-slate-600" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-10 w-full bg-white/5 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center">
          <p className="text-sm text-slate-600">No results found</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  <TableHead className="text-xs text-slate-500 font-medium w-16">Type</TableHead>
                  <TableHead className="text-xs text-slate-500 font-medium">Value</TableHead>
                  <TableHead className="text-xs text-slate-500 font-medium">Folder</TableHead>
                  <TableHead className="text-xs text-slate-500 font-medium">Subject</TableHead>
                  <TableHead className="text-xs text-slate-500 font-medium">From</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 500).map((c) => (
                  <TableRow key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <TableCell className="py-2.5">
                      {c.type === "email"
                        ? <Badge className="text-[10px] bg-violet-500/15 text-violet-400 border-violet-500/20 gap-1"><Mail className="w-2.5 h-2.5" />Email</Badge>
                        : <Badge className="text-[10px] bg-cyan-500/15 text-cyan-400 border-cyan-500/20 gap-1"><Phone className="w-2.5 h-2.5" />Phone</Badge>}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-200 py-2.5">{c.value}</TableCell>
                    <TableCell className="text-xs text-slate-600 py-2.5">{c.source_folder ?? "—"}</TableCell>
                    <TableCell className="text-xs text-slate-500 py-2.5 max-w-[200px] truncate">{c.source_subject ?? "—"}</TableCell>
                    <TableCell className="text-xs text-slate-600 py-2.5 max-w-[150px] truncate">{c.source_from ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 500 && (
            <p className="text-[11px] text-slate-600 text-center py-2">Showing 500 of {filtered.length.toLocaleString()} — export CSV for full list</p>
          )}
        </div>
      )}
    </div>
  );
}
