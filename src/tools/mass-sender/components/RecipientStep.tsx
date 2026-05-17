"use client";

import { useState, useRef, useCallback } from "react";
import { Users, Upload, Search, Trash2, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import useSWR from "swr";
import { createClientSupabase } from "@/lib/supabase/client";

export interface RecipientRow {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
}

interface Props {
  selected: RecipientRow[];
  onChange: (rows: RecipientRow[]) => void;
}

const supabase = createClientSupabase();

function useContacts() {
  return useSWR("mass_contacts", async () => {
    const { data } = await supabase
      .from("extracted_contacts")
      .select("value, source_from, source_subject, source_date")
      .eq("type", "email")
      .order("source_date", { ascending: false })
      .limit(5000);
    return (data ?? []).map((r) => {
      const email = (r.value as string).toLowerCase().trim();
      const namePart = ((r.source_from as string) ?? "").replace(/<.*>/, "").trim();
      const parts = namePart.split(" ");
      return {
        email,
        first_name: parts[0] ?? "",
        last_name:  parts.slice(1).join(" ") ?? "",
        company:    "",
      } as RecipientRow;
    }).filter((r) => r.email.includes("@"));
  });
}

export function RecipientStep({ selected, onChange }: Props) {
  const { data: contacts = [] } = useContacts();
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Deduplicate by email
  const allRows: RecipientRow[] = Array.from(
    new Map([...contacts].map((r) => [r.email, r])).values()
  );

  const filtered = search
    ? allRows.filter((r) => r.email.includes(search.toLowerCase()) || (r.first_name + " " + r.last_name).toLowerCase().includes(search.toLowerCase()))
    : allRows;

  const selectedEmails = new Set(selected.map((r) => r.email));

  function toggle(row: RecipientRow) {
    if (selectedEmails.has(row.email)) {
      onChange(selected.filter((r) => r.email !== row.email));
    } else {
      onChange([...selected, row]);
    }
  }

  function selectAll() { onChange(filtered); }
  function clearAll()  { onChange([]); }

  // CSV import
  function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).split("\n").slice(1); // skip header
      const rows: RecipientRow[] = [];
      for (const line of lines) {
        const [email, first_name, last_name, company] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
        if (email?.includes("@")) rows.push({ email: email.toLowerCase(), first_name, last_name, company });
      }
      onChange([...selected, ...rows.filter((r) => !selectedEmails.has(r.email))]);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-slate-200">اختر المستلمين</span>
          {selected.length > 0 && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-violet-600/30 text-violet-300 border-violet-500/30">
              {selected.length.toLocaleString()} مختار
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={selectAll}>تحديد الكل</Button>
          {selected.length > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400/70 hover:text-red-400" onClick={clearAll}>
              <Trash2 className="w-3 h-3 ml-1" /> إلغاء الكل
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs border-white/10" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3 h-3 ml-1" /> استيراد CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالإيميل أو الاسم..."
          className="pr-9 h-8 text-sm bg-white/3 border-white/8"
        />
      </div>

      <div className="border border-white/8 rounded-xl overflow-hidden">
        <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              {contacts.length === 0 ? "لا توجد جهات اتصال مستخرجة بعد" : "لا توجد نتائج"}
            </div>
          ) : (
            filtered.slice(0, 200).map((row) => {
              const checked = selectedEmails.has(row.email);
              return (
                <button
                  key={row.email}
                  type="button"
                  onClick={() => toggle(row)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors text-left ${checked ? "bg-violet-500/5" : ""}`}
                >
                  {checked
                    ? <CheckSquare className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    : <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">{row.email}</p>
                    {(row.first_name || row.last_name) && (
                      <p className="text-[11px] text-slate-600 truncate">{[row.first_name, row.last_name].filter(Boolean).join(" ")}</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
        {filtered.length > 200 && (
          <div className="px-4 py-2 text-[11px] text-slate-600 border-t border-white/5">
            يظهر 200 من {filtered.length.toLocaleString()} — استخدم البحث لتضييق النطاق
          </div>
        )}
      </div>
    </div>
  );
}
