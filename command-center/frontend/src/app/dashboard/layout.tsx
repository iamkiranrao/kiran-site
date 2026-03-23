import { Sidebar } from "@/components/Sidebar";
import { ApiKeyModal } from "@/components/ApiKeyModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="ml-[260px] min-h-screen overflow-y-auto">
        <div className="p-8 max-w-5xl">
          {children}
        </div>
      </main>
      <ApiKeyModal />
    </div>
  );
}
