import Link from "next/link";
import { Mail, Wrench, Zap, ArrowRight } from "lucide-react";
import { toolRegistry } from "@/tools/_registry";
import { Badge } from "@/components/ui/badge";

const ICON_MAP: Record<string, React.ReactNode> = {
  Mail: <Mail className="w-5 h-5" />,
};

export const metadata = { title: "Tools — Tools Hub" };

export default function ToolsGalleryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tools</h1>
        <p className="text-sm text-slate-500 mt-1">All available tools in your hub</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {toolRegistry.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="group glass rounded-xl p-5 flex flex-col gap-3 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all duration-200"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-violet-600/20 border border-violet-500/20 flex items-center justify-center text-violet-400">
                {ICON_MAP[tool.icon] ?? <Wrench className="w-5 h-5" />}
              </div>
              {tool.isPro && (
                <Badge className="text-[9px] px-1.5 bg-amber-500/20 text-amber-300 border-amber-500/30">Pro</Badge>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-white text-sm">{tool.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{tool.description}</p>
            </div>

            <div className="flex items-center justify-between mt-auto pt-1">
              <Badge className="text-[9px] px-2 bg-white/5 text-slate-400 border-white/10 capitalize">
                {tool.category}
              </Badge>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
