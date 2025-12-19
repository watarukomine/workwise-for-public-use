
'use client';

import * as React from 'react';
import type { WithId, Staff, Customer } from '../../lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { format, parseISO, isEqual, startOfDay, isValid } from 'date-fns';
import { Clock, MapPin, Briefcase } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCustomer } from '../../contexts/customer-context';
import Link from 'next/link';
import { useOrder } from '../../contexts/order-context';
import { STORE_COLORS } from '../../lib/constants';
import { useUserProfile } from '../../hooks/use-user-profile';

interface VerticalScheduleViewProps {
  staffData: WithId<Staff>[];
  currentDate: Date;
  checkedOutStaffIds?: Set<string>;
}

const formatTime = (date: Date | string | undefined) => {
  if (!date) return '時間未定';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return '無効な時間';
  return format(d, 'HH:mm');
};

export function VerticalScheduleView({ staffData, currentDate, checkedOutStaffIds }: VerticalScheduleViewProps) {
  const { customers } = useCustomer();
  const { scheduleEvents } = useOrder();
  const { profile } = useUserProfile();

  const getCustomerById = (id: string | undefined): WithId<Customer> | undefined => {
    if (!id) return undefined;
    // customer.id is userCode in some contexts. Let's find by either.
    return customers.find(c => c.id === id || c.userCode === id);
  };

  // Filter for events assigned to the currently displayed staff for the current date and sort by start time
  const staffIds = new Set(staffData.map(s => s.id));
  const relevantEvents = (scheduleEvents || [])
    .filter(event => {
      const eventDate = parseISO(event.start as string);
      return event.staffId &&
        staffIds.has(event.staffId) &&
        isValid(eventDate) &&
        isEqual(startOfDay(eventDate), startOfDay(currentDate)) &&
        !event.title.includes('移動'); // Hide travel events
    })
    .sort((a, b) => {
      const startA = typeof a.start === 'string' ? parseISO(a.start) : a.start;
      const startB = typeof b.start === 'string' ? parseISO(b.start) : b.start;
      return startA.getTime() - startB.getTime();
    });


  if (relevantEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ダッシュボード</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
            <Briefcase className="h-12 w-12 mb-4" />
            <p className="font-semibold">本日の予定はまだありません。</p>
            <p className="text-sm">管理者がタスクを割り当てるのをお待ちください。</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {relevantEvents.map((event, index) => {
        const customer = getCustomerById(event.locationId);
        const isTravel = event.title.includes('移動');
        const staffMember = staffData.find(s => s.id === event.staffId);
        const areaBgClass = staffMember?.['母店'] ? STORE_COLORS[staffMember['母店']] || '' : '';

        const eventCard = (
          <Card className={cn(
            "cursor-pointer hover:bg-muted/50",
            areaBgClass, // Apply store background color
            isTravel && "bg-secondary/50 border-dashed",
            checkedOutStaffIds?.has(event.staffId || '') && "opacity-50 grayscale bg-gray-100 dark:bg-gray-800",
            // Dim tasks assigned to other staff members
            profile && event.staffId !== profile.id && "opacity-40 grayscale-[0.8]"
          )}>
            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg leading-tight">{event.title}</CardTitle>
                <div
                  className="w-3 h-10 rounded-full"
                  style={{ backgroundColor: staffMember?.color || 'gray' }}
                />
              </div>
              {customer && <CardDescription>{customer.storeName}</CardDescription>}
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{formatTime(event.start)} - {formatTime(event.end)}</span>
              </div>
              {customer?.address && <div className="flex items-start gap-2 mt-2">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>{customer.address}</span>
              </div>}
            </CardContent>
          </Card>
        );

        const isOwnTask = profile?.id === event.staffId;
        return (
          <React.Fragment key={event.id}>
            {event.rawOrderId && !isTravel && isOwnTask ? (
              <Link href={`/check-in?orderId=${event.rawOrderId}`}>
                {eventCard}
              </Link>
            ) : (
              eventCard
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
