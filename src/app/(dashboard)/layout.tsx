import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ProxyCheckProvider } from "@/tools/proxy-checker/CheckContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProxyCheckProvider>
      <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Topbar />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ProxyCheckProvider>
  );
}
