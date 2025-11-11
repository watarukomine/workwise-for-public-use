
'use client';

import * as React from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ScheduleEvent, Staff, Customer, Order, WithId, StaffStatus } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { addMinutes, differenceInMinutes, format, parseISO, subMinutes, isToday, isValid, isEqual, startOfDay } from 'date-fns';
import { cn, findKey, formatTime, mapRawToOrder } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomer } from '@/contexts/customer-context';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { useOrder } from '@/contexts/order-context';
import { updateSheetStatus } from '@/app/actions/gas-actions';
import { ORDER_GAS_URL } from '@/lib/settings';
import { Badge } from '@/components/ui/badge';
import * as ics from 'ics';

const PIXELS_PER_MINUTE = 1.5;
const timelineStartHour = 9;
const timelineEndHour = 19;
const timelineTotalHours = timelineEndHour - timelineStartHour;
const TRAVEL_TIME_MINUTES = 30;
const UNASSIGNED_TASKS_DROPPABLE_ID = 'unassigned-tasks-droppable-area';
const STAFF_COL_WIDTH = 144; 
const STATUS_COL_WIDTH = 120;


const statusColors: Record<StaffStatus['status'], string> = {
  '待機中': 'bg-gray-400',
  '移動中': 'bg-yellow-500',
  '作業待ち': 'bg-blue-500',
  '作業中': 'bg-green-500',
  '作業完了': 'bg-purple-500',
  '未割当': 'bg-red-500',
};

const statusJapanese: Record<StaffStatus['status'], string> = {
  '待機中': '待機中',
  '移動中': '移動中',
  '作業待ち': '作業待ち',
  '作業中': '作業中',
  '作業完了': '作業完了',
  '未割当': '未割当',
};


const timeStringToDate = (timeStr: string, baseDate: Date) => {
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
        console.error("Invalid time string format:", timeStr);
        return new Date(NaN);
    }
    const date = new Date(baseDate);
    const [hours, minutes] = timeStr.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
};

const minutesToPixels = (minutes: number) => minutes * PIXELS_PER_MINUTE;

const pixelsToMinutes = (pixels: number) => Math.round(pixels / PIXELS_PER_MINUTE / 15) * 15;

const getEventDimensions = (eventStart: Date | string, eventEnd: Date | string) => {
  const start = typeof eventStart === 'string' ? parseISO(eventStart) : eventStart;
  const end = typeof eventEnd === 'string' ? parseISO(eventEnd) : eventEnd;

  if (!start || !end || !isValid(start) || !isValid(end)) {
    return { left: 0, width: minutesToPixels(60) }; 
  }
  
  const startOfDay = new Date(start);
  startOfDay.setHours(timelineStartHour, 0, 0, 0);

  const leftInMinutes = differenceInMinutes(start, startOfDay);
  const widthInMinutes = differenceInMinutes(end, start);

  return {
    left: minutesToPixels(leftInMinutes),
    width: minutesToPixels(widthInMinutes > 0 ? widthInMinutes : 30), 
  };
};

interface DraggableOrderProps {
  order: WithId<Order>;
  customer?: WithId<Customer>;
  className?: string;
}

const DraggableOrder: React.FC<DraggableOrderProps> = ({ order, customer, className }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `order-${order.id}`,
      data: order,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
    width: `${minutesToPixels(order.estimatedDuration || 60)}px`,
  };
  
  const [line1, line2] = order.taskDetails.split('\n');

  const tooltipContent = (
    <>
      <p className="font-bold">{line1}</p>
      {line2 && <p>{line2}</p>}
      <p className="text-xs text-muted-foreground">所要時間: {order.estimatedDuration}分</p>
    </>
  );

  return (
    <Tooltip>
      <TooltipTrigger
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
      >
        <div
          className={cn("h-12 rounded-md px-2 flex flex-col justify-center cursor-move bg-primary text-primary-foreground", className)}
        >
          <p className="text-xs font-semibold truncate pointer-events-none">
            {line1}
          </p>
          {line2 && <p className="text-xs opacity-80 truncate pointer-events-none">
            {line2}
          </p>}
        </div>
      </TooltipTrigger>
       <TooltipContent>
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
};

