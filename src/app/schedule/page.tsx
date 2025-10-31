'use client';

import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { OrderProvider, useOrder } from '@/contexts/order-context';
import { SelectedStaffProvider, useSelectedStaff } from '@/contexts/selected-staff-context';
import { ScheduleCalendar } from '@/components/schedule/calendar-view';

// This wrapper component is needed to use hooks inside a Server Component's child
function SchedulePageClient() {
  const { orders, isLoading: isLoadingOrders } = useOrder();
  const { allStaff, isLoading: isLoadingStaff } = useSelectedStaff();

  if (isLoadingOrders || isLoadingStaff) {
    return <LoadingSpinner />;
  }

  return (
    <ScheduleCalendar
      orders={orders}
      staffList={allStaff}
    />
  );
}

export default function SchedulePage() {
  return (
    <OrderProvider>
      <SelectedStaffProvider>
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
      </SelectedStaffProvider>
    </OrderProvider>
  );
}
