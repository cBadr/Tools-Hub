"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  Mail,
  Inbox,
  Shield,
  ChevronRight,
  Wrench,
  LogOut,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toolRegistry } from "@/tools/_registry";
import { createClientSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  marketing: <Mail className="w-3.5 h-3.5" />,
  text: <Wrench className="w-3.5 h-3.5" />,
  developer: <Zap className="w-3.5 h-3.5" />,
  data: <Wrench className="w-3.5 h-3.5" />,
  productivity: <Zap className="w-3.5 h-3.5" />,
  media: <Wrench className="w-3.5 h-3.5" />,
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  "email-tracker":   <Mail className="w-4 h-4" />,
  "email-extractor": <Inbox className="w-4 h-4" />,
  "proxy-checker":   <Shield className="w-4 h-4" />,
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientSupabase();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const grouped = toolRegistry.reduce<Record<string, typeof toolRegistry>>((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {});

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col border-r border-violet-900/20 bg-[#0c0c18]">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-violet-900/20">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/30">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-white">Tools Hub</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Dashboard */}
        <NavItem
          href="/dashboard"
          icon={<LayoutDashboard className="w-4 h-4" />}
          label="Dashboard"
          active={pathname === "/dashboard"}
        />

        {/* Tools gallery */}
        <NavItem
          href="/tools"
          icon={<Wrench className="w-4 h-4" />}
          label="All Tools"
          active={pathname === "/tools"}
        />

        {/* Tools by category */}
        {Object.entries(grouped).map(([category, tools]) => (
          <div key={category} className="pt-3">
            <div className="flex items-center gap-1.5 px-2 pb-1.5">
              <span className="text-violet-500/60">{CATEGORY_ICONS[category] ?? <Wrench className="w-3.5 h-3.5" />}</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/50">
                {category}
              </span>
            </div>
            {tools.map((tool) => (
              <NavItem
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                icon={TOOL_ICONS[tool.slug] ?? <Wrench className="w-4 h-4" />}
                label={tool.name}
                active={pathname.startsWith(`/tools/${tool.slug}`)}
                badge={tool.isPro ? "Pro" : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-violet-900/20 space-y-1">
        <NavItem
          href="/settings"
          icon={<Settings className="w-4 h-4" />}
          label="Settings"
          active={pathname === "/settings"}
        />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 h-9 px-2.5 text-sm font-normal text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
        active
          ? "bg-violet-600/15 text-violet-300 shadow-inner shadow-violet-500/5"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
      )}
    >
      <span className={cn(active ? "text-violet-400" : "text-slate-500")}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-violet-600/30 text-violet-300 border-violet-500/30">
          {badge}
        </Badge>
      )}
      {active && <ChevronRight className="w-3 h-3 text-violet-500/50" />}
    </Link>
  );
}
