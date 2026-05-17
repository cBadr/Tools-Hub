"use client";

import { usePathname } from "next/navigation";
import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/hooks/useUser";

function getBreadcrumb(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/tools") return "Tools";
  if (pathname === "/settings") return "Settings";
  if (pathname.startsWith("/tools/")) {
    const slug = pathname.split("/")[2];
    return slug
      ? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : "Tool";
  }
  return "Tools Hub";
}

export function Topbar() {
  const pathname = usePathname();
  const { user } = useUser();
  const breadcrumb = getBreadcrumb(pathname);

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "TH";

  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 border-b border-violet-900/20 bg-[#0a0a0f]/80 backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-400">Tools Hub</span>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-semibold text-white">{breadcrumb}</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-slate-500 hover:text-slate-300 hover:bg-white/5"
        >
          <Bell className="w-4 h-4" />
        </Button>

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer select-none shadow-lg shadow-violet-900/30">
          {initials}
        </div>
      </div>
    </header>
  );
}