type DialogState = 
  | { mode: 'closed' }
  | { mode: 'edit'; event: WithId<ScheduleEvent> }
  | { mode: 'new'; staffId: string; start: Date };

type EditedEventDetails = {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
};

interface ScheduleViewProps {
    staffData: WithId<Staff>[];
    rawOrdersData: any[]; 
    currentDate: Date;
    statuses: StaffStatus[];
}

const genericTasks: WithId<Order>[] = [
      { id: 'generic-travel', customerCode: '', taskDetails: '移動', estimatedDuration: 30 },
      { id: 'generic-work', customerCode: '', taskDetails: '業務', estimatedDuration: 60 },
      { id: 'generic-break', customerCode: '', taskDetails: '休憩', estimatedDuration: 60 },
];

export function GenericTasks() {
    const getDraggableClassName = (task: Order) => {
        if (task.id === 'generic-travel') return 'bg-yellow-500 text-black';
        if (task.id === 'generic-work') return 'bg-gray-400 text-white';
        if (task.id === 'generic-break') return 'bg-green-500 text-white';
        return 'bg-primary text-primary-foreground';
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-lg">汎用タスク</CardTitle>
                 <CardDescription>休憩や移動など、受注以外のタスクです。</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex flex-wrap gap-2">
                    {genericTasks.map((task) => (
                        <DraggableOrder
                            key={task.id}
                            order={task}
                            className={getDraggableClassName(task)}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

export function UnassignedTasks({ orders, customers, date }: { orders: WithId<Order>[], customers: WithId<Customer>[], date: Date }) {
    const getCustomerByCode = (code: string | undefined): WithId<Customer> | undefined => customers?.find(c => c.userCode === code);
    const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_TASKS_DROPPABLE_ID });
    
    const titleText = isToday(date) ? '本日の受注タスク' : `${format(date, 'M/d')}の受注タスク`;

    return (
        <Card 
            ref={setNodeRef}
            className={cn("transition-colors h-full", isOver && "bg-primary/10 border-primary/50")}
        >
            <CardHeader>
                <CardTitle className="text-lg">{titleText}</CardTitle>
                <CardDescription>下のタイムラインにタスクをドラッグして割り当てます。</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="pr-4 min-h-[6rem]">
                        <div className="flex flex-wrap gap-2">
                            {orders.map((order) => (
                                <DraggableOrder
                                    key={order.id}
                                    order={order}
                                    customer={getCustomerByCode(order.customerCode)}
                                />
                            ))}
                            {orders.length === 0 && (
                                <div className="flex items-center justify-center h-12 text-center text-muted-foreground">
                                    <p>未割り当てオーダーはありません。</p>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

const TimeIndicator = () => {
    const [now, setNow] = React.useState<Date | null>(null);

    React.useEffect(() => {
        setNow(new Date());
        const timer = setInterval(() => {
            setNow(new Date());
        }, 60000); 
        return () => clearInterval(timer);
    }, []);

    if (!now) return null; 
    
    const isVisible = now.getHours() >= timelineStartHour && now.getHours() < timelineEndHour;
    if (!isVisible) return null;
    
    const minutesFromStart = (now.getHours() - timelineStartHour) * 60 + now.getMinutes();
    const leftPosition = minutesToPixels(minutesFromStart);

    return (
        <div
            className="absolute top-0 h-full w-0.5 bg-red-500 pointer-events-none"
            style={{ left: `${leftPosition}px` }}
        >
            <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500"></div>
        </div>
    );
};

export function ScheduleView({ 
    staffData, 
    rawOrdersData,
    currentDate,
    statuses,
}: ScheduleViewProps) {
  const [isClient, setIsClient] = React.useState(false);
  const { customers: allCustomers } = useCustomer();
  const { toast } = useToast();
  const { scheduleEvents, setScheduleEvents, refetchOrders } = useOrder();

  const [dialogState, setDialogState] = React.useState<DialogState>({ mode: 'closed' });
  const [editedEventDetails, setEditedEventDetails] = React.useState<EditedEventDetails>({ title: '', description: '', startTime: '', endTime: '' });
  
  const dailySchedule = React.useMemo(() => {
      if (!scheduleEvents) return [];
      return scheduleEvents.filter(event => {
          const eventDate = typeof event.start === 'string' ? parseISO(event.start) : event.start;
          return isValid(eventDate) && isEqual(startOfDay(eventDate), startOfDay(currentDate));
      });
  }, [scheduleEvents, currentDate]);

  const getCustomerByCode = (code: string | undefined): WithId<Customer> | undefined => allCustomers?.find(c => c.userCode === code);
  const getStaffById = (id: string | undefined): WithId<Staff> | undefined => staffData?.find(s => s.id === id);

  const [activeItem, setActiveItem] = React.useState<any | null>(null);
  const [currentOverStaffId, setCurrentOverStaffId] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  const handleDragStart = (event: DragStartEvent) => {
    setActiveItem(event.active.data.current);
  };
  
  const handleDragOver = (event: DragOverEvent) => {
      const { over } = event;
      const overId = over?.id;

      if (typeof overId === 'string' && staffData.some(s => s.id === overId)) {
          setCurrentOverStaffId(overId);
      } else {
          setCurrentOverStaffId(null);
      }
  };

  const unassignTask = async (eventToUnassign: WithId<ScheduleEvent>) => {
      if (!eventToUnassign.rawOrderId) return;

      try {
        await updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            eventTitle: `(ID: ${eventToUnassign.rawOrderId})`,
            staffName: "",
            statusValue: "未割当",
            scheduledTime: "",
            timestamp: new Date().toISOString(),
        });
        
        await refetchOrders();
        toast({ title: 'タスクを未割り当てに戻しました' });
      } catch(e: any) {
          console.error("Unassignment failed:", e);
          toast({ variant: 'destructive', title: '更新エラー', description: `シートの更新に失敗しました: ${e.message}` });
          await refetchOrders();
      }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const item = active.data.current;

    setActiveItem(null);
    setCurrentOverStaffId(null);
    
    if (!item || !over) return;
    
    if (over.id === UNASSIGNED_TASKS_DROPPABLE_ID && 'staffId' in item) {
        if (item.rawOrderId) {
          await unassignTask(item);
        } else {
           setScheduleEvents(prev => prev.filter(e => e.id !== item.id));
           toast({ title: '汎用タスクを削除しました' });
        }
        return;
    }
    
    const newStaffId = over.id as string;
    const staffRowElement = document.getElementById(`staff-row-${newStaffId}`);
    
    if (!staffRowElement) return;
    
    const timelineRect = staffRowElement.getBoundingClientRect();
    const startOfTimelineDay = new Date(currentDate);
    startOfTimelineDay.setHours(timelineStartHour, 0, 0, 0);

    const getNewStartFromDrop = () => {
      const dropX = (active.rect.current.translated?.left ?? 0) - timelineRect.left;
      const newStartMinutes = pixelsToMinutes(dropX);
      return addMinutes(startOfTimelineDay, newStartMinutes);
    };

    if ('staffId' in item) { // Moving an existing event
        const draggedEvent = item as WithId<ScheduleEvent>;
        const newStaff = getStaffById(newStaffId);
        if (!newStaff) return;
        
        const newStart = getNewStartFromDrop();
        
        // Optimistically update UI first
        if (draggedEvent.tripId) {
            setScheduleEvents(prev => {
                const eventsToMove = prev.filter(e => e.tripId === draggedEvent.tripId);
                const originalTask = eventsToMove.find(e => e.id.endsWith('-task')) || draggedEvent;
                const originalTravel = eventsToMove.find(e => e.id.endsWith('-travel'));
                const taskDuration = differenceInMinutes(parseISO(originalTask.end as string), parseISO(originalTask.start as string));
                
                let newTaskStart = newStart;
                if (originalTravel && draggedEvent.id === originalTravel.id) {
                    newTaskStart = addMinutes(newStart, TRAVEL_TIME_MINUTES);
                }
                
                const newTaskEnd = addMinutes(newTaskStart, taskDuration);
                const newTravelStart = subMinutes(newTaskStart, TRAVEL_TIME_MINUTES);

                return prev.map(e => {
                    if (e.tripId !== draggedEvent.tripId) return e;
                    if (e.id.endsWith('-task')) {
                        return { ...e, staffId: newStaffId, start: newTaskStart.toISOString(), end: newTaskEnd.toISOString() };
                    }
                    if (e.id.endsWith('-travel')) {
                        return { ...e, staffId: newStaffId, start: newTravelStart.toISOString(), end: newTaskStart.toISOString() };
                    }
                    return e;
                });
            });
        } else {
            const duration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
            const newEnd = addMinutes(newStart, duration);
            setScheduleEvents(prev => prev.map(e => e.id === draggedEvent.id ? { ...e, staffId: newStaffId, start: newStart.toISOString(), end: newEnd.toISOString() } : e));
        }

        try {
            if (draggedEvent.rawOrderId) {
                const originalTask = scheduleEvents.find(e => e.id === draggedEvent.id && e.id.endsWith('-task')) || scheduleEvents.find(e => e.tripId === draggedEvent.tripId && e.id.endsWith('-task')) || draggedEvent;
                let taskStart = newStart;
                if (draggedEvent.id.endsWith('-travel')) {
                   taskStart = addMinutes(newStart, TRAVEL_TIME_MINUTES);
                }

                await updateSheetStatus({
                    gasUrl: ORDER_GAS_URL,
                    eventTitle: `(ID: ${originalTask.rawOrderId})`,
                    scheduledTime: taskStart.toISOString(),
                    staffName: newStaff.name,
                });
                
                await refetchOrders(); // Refetch to confirm and get latest data
                toast({ title: "スケジュールを更新しました" });
            }

        } catch(e: any) {
            toast({ variant: 'destructive', title: '更新エラー', description: `移動に失敗しました: ${e.message}` });
            await refetchOrders(); // Revert UI by refetching
        }

    } else if ('estimatedDuration' in item) { // Adding a new event from orders
        const order = item as WithId<Order>;
        const staff = getStaffById(newStaffId);
        if (!staff) return;

        const taskStart = getNewStartFromDrop();
        const customer = getCustomerByCode(order.customerCode);
        const isGeneric = order.id.startsWith('generic-');
        
        // Optimistically update UI
        if (isGeneric) {
            const newEventEnd = addMinutes(taskStart, order.estimatedDuration);
            const newEvent: WithId<ScheduleEvent> = {
                id: `event-${Date.now()}`,
                title: order.taskDetails,
                description: '',
                staffId: newStaffId,
                locationId: '',
                start: taskStart.toISOString(),
                end: newEventEnd.toISOString(),
            };
            setScheduleEvents(prev => [...prev, newEvent]);
        } else {
             const tripId = `trip-${order.rawOrderId}`;
             const taskEnd = addMinutes(taskStart, order.estimatedDuration);
             const travelStart = subMinutes(taskStart, TRAVEL_TIME_MINUTES);
             const travelEvent: WithId<ScheduleEvent> = {
                  id: `${tripId}-travel`, tripId,
                  title: `移動: ${customer?.storeName || order.taskDetails.split('\n')[0]}`,
                  staffId: newStaffId, locationId: customer?.id || '',
                  start: travelStart.toISOString(), end: taskStart.toISOString(), rawOrderId: order.rawOrderId
              };
              const taskEvent: WithId<ScheduleEvent> = {
                  id: `${tripId}-task`, tripId, orderId: order.id, rawOrderId: order.rawOrderId,
                  title: order.taskDetails,
                  staffId: newStaffId, locationId: customer?.id || '',
                  start: taskStart.toISOString(), end: taskEnd.toISOString(),
              };
             setScheduleEvents(prev => [...prev, travelEvent, taskEvent]);
        }
        
        try {
            if (!isGeneric) {
                 await updateSheetStatus({
                  gasUrl: ORDER_GAS_URL,
                  eventTitle: `(ID: ${order.rawOrderId})`,
                  staffName: staff.name,
                  statusValue: '作業待ち',
                  scheduledTime: taskStart.toISOString(),
                  timestamp: new Date().toISOString(),
              });
              
              toast({ title: `${staff.name}に${customer?.storeName || 'タスク'}の作業を割り当てました` });
              await refetchOrders();
            }
        } catch (e: any) {
             toast({ variant: 'destructive', title: '割当エラー', description: `タスクの割り当てに失敗しました: ${e.message}` });
             await refetchOrders();
        }
    }
  };

  const handleDoubleClickEvent = (event: WithId<ScheduleEvent>) => {
    const staff = getStaffById(event.staffId);
    if (!staff || !staff.email) {
        toast({ variant: 'destructive', title: 'エラー', description: '担当スタッフのメールアドレスが登録されていません。' });
        return;
    }

    const start = parseISO(event.start as string);
    const end = parseISO(event.end as string);

    if (!isValid(start) || !isValid(end)) {
        toast({ variant: 'destructive', title: 'エラー', description: '無効なイベント時間です。' });
        return;
    }
    
    const icsEvent: ics.EventAttributes = {
        start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()],
        end: [end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()],
        title: event.title,
        description: event.description,
    };

    ics.createEvent(icsEvent, (error, value) => {
        if (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'iCal作成エラー', description: error.message });
            return;
        }

        const base64data = btoa(value);
        const mailtoLink = `mailto:${staff.email}?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent('以下のカレンダーファイルをインポートしてください。\n\n')}&attachment=${encodeURIComponent('data:text/calendar;base64,' + base64data + '?name=' + encodeURIComponent(`${event.title.replace(/\s/g, '_')}.ics`))}`;
        
        window.location.href = mailtoLink;
    });
  };
  
  const handleDoubleClickTimeline = (staffId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-event-chip="true"]')) {
      return;
    }

    const timelineRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - timelineRect.left;
    const clickMinutes = pixelsToMinutes(clickX);
    
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(timelineStartHour, 0, 0, 0);
    const newStart = addMinutes(startOfDay, clickMinutes);

    setEditedEventDetails({ title: '', description: '', startTime: formatTime(newStart), endTime: formatTime(addMinutes(newStart, 60)) });
    setDialogState({ mode: 'new', staffId, start: newStart });
  };
  
  const handleSaveEvent = async () => {
    if (dialogState.mode === 'closed') return;
    
    const newStart = timeStringToDate(editedEventDetails.startTime, currentDate);
    const newEnd = timeStringToDate(editedEventDetails.endTime, currentDate);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        toast({ variant: 'destructive', title: 'エラー', description: '無効な時間形式です。' });
        return;
    }
    
    const { title, description } = editedEventDetails;

    try {
        if (dialogState.mode === 'new') {
            const staff = getStaffById(dialogState.staffId);
            if (!staff) throw new Error("担当スタッフが見つかりません。");
            
            const newEvent: WithId<ScheduleEvent> = {
                id: `event-${Date.now()}`,
                title, description,
                staffId: dialogState.staffId,
                locationId: '',
                start: newStart.toISOString(),
                end: newEnd.toISOString(),
            };
            setScheduleEvents(prev => [...prev, newEvent]);

        } else if (dialogState.mode === 'edit') {
            const staff = getStaffById(dialogState.event.staffId);
            if (!staff) throw new Error("担当スタッフが見つかりません。");
            
            if (dialogState.event.rawOrderId) { // Sheet-based event
                await updateSheetStatus({
                    gasUrl: ORDER_GAS_URL,
                    eventTitle: `(ID: ${dialogState.event.rawOrderId})`,
                    scheduledTime: newStart.toISOString(),
                    timestamp: new Date().toISOString(),
                });
                await refetchOrders();

            } else { // Generic event
                const updatedEvent = { ...dialogState.event, title, description, start: newStart.toISOString(), end: newEnd.toISOString() };
                setScheduleEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
            }
        }
        setDialogState({ mode: 'closed' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: '保存エラー', description: `更新に失敗しました: ${e.message}` });
    }
  };

  const handleDeleteEvent = async () => {
    if (dialogState.mode !== 'edit') return;
    const eventToDelete = dialogState.event;
    
    if (eventToDelete.rawOrderId) {
        await unassignTask(eventToDelete);
    } else {
        setScheduleEvents(prev => prev.filter(e => e.id !== eventToDelete.id));
        toast({ title: '予定を削除しました' });
    }

    setDialogState({ mode: 'closed' });
  };

  const getDialogDetails = () => {
    if (dialogState.mode === 'edit') {
      const { event } = dialogState;
      const staff = getStaffById(event.staffId);
      const customer = getCustomerByCode(event.locationId);
      return { event, staff, customer, title: '予定の編集' };
    }
    if (dialogState.mode === 'new') {
      const staff = getStaffById(dialogState.staffId);
      return { staff, start: dialogState.start, title: '新規予定の作成' };
    }
    return { event: undefined, staff: undefined, customer: undefined, start: undefined, title: '' };
  };

  const { event, staff, customer, title } = getDialogDetails();

  if (!isClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>スケジュール</CardTitle>
          <CardDescription>各スタッフのタイムライン形式のスケジュールです。</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex items-center justify-center h-64">
             <p>Loading schedule...</p>
           </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
            <Card>
                <CardHeader>
                    <CardTitle>タイムライン</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 overflow-x-auto">
                    <div className="relative" style={{ minWidth: `${STAFF_COL_WIDTH + timelineTotalHours * 60 * PIXELS_PER_MINUTE + STATUS_COL_WIDTH}px`}}>
                      <div className="sticky top-0 z-20 flex bg-background/95 backdrop-blur-sm">
                          <div className="flex-shrink-0 font-semibold p-2" style={{ width: `${STAFF_COL_WIDTH}px` }}>スタッフ</div>
                          <div className="relative h-8 flex-1">
                              {Array.from({ length: timelineTotalHours + 1 }).map((_, i) => (
                                  <div
                                      key={i}
                                      className="absolute h-full border-l"
                                      style={{ left: `${i * 60 * PIXELS_PER_MINUTE}px` }}
                                  >
                                      <span className="absolute top-1 -translate-x-1/2 text-xs text-muted-foreground">
                                          {timelineStartHour + i}:00
                                      </span>
                                  </div>
                              ))}
                               {isToday(currentDate) && (
                                <div 
                                    className="absolute top-0 h-full pointer-events-none z-40"
                                    style={{ left: `0px`, width: `${timelineTotalHours * 60 * PIXELS_PER_MINUTE}px`}}
                                >
                                    <TimeIndicator />
                                </div>
                               )}
                          </div>
                          <div className="flex-shrink-0 font-semibold p-2" style={{ width: `${STATUS_COL_WIDTH}px`}}>ステータス</div>
                      </div>
                      <div className="relative mt-2 space-y-2">
                          {staffData?.map((staff) => {
                              const events = dailySchedule.filter((e) => e.staffId === staff.id);
                              const status = statuses.find(s => s.staffId === staff.id);
                              return (
                                  <StaffRow
                                      key={staff.id}
                                      staff={staff}
                                      events={events}
                                      status={status}
                                      getCustomerByCode={getCustomerByCode}
                                      isOver={currentOverStaffId === staff.id}
                                      onDoubleClickEvent={handleDoubleClickEvent}
                                      onDoubleClickTimeline={handleDoubleClickTimeline}
                                  />
                              );
                          })}
                      </div>
                    </div>
                </CardContent>
            </Card>
      
      <Dialog open={dialogState.mode !== 'closed'} onOpenChange={() => setDialogState({ mode: 'closed' })}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>{title}</DialogTitle>
                  <DialogDescription>
                      {dialogState.mode === 'edit' ? '予定の詳細を編集または削除します。' : '新しい予定の詳細を入力してください。'}
                  </DialogDescription>
              </DialogHeader>
      
              <div className="grid gap-4 py-4">
                      {dialogState.mode === 'edit' && (
                          <div className="text-sm space-y-1">
                              <p><span className="font-semibold text-muted-foreground">担当:</span> {staff?.name}</p>
                              {customer && <p><span className="font-semibold text-muted-foreground">顧客:</span> {customer?.storeName || 'N/A'}</p>}
                          </div>
                      )}
                       {dialogState.mode === 'new' && (
                          <div className="text-sm">
                              <p><span className="font-semibold text-muted-foreground">担当:</span> {staff?.name}</p>
                          </div>
                      )}
                      <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="title" className="text-right">タスク名</Label>
                          <Input
                              id="title"
                              value={editedEventDetails.title}
                              onChange={(e) => setEditedEventDetails(prev => ({...prev, title: e.target.value}))}
                              className="col-span-3"
                              placeholder="例：定期メンテナンス"
                          />
                      </div>
                       <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="description" className="text-right">詳細</Label>
                          <Textarea
                              id="description"
                              value={editedEventDetails.description}
                              onChange={(e) => setEditedEventDetails(prev => ({...prev, description: e.target.value}))}
                              className="col-span-3"
                              placeholder="予定の詳細やメモ"
                          />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                          <div className="col-span-2 grid gap-2">
                              <Label htmlFor="start-time">開始時間</Label>
                              <Input
                                  id="start-time"
                                  type="time"
                                  value={editedEventDetails.startTime}
                                  onChange={(e) => setEditedEventDetails(prev => ({...prev, startTime: e.target.value}))}
                              />
                          </div>
                          <div className="col-span-2 grid gap-2">
                              <Label htmlFor="end-time">終了時間</Label>
                              <Input
                                  id="end-time"
                                  type="time"
                                  value={editedEventDetails.endTime}
                                  onChange={(e) => setEditedEventDetails(prev => ({...prev, endTime: e.target.value}))}
                              />
                          </div>
                      </div>
                  </div>
      
                  <DialogFooter className="sm:justify-between">
                      <div className="flex gap-2">
                          {dialogState.mode === 'edit' && (
                              <Button variant="destructive" onClick={handleDeleteEvent}>削除</Button>
                          )}
                      </div>
                      <div className="flex gap-2 mt-4 sm:mt-0">
                          <DialogClose asChild>
                              <Button variant="ghost">キャンセル</Button>
                          </DialogClose>
                          <Button onClick={handleSaveEvent}>保存</Button>
                      </div>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
    </DndContext>
  );
}

