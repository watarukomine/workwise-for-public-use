
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { OrderProvider, useOrder } from '@/contexts/order-context';
import { SelectedStaffProvider, useSelectedStaff } from '@/contexts/selected-staff-context';
import { ScheduleCalendar } from '@/components/schedule/calendar-view';

export const metadata: Metadata = {
  title: 'スケジュール管理',
};

// This wrapper component is needed to use hooks inside a Server Component's child
function SchedulePageClient() {
  const { orders } = useOrder();
  const { allStaff } = useSelectedStaff();

  return (
    <CalendarView 
      orders={orders}
      staffList={allStaff}
    />
  );
}


export default function SchedulePage() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>スケジュール管理</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoadingSpinner />}>
            <SchedulePageClient />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
