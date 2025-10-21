import { ScheduleView } from '@/components/dashboard/schedule-view';
import { StatusUpdates } from '@/components/dashboard/status-updates';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">管理者ダッシュボード</h1>
        <p className="text-muted-foreground">
          スタッフのスケジュールと現在の状況を一覧で確認できます。
        </p>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
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
