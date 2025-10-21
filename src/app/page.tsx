import { ScheduleView } from '@/components/dashboard/schedule-view';
import { StatusUpdates } from '@/components/dashboard/status-updates';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today's Schedule</h1>
        <p className="text-muted-foreground">
          An overview of scheduled jobs for today.
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ScheduleView />
        </div>
        <div className="lg:col-span-1">
          <StatusUpdates />
        </div>
      </div>
    </div>
  );
}
