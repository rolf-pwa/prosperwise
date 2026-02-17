import { AppSidebar } from "./AppSidebar";
import { AssistantSidebar } from "./AssistantSidebar";
import { GeorgiaWidget } from "./GeorgiaWidget";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
      <AssistantSidebar />
      <GeorgiaWidget />
    </div>
  );
}
