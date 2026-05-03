import { AppLayout } from "@/components/AppLayout";
import { CommandCenter } from "@/components/CommandCenter";
import { TodayActivities } from "@/components/TodayActivities";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        <TodayActivities />
        <CommandCenter />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
