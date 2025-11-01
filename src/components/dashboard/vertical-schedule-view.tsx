'use client';

import * as React from 'react';
import type { ScheduleEvent, Staff, Customer, WithId } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { Clock, MapPin, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCustomer } from '@/contexts/customer-context';

interface VerticalScheduleViewProps {
  scheduleData: WithId<ScheduleEvent>[];
  staffData: WithId<Staff>[];
}

const formatTime = (date: Date | string | undefined) => {
  if (!date) return '時間未定';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return '無効な時間';
  return format(d, 'HH:mm');
};

export function VerticalScheduleView({ scheduleData, staffData }: VerticalScheduleViewProps) {
    const { customers } = useCustomer();
    const getCustomerById = (id: string | undefined): WithId<Customer> | undefined => {
        if (!id) return undefined;
        return customers.find(c => c.userCode === id);
    };
    
    // Filter for events assigned to the currently displayed staff
    const staffIds = new Set(staffData.map(s => s.id));
    const relevantEvents = scheduleData.filter(event => event.staffId && staffIds.has(event.staffId));

  if (relevantEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>本日の予定</CardTitle>
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
        const nextEvent = relevantEvents[index + 1];

        return (
          <React.Fragment key={event.id}>
            <Card className={cn("cursor-pointer hover:bg-muted/50", isTravel && "bg-secondary/50 border-dashed")}>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg leading-tight">{event.title}</CardTitle>
                    <div 
                        className="w-3 h-10 rounded-full" 
                        style={{ backgroundColor: staffData.find(s => s.id === event.staffId)?.color || 'gray' }}
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
            
            {/* Show travel time between tasks */}
            {nextEvent && !isTravel && !nextEvent.title.includes('移動') && (
                <div className="flex items-center justify-center gap-2 my-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>次の現場まで 約30分</span>
                </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
