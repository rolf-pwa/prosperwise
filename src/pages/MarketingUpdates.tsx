import { AppLayout } from "@/components/AppLayout";
import { MarketingUpdateWidget } from "@/components/MarketingUpdateWidget";

const MarketingUpdates = () => {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold text-foreground">Marketing Updates</h1>
        <MarketingUpdateWidget />
      </div>
    </AppLayout>
  );
};

export default MarketingUpdates;
