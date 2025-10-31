
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ja';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { ScheduleEvent, Staff, Order, WithId } from '@/lib/types';
import { TaskAssignmentDialog } from './task-assignment-dialog';
import { EventDetailsDialog } from './event-details-dialog';
import { EventCreateDialog } from './event-create-dialog';
import { useToast } from '@/hooks/use-toast';
import { updateSheetStatus } from '@/app/actions/update-sheet-status';
import { ORDER_GAS_URL } from '@/lib/settings';

// 日本語ロケールを設定
moment.locale('ja');
const localizer = momentLocalizer(moment);

interface CalendarViewProps {
  orders: WithId<Order>[];
  staffList: WithId<Staff>[];
}

export function ScheduleCalendar({
  orders,
  staffList,
}: CalendarViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [events, setEvents] = useState<ScheduleEvent[]>([]);

  // 注文データをカレンダーイベントに変換
  useEffect(() => {
    const eventsFromOrders: ScheduleEvent[] = orders.map(order => {
      const deliveryDate = order['作業予定日'] ? new Date(order['作業予定日']) : new Date();
      if (order['予定時間']) {
        const timeParts = String(order['予定時間']).split(':');
        deliveryDate.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10));
      }

      const duration = order['作業時間（分）'] ? parseInt(order['作業時間（分）'], 10) : 60;

      return {
        id: `order-${order.id}`,
        title: `${order['お取引先名'] || '顧客名不明'} ${order['タイヤサイズ'] || ''}`,
        start: deliveryDate,
        end: new Date(deliveryDate.getTime() + duration * 60 * 1000),
        description: `
顧客: ${order['お取引先名']}
製品: ${order['タイヤサイズ'] || '未指定'}
本数: ${order['本数'] || '未指定'}
担当: ${order['担当'] || '未割り当て'}
ステータス: ${order['受注ステータス'] || '未設定'}
        `.trim(),
        staffName: order['担当'],
        status: order['受注ステータス'],
        allDay: false,
        resource: { orderId: order.id, raw: order }
      };
    });
    setEvents(eventsFromOrders);
  }, [orders]);

  const initialDate = useMemo(() => searchParams.get('date') 
    ? new Date(searchParams.get('date') as string)
    : new Date(), [searchParams]);

  const viewFromParams = useMemo(() => searchParams.get('view') || 'week', [searchParams]);
  
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day' | 'agenda'>(
    viewFromParams as any
  );
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [filteredStaff, setFilteredStaff] = useState<string | null>(null);
  const [showUnassigned, setShowUnassigned] = useState(true);
  
  const filteredEvents = useMemo(() => {
    let filtered = [...events];
    
    if (filteredStaff || !showUnassigned) {
      filtered = filtered.filter(event => {
        const isUnassigned = !event.staffName;
        const isMatchingStaff = filteredStaff ? event.staffName === filteredStaff : true;
        
        if (filteredStaff) { // 特定の担当者で絞り込み
          return isMatchingStaff;
        }
        
        // 未割り当てを表示しない場合
        if (!showUnassigned) {
          return !isUnassigned;
        }

        return true;
      });
    }
    
    return filtered;
  }, [events, filteredStaff, showUnassigned]);

  const updateUrlParams = useCallback((view: string, date: Date) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    params.set('date', date.toISOString().split('T')[0]);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const handleNavigate = useCallback((date: Date) => {
      setCurrentDate(date);
      updateUrlParams(calendarView, date);
  }, [calendarView, updateUrlParams]);

  const handleViewChange = useCallback((view: string) => {
    setCalendarView(view as any);
    updateUrlParams(view, currentDate);
  }, [currentDate, updateUrlParams]);

  const handleEventClick = (event: ScheduleEvent) => {
    setSelectedEvent(event);
    setIsDetailsDialogOpen(true);
  };

  const handleSlotSelect = (slotInfo: { start: Date, end: Date }) => {
    const newEvent: ScheduleEvent = {
      id: 'temp-' + Date.now(),
      title: '',
      start: slotInfo.start,
      end: slotInfo.end,
      allDay: false
    };
    setSelectedEvent(newEvent);
    setIsCreateDialogOpen(true);
  };
  
  const onEventUpdate = async (updatedEvent: ScheduleEvent) => {
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    // Here you could also trigger a server action to update a central calendar if needed
  };

  const onEventCreate = async (newEventData: ScheduleEvent) => {
    const createdEvent = { ...newEventData, id: 'manual-' + Date.now() };
    setEvents(prev => [...prev, createdEvent]);
    toast({ title: "イベントを作成しました" });
    return createdEvent;
  };
  
  const onEventDelete = async (eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
    toast({ title: "イベントを削除しました", variant: "destructive" });
    // Also trigger server action to delete if needed
  };

  const openAssignDialog = (event: ScheduleEvent) => {
    setSelectedEvent(event);
    setIsDetailsDialogOpen(false);
    setIsAssignDialogOpen(true);
  };

  const messages = {
    allDay: '終日',
    previous: '前へ',
    next: '次へ',
    today: '今日',
    month: '月',
    week: '週',
    day: '日',
    agenda: 'リスト',
    date: '日付',
    time: '時間',
    event: 'イベント',
    noEventsInRange: 'この期間にイベントはありません',
    showMore: (total: number) => `他 ${total} 件`
  };

  const eventStyleGetter = (event: ScheduleEvent) => {
    const staff = staffList.find(s => s.name === event.staffName);
    let backgroundColor = staff?.color || '#7c3aed'; // Purple for unassigned

    if (event.status) {
      switch (event.status.toLowerCase()) {
        case '完了':
        case 'キャンセル':
          backgroundColor = '#6b7280'; // Gray for completed/cancelled
          break;
      }
    }
    
    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        border: 'none',
        color: 'white',
        display: 'block',
        overflow: 'hidden'
      }
    };
  };

  const titleAccessor = (event: ScheduleEvent) => {
    const title = event.title || '(タイトルなし)';
    const staffName = event.staffName ? `[${event.staffName}] ` : '[未割当] ';
    return `${staffName}${title}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end mb-4">
        <div className="space-y-2">
          <Label htmlFor="staff-filter">担当者フィルター</Label>
          <Select
            value={filteredStaff || 'all-staff'}
            onValueChange={value => setFilteredStaff(value === 'all-staff' ? null : value)}
          >
            <SelectTrigger id="staff-filter" className="w-[200px]">
              <SelectValue placeholder="すべての担当者" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-staff">すべての担当者</SelectItem>
              {staffList.map(staff => (
                <SelectItem key={staff.id} value={staff.name}>
                  {staff.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="show-unassigned" 
            checked={showUnassigned}
            onCheckedChange={(checked) => setShowUnassigned(checked as boolean)}
          />
          <Label htmlFor="show-unassigned">未割り当てのタスクを表示</Label>
        </div>
        
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          新規イベント作成
        </Button>
      </div>
      
      <div className="h-[70vh] bg-white rounded-lg shadow p-2">
        <Calendar
          localizer={localizer}
          events={filteredEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          messages={messages}
          view={calendarView}
          onView={handleViewChange}
          date={currentDate}
          onNavigate={handleNavigate}
          eventPropGetter={eventStyleGetter}
          titleAccessor={titleAccessor}
          onSelectEvent={handleEventClick}
          onSelectSlot={handleSlotSelect}
          selectable={true}
          popup={true}
          components={{
            event: ({ event }) => (
              <div className="p-1 overflow-hidden">
                <div className="text-xs font-bold truncate">
                  {event.title || '(タイトルなし)'}
                </div>
                {event.staffName && (
                  <div className="text-xs truncate">担当: {event.staffName}</div>
                )}
              </div>
            )
          }}
        />
      </div>
      
      {isAssignDialogOpen && (
        <TaskAssignmentDialog
          isOpen={isAssignDialogOpen}
          onClose={() => setIsAssignDialogOpen(false)}
          selectedEvent={selectedEvent}
          staffList={staffList}
          onEventUpdated={onEventUpdate}
        />
      )}
      
      {isDetailsDialogOpen && selectedEvent && (
        <EventDetailsDialog
          isOpen={isDetailsDialogOpen}
          onClose={() => setIsDetailsDialogOpen(false)}
          event={selectedEvent}
          onAssign={openAssignDialog}
          onEdit={(eventToEdit) => {
            setSelectedEvent(eventToEdit);
            setIsDetailsDialogOpen(false);
            setIsCreateDialogOpen(true);
          }}
          onDelete={onEventDelete}
        />
      )}
      
      {isCreateDialogOpen && (
        <EventCreateDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          initialEvent={selectedEvent}
          onEventCreated={onEventCreate}
          onEventUpdated={onEventUpdate}
        />
      )}
    </div>
  );
}
