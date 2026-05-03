import { AppLayout } from "@/components/AppLayout";
import { CommandCenter } from "@/components/CommandCenter";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { TodayActivities } from "@/components/TodayActivities";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        
        <DashboardSidebar />
        <TodayActivities />
        <CommandCenter />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
