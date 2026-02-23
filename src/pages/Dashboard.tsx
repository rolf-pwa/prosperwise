import { AppLayout } from "@/components/AppLayout";
import { CommandCenter } from "@/components/CommandCenter";
import { DashboardSidebar } from "@/components/DashboardSidebar";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="flex gap-8">
        <div className="flex-1 space-y-8 min-w-0">
          <h1 className="text-3xl font-bold text-foreground">Command Center</h1>
          <CommandCenter />
        </div>
        <aside className="hidden lg:block w-72 shrink-0 space-y-4">
          <DashboardSidebar />
        </aside>
      </div>
    </AppLayout>
  );
};

export default Dashboard;

