import Link from "next/link";
import { Mail, Inbox, Shield, Wrench, Zap, ArrowRight } from "lucide-react";
import { toolRegistry } from "@/tools/_registry";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Dashboard — Tools Hub" };

const TOOL_ICONS: Record<string, React.ReactNode> = {
  "email-tracker":   <Mail className="w-5 h-5" />,
  "email-extractor": <Inbox className="w-5 h-5" />,
  "proxy-checker":   <Shield className="w-5 h-5" />,
};

const ICON_BY_NAME: Record<string, React.ReactNode> = {
  Mail:   <Mail className="w-5 h-5" />,
  Inbox:  <Inbox className="w-5 h-5" />,
  Shield: <Shield className="w-5 h-5" />,
  Wrench: <Wrench className="w-5 h-5" />,
  Zap:    <Zap className="w-5 h-5" />,
};

export default function DashboardPage() {
  const activeTools = toolRegistry.filter((t) => t.isActive);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Welcome */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        </div>
        <p className="text-sm text-slate-500 ml-8">Your productivity hub — all tools in one place</p>
      </div>

      {/* Quick access */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">
          Your Tools <span className="text-violet-500/60 ml-1">{activeTools.length}</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeTools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group glass rounded-xl p-4 flex items-center gap-3 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-lg bg-violet-600/20 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                {TOOL_ICONS[tool.slug] ?? ICON_BY_NAME[tool.icon] ?? <Zap className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-white">{tool.name}</span>
                  {tool.isPro && (
                    <Badge className="text-[8px] px-1 bg-amber-500/20 text-amber-300 border-amber-500/20">Pro</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 truncate mt-0.5">{tool.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Quick tips */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">Quick Tips</h2>
        <div className="glass rounded-xl p-5 space-y-3">
          <Tip icon={<Mail className="w-4 h-4 text-violet-400" />}
            title="Email Tracker"
            description="Create a campaign → copy the HTML snippet → paste it in your email → get Telegram alerts on every open" />
          <Tip icon={<Inbox className="w-4 h-4 text-violet-400" />}
            title="Email Extractor"
            description="Connect your inbox via IMAP or OAuth → choose folders → extract emails, phones, contacts and calendar attendees" />
          <Tip icon={<Shield className="w-4 h-4 text-violet-400" />}
            title="Proxy Checker"
            description="Fetch from built-in sources or paste your own list → check concurrently → export live proxies as CSV" />
          <div className="pt-1 border-t border-white/5">
            <p className="text-xs text-slate-600">
              Configure Telegram notifications once in{" "}
              <Link href="/settings" className="text-violet-400 hover:underline">Settings</Link>
              {" "}— all tools share the same bot.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tip({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-violet-600/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-300">{title}</p>
        <p className="text-xs text-slate-600 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
