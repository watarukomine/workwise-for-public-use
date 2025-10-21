import { RouteOptimizer } from "@/components/optimizer/route-optimizer";
import { customerData } from "@/lib/data";

export default function OptimizerPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Route Optimizer</h1>
        <p className="text-muted-foreground">
          Generate the most efficient route between multiple work locations.
        </p>
      </div>
      <RouteOptimizer customers={customerData} />
    </div>
  );
}
