import { AppLayout } from "@/components/AppLayout";
import { CommandCenter } from "@/components/CommandCenter";
import { StaffCommandBar } from "@/components/StaffCommandBar";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-foreground">Command Center</h1>

        {/* Staff Command Bar */}
        <StaffCommandBar />

        {/* Command Center — Calendar & Gmail */}
        <CommandCenter />
      </div>
    </AppLayout>
  );
};

export default Dashboard;

