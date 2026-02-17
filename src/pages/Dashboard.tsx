import { AppLayout } from "@/components/AppLayout";
import { CommandCenter } from "@/components/CommandCenter";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">ProsperWise CRM Overview</p>
        </div>

        {/* Command Center — Calendar & Gmail */}
        <CommandCenter />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
