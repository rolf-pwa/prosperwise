import { AppLayout } from "@/components/AppLayout";
import { CommandCenter } from "@/components/CommandCenter";
import { DashboardSidebar } from "@/components/DashboardSidebar";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-foreground">Command Center</h1>
        <DashboardSidebar />
        <CommandCenter />
      </div>
    </AppLayout>
  );
};

export default Dashboard;

