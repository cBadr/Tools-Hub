"use client";

import { useState, useMemo } from "react";
import { Trash2, Play, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ProxyRow {
  id: string;
  type: string;
  host: string;
  port: number;
  status: string;
  latency_ms: number | null;
  jitter_ms: number | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  isp: string | null;
  anonymity: string | null;
  last_checked_at: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  http:   "bg-sky-500/15 text-sky-400 border-sky-500/20",
  https:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  socks4: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  socks5: "bg-violet-500/15 text-violet-400 border-violet-500/20",
};

const ANON_COLORS: Record<string, string> = {
  elite:       "text-green-400",
  anonymous:   "text-amber-400",
  transparent: "text-red-400",
  unknown:     "text-slate-600",
};

function latencyColor(ms: number | null): string {
  if (!ms) return "text-slate-600";
  if (ms < 300) return "text-green-400";
  if (ms < 800) return "text-amber-400";
  return "text-red-400";
}

function statusBadge(status: string) {
  if (status === "live")      return <span className="inline-flex items-center gap-1 text-green-400 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Live</span>;
  if (status === "dead")      return <span className="inline-flex items-center gap-1 text-red-400 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Dead</span>;
  return <span className="inline-flex items-center gap-1 text-slate-500 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-slate-600" />–</span>;
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
}

type SortKey = "type" | "host" | "status" | "latency_ms" | "jitter_ms" | "country" | "anonymity";

interface Props {
  proxies: ProxyRow[];
  selected: Set<string>;
  onSelectToggle: (id: string) => void;
  onSelectAll: () => void;
  onCheckOne: (proxy: ProxyRow) => void;
  onDeleteOne: (id: string) => void;
  filterStatus: string;
  filterType: string;
}

const PAGE = 100;

export function ProxyTable({ proxies, selected, onSelectToggle, onSelectAll, onCheckOne, onDeleteOne, filterStatus, filterType }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "latency_ms", dir: "asc" });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let rows = [...proxies];
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    if (filterType  !== "all") rows = rows.filter((r) => r.type === filterType);
    rows.sort((a, b) => {
      const av = (a as any)[sort.key] ?? "";
      const bv = (b as any)[sort.key] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [proxies, filterStatus, filterType, sort]);

  const pageData = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.ceil(filtered.length / PAGE);

  const toggleSort = (key: SortKey) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
    setPage(0);
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sort.key !== k) return <ChevronsUpDown className="w-3 h-3 text-slate-700" />;
    return sort.dir === "asc" ? <ChevronUp className="w-3 h-3 text-violet-400" /> : <ChevronDown className="w-3 h-3 text-violet-400" />;
  };

  const allPageSelected = pageData.length > 0 && pageData.every((r) => selected.has(r.id));

  const col = "text-left text-[10px] text-slate-500 uppercase tracking-wide font-medium px-3 py-2 cursor-pointer hover:text-slate-300 select-none";

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-white/5">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" checked={allPageSelected} onChange={onSelectAll}
                  className="accent-violet-500 w-3.5 h-3.5" />
              </th>
              <th className={col} onClick={() => toggleSort("type")}>
                <div className="flex items-center gap-1">Type <SortIcon k="type" /></div>
              </th>
              <th className={col} onClick={() => toggleSort("host")}>
                <div className="flex items-center gap-1">Host:Port <SortIcon k="host" /></div>
              </th>
              <th className={col} onClick={() => toggleSort("status")}>
                <div className="flex items-center gap-1">Status <SortIcon k="status" /></div>
              </th>
              <th className={col} onClick={() => toggleSort("latency_ms")}>
                <div className="flex items-center gap-1">Latency <SortIcon k="latency_ms" /></div>
              </th>
              <th className={col} onClick={() => toggleSort("jitter_ms")}>
                <div className="flex items-center gap-1">Jitter <SortIcon k="jitter_ms" /></div>
              </th>
              <th className={col} onClick={() => toggleSort("country")}>
                <div className="flex items-center gap-1">Country <SortIcon k="country" /></div>
              </th>
              <th className={col} onClick={() => toggleSort("anonymity")}>
                <div className="flex items-center gap-1">Anonymity <SortIcon k="anonymity" /></div>
              </th>
              <th className="text-left text-[10px] text-slate-500 uppercase tracking-wide font-medium px-3 py-2 w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-xs text-slate-600 py-10">No proxies match the current filter</td>
              </tr>
            ) : pageData.map((row) => (
              <tr key={row.id} className={`hover:bg-white/[0.03] transition-colors ${selected.has(row.id) ? "bg-violet-500/5" : ""}`}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(row.id)}
                    onChange={() => onSelectToggle(row.id)} className="accent-violet-500 w-3.5 h-3.5" />
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${TYPE_COLORS[row.type] ?? "text-slate-400 border-white/10"}`}>
                    {row.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-300">
                  {row.host}:{row.port}
                </td>
                <td className="px-3 py-2">{statusBadge(row.status)}</td>
                <td className={`px-3 py-2 text-xs font-mono tabular-nums ${latencyColor(row.latency_ms)}`}>
                  {row.latency_ms != null ? `${row.latency_ms}ms` : "—"}
                </td>
                <td className="px-3 py-2 text-xs font-mono tabular-nums text-slate-500">
                  {row.jitter_ms != null ? `${row.jitter_ms}ms` : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">
                  {row.country
                    ? <span title={`${row.city ?? ""}, ${row.isp ?? ""}`}>{countryFlag(row.country_code)} {row.country_code}</span>
                    : <span className="text-slate-700">—</span>}
                </td>
                <td className={`px-3 py-2 text-xs capitalize ${ANON_COLORS[row.anonymity ?? "unknown"] ?? "text-slate-600"}`}>
                  {row.anonymity ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onCheckOne(row)}
                      className="p-1 text-slate-600 hover:text-violet-400 transition-colors" title="Check">
                      <Play className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteOne(row.id)}
                      className="p-1 text-slate-600 hover:text-red-400 transition-colors" title="Delete">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5">
          <span className="text-xs text-slate-600">
            {filtered.length.toLocaleString()} proxies · page {page + 1}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="h-6 text-[10px] border-white/10 text-slate-400 hover:bg-white/5 px-2">Prev</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="h-6 text-[10px] border-white/10 text-slate-400 hover:bg-white/5 px-2">Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