interface StaffRowProps {
  staff: WithId<Staff>;
  events: WithId<ScheduleEvent>[];
  status?: StaffStatus;
  getCustomerByCode: (code: string | undefined) => WithId<Customer> | undefined;
  isOver: boolean;
  onDoubleClickEvent: (event: WithId<ScheduleEvent>) => void;
  onDoubleClickTimeline: (staffId: string, e: React.MouseEvent) => void;
}

const StaffRow: React.FC<StaffRowProps> = ({ staff, events, status, getCustomerByCode, isOver, onDoubleClickEvent, onDoubleClickTimeline }) => {
  const { setNodeRef } = useDroppable({ id: staff.id });

  const areaColors: Record<string, string> = {
    '横浜店': 'bg-blue-50',
    '東名川崎店': 'bg-green-50',
    '綾瀬店': 'bg-orange-50',
  };
  const areaBgClass = staff['母店'] ? areaColors[staff['母店']] || 'bg-background' : 'bg-background';

  return (
    <div className={cn("flex relative", areaBgClass)}>
      {/* Staff Name Cell */}
      <div className={cn("sticky left-0 z-10 flex-shrink-0 px-2 flex items-center border-r h-16", areaBgClass)} style={{ width: `${STAFF_COL_WIDTH}px` }}>
        <div className="font-semibold flex items-center gap-2 w-full truncate">
            <div className='w-2 h-8 rounded-full' style={{backgroundColor: staff.color}}></div>
            <span className='truncate flex-1'>{staff.name}</span>
        </div>
      </div>
      
      {/* Timeline Cell */}
      <div 
        id={`staff-row-${staff.id}`}
        ref={setNodeRef} 
        className={cn("relative flex-1 h-16 border-b", isOver && "bg-primary/10")} 
        onDoubleClick={(e) => onDoubleClickTimeline(staff.id, e)}
        style={{ width: `${timelineTotalHours * 60 * PIXELS_PER_MINUTE}px`}}
      >
        <div className="absolute top-0 left-0 h-full w-full">
          {events.map((event) => (
            <DraggableEvent
              key={event.id}
              event={event}
              staff={staff}
              getCustomerByCode={getCustomerByCode}
              onDoubleClick={() => onDoubleClickEvent(event)}
            />
          ))}
        </div>
      </div>

      {/* Status Cell */}
      <div className={cn("sticky right-0 z-10 flex-shrink-0 px-2 flex items-center justify-center border-l border-b h-16", areaBgClass)} style={{ width: `${STATUS_COL_WIDTH}px`}}>
        {status && isToday(new Date()) && (
          <div className="text-xs text-center font-medium">
             {statusJapanese[status.status]}
          </div>
        )}
      </div>
    </div>
  )
};

interface DraggableEventProps {
  event: WithId<ScheduleEvent>;
  staff: WithId<Staff>;
  getCustomerByCode: (code: string | undefined) => WithId<Customer> | undefined;
  onDoubleClick: () => void;
}

const DraggableEvent: React.FC<DraggableEventProps> = ({ event, staff, getCustomerByCode, onDoubleClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: event,
  });

  const { left, width } = getEventDimensions(event.start, event.end);

  const style: React.CSSProperties = {
    left: `${left}px`,
    width: `${width}px`,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : 1,
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    onDoubleClick();
  };
  
  const isTravelEvent = event.title?.startsWith('移動');
  
  const divStyle: React.CSSProperties = {
      backgroundColor: staff.color || 'hsl(var(--primary))',
  };

  if (isTravelEvent) {
    style.opacity = 0.5;
  }
  
  const brightStaff = ['小峯', '加藤', '牛島', '門馬'];
  let textColorClass = 'text-primary-foreground';
  if (isTravelEvent) {
    textColorClass = 'text-foreground';
  } else if (staff.name && brightStaff.includes(staff.name)) {
      textColorClass = 'text-black';
  }
  
  if (event.title === '業務') {
    divStyle.backgroundColor = 'rgb(156 163 175)';
  } else if (event.title === '休憩') {
    divStyle.backgroundColor = 'rgb(34 197 94)';
  }

  const [line1, ...rest] = (event.title || '').split('\n');
  const line2 = rest.join('\n');
  const customer = event.locationId ? getCustomerByCode(event.locationId) : undefined;
  const tooltipTitle = event.title?.includes('(ID:') ? line1 : event.title;

  return (
    <Tooltip>
      <TooltipTrigger
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onDoubleClick={handleDoubleClick}
        className="absolute h-12 top-1/2 -translate-y-1/2 rounded-md flex flex-col justify-center cursor-move"
        data-event-chip="true"
      >
        <div
          className={cn("w-full h-full rounded-md flex flex-col justify-center p-1", textColorClass, isDragging && "opacity-80")}
          style={divStyle}
        >
          <p className="text-xs font-semibold truncate pointer-events-none">
            {line1}
          </p>
          {line2 && (
            <p className="text-xs opacity-80 truncate pointer-events-none">
                {line2}
            </p>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-bold">{tooltipTitle || '未定のタスク'}</p>
        {customer && <p className="text-sm">顧客: {customer?.storeName || '未定'}</p>}
        <p className="text-sm">時間: {formatTime(event.start)} - {formatTime(event.end)}</p>
        <p className="text-sm">担当: {staff.name}</p>
        {event.description && <p className="text-xs text-muted-foreground mt-1">{event.description}</p>}
      </TooltipContent>
    </Tooltip>
  );
};
