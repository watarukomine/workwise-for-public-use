
'use client';

import * as React from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ScheduleEvent, Staff, Customer, Order, WithId } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { addMinutes, differenceInMinutes, format, parseISO, subMinutes, isToday, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
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
import { updateSheetStatus } from '@/app/actions/update-sheet-status';
import { useToast } from '@/hooks/use-toast';
import { useOrder } from '@/contexts/order-context';
import { updateCalendarEvent } from '@/app/actions/update-calendar-event';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Textarea } from '../ui/textarea';

const PIXELS_PER_MINUTE = 1.5;
const timelineStartHour = 8;
const timelineEndHour = 18;
const timelineTotalHours = timelineEndHour - timelineStartHour;
const TRAVEL_TIME_MINUTES = 30;
const UNASSIGNED_TASKS_DROPPABLE_ID = 'unassigned-tasks-droppable-area';
const STAFF_STATUS_UPDATE_URL_KEY = 'staffStatusUpdateGasUrl';

// --- Helper Functions ---
const timeStringToDate = (timeStr: string) => {
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
        console.error("Invalid time string format:", timeStr);
        // Return a default or invalid date
        return new Date(NaN);
    }
    const today = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    today.setHours(hours, minutes, 0, 0);
    return today;
};

const formatTime = (date: Date | string) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
   if (!d || isNaN(d.getTime())) {
    return "Invalid date";
  }
  return format(d, 'HH:mm');
};

const minutesToPixels = (minutes: number) => minutes * PIXELS_PER_MINUTE;

const pixelsToMinutes = (pixels: number) => Math.round(pixels / PIXELS_PER_MINUTE / 15) * 15;

const getEventDimensions = (eventStart: Date | string, eventEnd: Date | string) => {
  const start = typeof eventStart === 'string' ? parseISO(eventStart) : eventStart;
  const end = typeof eventEnd === 'string' ? parseISO(eventEnd) : eventEnd;

  if (!start || !end || !isValid(start) || !isValid(end)) {
    return { left: 0, width: minutesToPixels(60) }; // Fallback
  }
  
  const startOfDay = new Date(start);
  startOfDay.setHours(timelineStartHour, 0, 0, 0);

  const leftInMinutes = differenceInMinutes(start, startOfDay);
  const widthInMinutes = differenceInMinutes(end, start);

  return {
    left: minutesToPixels(leftInMinutes),
    width: minutesToPixels(widthInMinutes > 0 ? widthInMinutes : 30), // Ensure minimum width
  };
};

// --- Draggable Task Components ---

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
    width: `${(order.estimatedDuration || 60) * PIXELS_PER_MINUTE}px`,
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
          <p className="text-xs opacity-80 truncate pointer-events-none">
            {line2}
          </p>
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
    customerData: WithId<Customer>[]; // This is static, from lib/data, might be empty
    scheduleData: WithId<ScheduleEvent>[];
    ordersData: WithId<Order>[]; // These are the dynamic, unassigned orders
    setScheduleData: React.Dispatch<React.SetStateAction<WithId<ScheduleEvent>[]>>;
    setOrdersData: React.Dispatch<React.SetStateAction<WithId<Order>[]>>;
}

const getDraggableClassName = (task: Order) => {
    if (task.id === 'generic-travel') return 'bg-yellow-500 text-black';
    if (task.id === 'generic-work') return 'bg-gray-400 text-white';
    if (task.id === 'generic-break') return 'bg-green-500 text-white';
    return 'bg-primary text-primary-foreground';
};

const genericTasks: WithId<Order>[] = [
      { id: 'generic-travel', customerCode: '', taskDetails: '移動', estimatedDuration: 30 },
      { id: 'generic-work', customerCode: '', taskDetails: '業務', estimatedDuration: 60 },
      { id: 'generic-break', customerCode: '', taskDetails: '休憩', estimatedDuration: 60 },
];

function UnassignedTasks({ orders, customers }: { orders: WithId<Order>[], customers: WithId<Customer>[] }) {
    const getCustomerByCode = (code: string | undefined): WithId<Customer> | undefined => customers?.find(c => c.userCode === code);
    const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_TASKS_DROPPABLE_ID });

    return (
        <Card 
            ref={setNodeRef}
            className={cn("transition-colors", isOver && "bg-primary/10 border-primary/50")}
        >
            <CardHeader>
                <CardTitle className="text-lg">ドラッグ可能なタスク</CardTitle>
                <CardDescription>下のタイムラインにタスクをドラッグして割り当てます。タイムラインからここに戻すと未割り当てになります。</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="pr-4 min-h-[6rem]">
                        <div className="flex flex-wrap gap-2">
                            {genericTasks.map((task) => (
                                <DraggableOrder
                                    key={task.id}
                                    order={task}
                                    className={getDraggableClassName(task)}
                                />
                            ))}
                            {orders.map((order) => (
                                <DraggableOrder
                                    key={order.id}
                                    order={order}
                                    customer={getCustomerByCode(order.customerCode)}
                                />
                            ))}
                            {orders.length === 0 && (
                                <div className="flex items-center justify-center h-12 text-center text-muted-foreground">
                                    <p>未割り当てのオーダーはありません。</p>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}


// --- Main Component ---
export function ScheduleView({ 
    staffData, 
    customerData,
    scheduleData, 
    ordersData, // These are the unassigned orders from page.tsx
    setScheduleData,
    setOrdersData
}: ScheduleViewProps) {
  const [isClient, setIsClient] = React.useState(false);
  
  const [dialogState, setDialogState] = React.useState<DialogState>({ mode: 'closed' });
  
  const [editedEventDetails, setEditedEventDetails] = React.useState<EditedEventDetails>({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
  });

  const { customers: allCustomers } = useCustomer();
  const { allStaff } = useSelectedStaff();
  const { toast } = useToast();

  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  const getCustomerByCode = (code: string | undefined): WithId<Customer> | undefined => allCustomers?.find(c => c.userCode === code);
  const getCustomerById = (id: string | undefined): WithId<Customer> | undefined => allCustomers?.find(c => c.id === id);
  const getStaffById = (id: string | undefined): WithId<Staff> | undefined => staffData?.find(s => s.id === id);


  const unassignedOrders = React.useMemo(() => {
    const scheduledOrderIds = new Set(scheduleData.map(e => e.orderId).filter(Boolean));
    return ordersData.filter(order => !scheduledOrderIds.has(order.id));
  }, [ordersData, scheduleData]);


  const [activeItem, setActiveItem] = React.useState<WithId<ScheduleEvent> | WithId<Order> | null>(null);
  const [currentOverStaffId, setCurrentOverStaffId] = React.useState<UniqueIdentifier | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current as WithId<ScheduleEvent> | WithId<Order>;
    setActiveItem(item);
  };

  const handleDragOver = (event: DragOverEvent) => {
     const { over } = event;
     setCurrentOverStaffId(over ? over.id : null);
  };

  const handleUnassignEvent = async (eventToUnassign: WithId<ScheduleEvent>) => {
    const staff = getStaffById(eventToUnassign.staffId);
    if (!staff) return;

    const eventsToDelete = eventToUnassign.tripId 
        ? scheduleData.filter(e => e.tripId === eventToUnassign.tripId)
        : [eventToUnassign];
    
    // --- Google Calendar Deletion ---
    for (const eventToDelete of eventsToDelete) {
        if (staff.calendarId && eventToDelete.calendarEventId) {
            try {
                const result = await updateCalendarEvent({
                    operation: 'delete',
                    calendarId: staff.calendarId,
                    eventId: eventToDelete.calendarEventId,
                });
                if (result.status === 'error') throw new Error(result.message);
                toast({ title: "カレンダーから予定を削除しました" });
            } catch (e: any) {
                toast({ variant: 'destructive', title: 'カレンダー削除エラー', description: e.message });
            }
        }
    }
    
    const originalOrder = ordersData.find(o => o.id === eventToUnassign.orderId);
    
    // --- Restore Order to Unassigned List ---
    if (originalOrder) {
        setOrdersData(currentOrders => {
            if (currentOrders.some(o => o.id === originalOrder.id)) {
                return currentOrders; // Already exists, do nothing
            }
            return [...currentOrders, originalOrder];
        });

        // --- Update Google Sheet ---
        const orderIdToUpdate = originalOrder.raw?.['受注ID'] || originalOrder.id;
        const staffStatusUpdateGasUrl = localStorage.getItem(STAFF_STATUS_UPDATE_URL_KEY) || '';

        if (orderIdToUpdate && staffStatusUpdateGasUrl) {
            try {
                const result = await updateSheetStatus({
                    orderId: orderIdToUpdate,
                    staffName: "", // Clear staff name
                    gasUrl: staffStatusUpdateGasUrl,
                });
                if (result.status === 'success') {
                    toast({ title: 'スプレッドシート更新', description: `オーダー #${orderIdToUpdate} を未割当に戻しました。` });
                } else {
                    throw new Error(result.message || '不明なエラー');
                }
            } catch (e: any) {
                toast({ variant: 'destructive', title: 'スプレッドシート更新エラー', description: `オーダーの割り当て解除に失敗しました: ${e.message}` });
            }
        } else if (!staffStatusUpdateGasUrl) {
             toast({ variant: 'destructive', title: 'URL未設定', description: '担当者更新用のGAS URLが設定されていません。「受注管理」ページで設定してください。' });
        }
    }

    // --- Update Local Schedule State ---
    setScheduleData(prev => prev.filter(e => !eventsToDelete.some(del => del.id === e.id)));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta, over } = event;
    const item = active.data.current as WithId<ScheduleEvent> | WithId<Order>;
    
    if (!item) return;

    // --- Logic for Unassigning (Dragging back to task list) ---
    if (over?.id === UNASSIGNED_TASKS_DROPPABLE_ID && 'staffId' in item) {
        handleUnassignEvent(item);
        setActiveItem(null);
        setCurrentOverStaffId(null);
        return;
    }
    
    const newStaffId = over?.id as string | undefined;

    // --- Logic for moving existing events ---
    if ('staffId' in item && 'start' in item && newStaffId && newStaffId !== UNASSIGNED_TASKS_DROPPABLE_ID) {
      const eventToUpdate = item;
      const dragMinutes = pixelsToMinutes(delta.x);
      
      const originalStart = typeof eventToUpdate.start === 'string' ? parseISO(eventToUpdate.start) : eventToUpdate.start;
      const originalEnd = typeof eventToUpdate.end === 'string' ? parseISO(eventToUpdate.end) : eventToUpdate.end;

      const newStart = addMinutes(originalStart, dragMinutes);
      const newEnd = addMinutes(originalEnd, dragMinutes);
      
      const finalStaffId = newStaffId || eventToUpdate.staffId;

      const updatedEvent = {
        ...eventToUpdate,
        staffId: finalStaffId,
        start: newStart,
        end: newEnd,
      };

      setScheduleData(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
      
      // Update Google Calendar
      const staffMember = allStaff.find(s => s.id === finalStaffId);
      if (staffMember?.calendarId && updatedEvent.calendarEventId) {
        try {
          const result = await updateCalendarEvent({
            operation: 'update',
            calendarId: staffMember.calendarId,
            eventId: updatedEvent.calendarEventId,
            title: updatedEvent.title,
            description: updatedEvent.description,
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
          });
          if (result.status === 'error') throw new Error(result.message);
          toast({ title: "カレンダー更新成功" });
        } catch (e: any) {
          toast({ variant: 'destructive', title: 'カレンダー更新エラー', description: e.message });
        }
      }

    }
    // --- Logic for adding new orders as events ---
    else if ('estimatedDuration' in item && newStaffId && over?.rect) {
        const order = item;
        const timelineRect = over.rect;
        
        const dropX = (active.rect.current.initial?.left ?? 0) - timelineRect.left + delta.x;
        const dropMinutes = pixelsToMinutes(dropX);

        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(timelineStartHour, 0, 0, 0);
        
        const isGeneric = order.id.startsWith('generic-');
        const staff = getStaffById(newStaffId);
        if (!staff) return;

        const handleCalendarCreate = async (event: Omit<WithId<ScheduleEvent>, 'calendarEventId'>): Promise<string | undefined> => {
            if (!staff.calendarId) return;
            try {
                const result = await updateCalendarEvent({
                    operation: 'create',
                    calendarId: staff.calendarId,
                    title: event.title,
                    description: event.description,
                    startTime: (event.start as Date).toISOString(),
                    endTime: (event.end as Date).toISOString(),
                });
                if (result.status === 'success' && result.eventId) {
                    toast({ title: 'カレンダー登録成功', description: 'Googleカレンダーに予定を登録しました。' });
                    return result.eventId;
                }
                throw new Error(result.message || 'カレンダーに登録できませんでした。');
            } catch (e: any) {
                toast({ variant: 'destructive', title: 'カレンダー登録エラー', description: e.message });
                return undefined;
            }
        };
        
        if (isGeneric) {
             const newStart = addMinutes(startOfDay, dropMinutes);
             const newEnd = addMinutes(newStart, order.estimatedDuration);
             const newEventData: Omit<WithId<ScheduleEvent>, 'calendarEventId'> = {
                id: `event-${Date.now()}`,
                title: order.taskDetails,
                description: '',
                staffId: newStaffId,
                locationId: '',
                start: newStart,
                end: newEnd,
             };
             const calendarEventId = await handleCalendarCreate(newEventData);
             const newEvent: WithId<ScheduleEvent> = { ...newEventData, calendarEventId };

             setScheduleData(prev => [...prev, newEvent]);
        } else {
            // This is a customer order, so add travel time and update sheet
            const taskStart = addMinutes(startOfDay, dropMinutes);
            const taskEnd = addMinutes(taskStart, order.estimatedDuration);
            const travelStart = subMinutes(taskStart, TRAVEL_TIME_MINUTES);
            const customer = getCustomerByCode(order.customerCode);
            const tripId = `trip-${Date.now()}`;
            const travelEventId = `event-${Date.now()}-travel`;
            const taskEventId = `event-${Date.now()}-task`;
            
            const travelEventData: Omit<WithId<ScheduleEvent>, 'calendarEventId'> = {
                id: travelEventId,
                tripId: tripId,
                title: `移動: ${customer?.storeName || order.customerCode}`,
                description: `目的地: ${customer?.address || 'N/A'}`,
                staffId: newStaffId,
                locationId: customer?.id || '',
                start: travelStart,
                end: taskStart,
            };

            const taskEventData: Omit<WithId<ScheduleEvent>, 'calendarEventId'> = {
                id: taskEventId,
                tripId: tripId,
                orderId: order.id,
                title: order.taskDetails,
                description: `顧客: ${customer?.storeName || 'N/A'}\n住所: ${customer?.address || 'N/A'}`,
                staffId: newStaffId,
                locationId: customer?.id || '',
                start: taskStart,
                end: taskEnd,
            };

            const travelCalendarId = await handleCalendarCreate(travelEventData);
            const taskCalendarId = await handleCalendarCreate(taskEventData);

            const travelEvent: WithId<ScheduleEvent> = { ...travelEventData, calendarEventId: travelCalendarId };
            const taskEvent: WithId<ScheduleEvent> = { ...taskEventData, calendarEventId: taskCalendarId };

            setOrdersData(prev => prev.filter(o => o.id !== order.id));
            setScheduleData(prev => [...prev, travelEvent, taskEvent]);
            
            // --- Update Google Sheet ---
            const orderIdToUpdate = order.raw?.['受注ID'] || order.id;
            const staffStatusUpdateGasUrl = localStorage.getItem(STAFF_STATUS_UPDATE_URL_KEY) || '';

            if (staff && orderIdToUpdate && staffStatusUpdateGasUrl) {
                 try {
                    const result = await updateSheetStatus({
                        orderId: orderIdToUpdate,
                        staffName: staff.name,
                        gasUrl: staffStatusUpdateGasUrl,
                    });
                    if (result.status === 'success') {
                        toast({
                            title: 'スプレッドシート更新成功',
                            description: `オーダー #${orderIdToUpdate} を ${staff.name} さんに割り当てました。`,
                        });
                    } else {
                        throw new Error(result.message || '不明なエラー');
                    }
                } catch (e: any) {
                    toast({
                        variant: 'destructive',
                        title: 'スプレッドシート更新エラー',
                        description: `オーダーの割り当てに失敗しました: ${e.message}`,
                    });
                }
            } else if (!staffStatusUpdateGasUrl) {
                toast({ variant: 'destructive', title: 'URL未設定', description: '担当者更新用のGAS URLが設定されていません。「受注管理」ページで設定してください。' });
            }
        }
    }

    setActiveItem(null);
    setCurrentOverStaffId(null);
  };

  const handleDoubleClickEvent = (event: WithId<ScheduleEvent>) => {
    setEditedEventDetails({
        title: event.title || '',
        description: event.description || '',
        startTime: formatTime(event.start),
        endTime: formatTime(event.end),
    });
    setDialogState({ mode: 'edit', event });
  };
  
  const handleDoubleClickTimeline = (staffId: string, e: React.MouseEvent) => {
    const timelineRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - timelineRect.left;
    const clickMinutes = pixelsToMinutes(clickX);
    
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(timelineStartHour, 0, 0, 0);
    const newStart = addMinutes(startOfDay, clickMinutes);

    setEditedEventDetails({ title: '', description: '', startTime: formatTime(newStart), endTime: formatTime(addMinutes(newStart, 60)) });
    setDialogState({ mode: 'new', staffId, start: newStart });
  };
  
  const handleSaveEvent = async () => {
    if (dialogState.mode === 'closed') return;
    
    const newStart = timeStringToDate(editedEventDetails.startTime);
    const newEnd = timeStringToDate(editedEventDetails.endTime);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        console.error("Invalid time entered");
        return;
    }
    
    const { title, description } = editedEventDetails;

    if (dialogState.mode === 'new') {
        const staff = getStaffById(dialogState.staffId);
        if (!staff) return;

        let calendarEventId: string | undefined;
        if (staff.calendarId) {
            try {
                const result = await updateCalendarEvent({
                    operation: 'create',
                    calendarId: staff.calendarId,
                    title,
                    description,
                    startTime: newStart.toISOString(),
                    endTime: newEnd.toISOString(),
                });
                if (result.status === 'success' && result.eventId) {
                    calendarEventId = result.eventId;
                    toast({ title: 'カレンダー登録成功' });
                } else {
                    throw new Error(result.message);
                }
            } catch (e: any) {
                toast({ variant: 'destructive', title: 'カレンダー登録エラー', description: e.message });
            }
        }

        const newEvent: WithId<ScheduleEvent> = {
            id: `event-${Date.now()}`,
            title,
            description,
            staffId: dialogState.staffId,
            locationId: '',
            start: newStart,
            end: newEnd,
            calendarEventId,
        };
        setScheduleData(prev => [...prev, newEvent]);

    } else if (dialogState.mode === 'edit') {
        const staff = getStaffById(dialogState.event.staffId);
        if (!staff) return;

        const updatedEvent = {
            ...dialogState.event,
            title,
            description,
            start: newStart,
            end: newEnd,
        };

        if (staff.calendarId && updatedEvent.calendarEventId) {
             try {
                const result = await updateCalendarEvent({
                    operation: 'update',
                    calendarId: staff.calendarId,
                    eventId: updatedEvent.calendarEventId,
                    title,
                    description,
                    startTime: newStart.toISOString(),
                    endTime: newEnd.toISOString(),
                });
                if (result.status === 'error') throw new Error(result.message);
                toast({ title: "カレンダー更新成功" });
            } catch (e: any) {
                toast({ variant: 'destructive', title: 'カレンダー更新エラー', description: e.message });
            }
        }

        setScheduleData(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    }
    setDialogState({ mode: 'closed' });
  };


  const handleDeleteEvent = async () => {
    if (dialogState.mode !== 'edit') return;
    handleUnassignEvent(dialogState.event);
    setDialogState({ mode: 'closed' });
  };

  const getDialogDetails = () => {
    if (dialogState.mode === 'edit') {
      const { event } = dialogState;
      const staff = getStaffById(event.staffId);
      const customer = getCustomerById(event.locationId);
      return { event, staff, customer, title: '予定の編集' };
    }
    if (dialogState.mode === 'new') {
      const staff = getStaffById(dialogState.staffId);
      return { staff, start: dialogState.start, title: '新規予定の作成' };
    }
    return { event: undefined, staff: undefined, customer: undefined, start: undefined, title: '' };
  };

  const { event, staff, customer, title } = getDialogDetails();

  const dailySchedule = React.useMemo(() => {
      if (!scheduleData) return [];
      return scheduleData.filter(event => {
          const eventDate = typeof event.start === 'string' ? parseISO(event.start) : event.start;
          return isValid(eventDate) && isToday(eventDate);
      });
  }, [scheduleData]);

  if (!isClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>本日のスケジュール</CardTitle>
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
      <TooltipProvider>
        <div className="space-y-4">
            <UnassignedTasks orders={unassignedOrders} customers={allCustomers} />
            <Card>
                <CardHeader>
                    <CardTitle>タイムライン</CardTitle>
                    <CardDescription>空白部分をダブルクリックして新規作成もできます。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 select-none overflow-x-auto pr-6">
                    <div className="sticky top-0 z-10 bg-card py-2" style={{ gridTemplateColumns: '8rem 1fr', display: 'grid' }}>
                        <div />
                        <div className="relative grid border-l border-border text-xs text-muted-foreground" style={{ gridTemplateColumns: `repeat(${timelineTotalHours}, ${minutesToPixels(60)}px)` }}>
                        {Array.from({ length: timelineTotalHours }, (_, i) => timelineStartHour + i).map((hour) => (
                            <div key={hour} className="text-center border-r border-border py-1">
                            {hour}:00
                            </div>
                        ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        {staffData?.map((staff) => (
                            <StaffRow
                            key={staff.id}
                            staff={staff}
                            events={dailySchedule.filter(e => e.staffId === staff.id)}
                            getCustomer={getCustomerById}
                            isOver={currentOverStaffId === staff.id}
                            onDoubleClickEvent={handleDoubleClickEvent}
                            onDoubleClickTimeline={handleDoubleClickTimeline}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
      </TooltipProvider>
      <Dialog open={dialogState.mode !== 'closed'} onOpenChange={(open) => !open && setDialogState({ mode: 'closed' })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                    {dialogState.mode === 'edit' ? '予定の詳細を編集または削除します。' : '新しい予定の詳細を入力してください。'}
                </DialogDescription>
            </DialogHeader>
    
            <div className="space-y-4 py-4">
                {dialogState.mode === 'edit' && (
                    <div className="text-sm space-y-1">
                        <p><span className="font-semibold">担当:</span> {staff?.name}</p>
                        <p><span className="font-semibold">顧客:</span> {customer?.storeName || 'N/A'}</p>
                    </div>
                )}
                 {dialogState.mode === 'new' && (
                    <div className="text-sm space-y-1">
                        <p><span className="font-semibold">担当:</span> {staff?.name}</p>
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="event-title">タスク名</Label>
                    <Input
                        id="event-title"
                        value={editedEventDetails.title}
                        onChange={(e) => setEditedEventDetails(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="例：定期メンテナンス"
                        disabled={!!(dialogState.mode === 'edit' && event?.orderId)}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="event-description">詳細</Label>
                    <Textarea
                        id="event-description"
                        value={editedEventDetails.description}
                        onChange={(e) => setEditedEventDetails(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="予定の詳細やメモ"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="start-time">開始時間</Label>
                        <Input
                            id="start-time"
                            type="time"
                            value={editedEventDetails.startTime}
                            onChange={(e) => setEditedEventDetails(prev => ({ ...prev, startTime: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="end-time">終了時間</Label>
                        <Input
                            id="end-time"
                            type="time"
                            value={editedEventDetails.endTime}
                            onChange={(e) => setEditedEventDetails(prev => ({ ...prev, endTime: e.target.value }))}
                        />
                    </div>
                </div>
            </div>

            <DialogFooter className="justify-between">
                <div>
                  {dialogState.mode === 'edit' && (
                      <Button variant="destructive" onClick={handleDeleteEvent}>削除</Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <DialogClose asChild>
                      <Button variant="outline">キャンセル</Button>
                  </DialogClose>
                  <Button onClick={handleSaveEvent} disabled={!editedEventDetails.title && !(dialogState.mode === 'edit' && dialogState.event.orderId)}>保存</Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}


// --- Sub-components ---

interface StaffRowProps {
  staff: WithId<Staff>;
  events: WithId<ScheduleEvent>[];
  getCustomer: (id: string | undefined) => WithId<Customer> | undefined;
  isOver: boolean;
  onDoubleClickEvent: (event: WithId<ScheduleEvent>) => void;
  onDoubleClickTimeline: (staffId: string, e: React.MouseEvent) => void;
}

const StaffRow: React.FC<StaffRowProps> = ({ staff, events, getCustomer, isOver, onDoubleClickEvent, onDoubleClickTimeline }) => {
  const { setNodeRef } = useDroppable({ id: staff.id });

  return (
     <div className="grid items-center transition-colors duration-200 rounded-md" style={{ gridTemplateColumns: '8rem 1fr' }}>
      <div className="flex items-center gap-2 pr-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={staff.avatarUrl} alt={staff.name} />
          <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium truncate">{staff.name}</span>
      </div>
      <div 
        ref={setNodeRef} 
        onDoubleClick={(e) => onDoubleClickTimeline(staff.id, e)}
        className="relative h-14 rounded-md border-l border-border"
        style={{ backgroundColor: isOver ? 'hsl(var(--accent))' : 'hsl(var(--muted) / 0.5)' }}
      >
        <div className="absolute inset-y-0 left-0 grid" style={{gridTemplateColumns: `repeat(${timelineTotalHours * 2}, ${minutesToPixels(30)}px)`}}>
          {Array.from({ length: timelineTotalHours * 2 }).map((_, i) => (
            <div key={i} className={`h-full ${i % 2 === 0 ? 'border-r border-border/80' : 'border-r border-dashed border-border/40'}`}></div>
          ))}
        </div>
        <div className="absolute inset-0 h-full p-1">
          {events.map((event) => (
            <DraggableEvent 
              key={event.id} 
              event={event} 
              staff={staff} 
              getCustomer={getCustomer}
              onDoubleClick={() => onDoubleClickEvent(event)}
            />
          ))}
        </div>
      </div>
    </div>
  )
};

interface DraggableEventProps {
  event: WithId<ScheduleEvent>;
  staff: WithId<Staff>;
  getCustomer: (id: string | undefined) => WithId<Customer> | undefined;
  onDoubleClick: () => void;
}

const DraggableEvent: React.FC<DraggableEventProps> = ({ event, staff, getCustomer, onDoubleClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: event,
  });

  const customer = getCustomer(event.locationId);
  const { left, width } = getEventDimensions(event.start, event.end);

  const style = {
    left: `${left}px`,
    width: `${width}px`,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent timeline's dblclick from firing
    onDoubleClick();
  };

  const isTravelEvent = event.title?.startsWith('移動');
  const isBreakEvent = event.title === '休憩';

  let backgroundColor = staff.color || 'hsl(var(--primary))';
  let color = 'white';

  const hslMatch = backgroundColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);

  if (isTravelEvent) {
    if (hslMatch) {
      const [_, h, s] = hslMatch;
      backgroundColor = `hsl(${h}, ${Number(s) * 0.5}%, 50%)`;
      color = 'white';
    } else {
      backgroundColor = 'hsl(210, 14%, 88%)'; // Muted color fallback
      color = 'hsl(var(--foreground))';
    }
  } else if (isBreakEvent) {
     if (hslMatch) {
      const [_, h, s] = hslMatch;
      backgroundColor = `hsl(${h}, ${s}%, 90%)`;
      color = 'hsl(var(--foreground))';
    } else {
      backgroundColor = `hsl(120, 40%, 85%)`;
      color = 'hsl(var(--foreground))';
    }
  }
  
  const [line1, line2] = (event.title || '').split('\n');


  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onDoubleClick={handleDoubleClick}
          className="absolute h-12 rounded-md px-2 flex flex-col justify-center cursor-move"
          style={{
            ...style,
            backgroundColor,
            color,
          }}
        >
          <p className="text-xs font-semibold truncate pointer-events-none">
            {line1}
          </p>
          <p className="text-xs opacity-80 truncate pointer-events-none">
            {line2}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-bold">{event.title?.replace('\n', ' - ') || '未定のタスク'}</p>
        <p>顧客: {customer?.storeName || '未定'}</p>
        <p>時間: {formatTime(event.start)} - {formatTime(event.end)}</p>
        <p>担当: {staff.name}</p>
        {event.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{event.description}</p>}
      </TooltipContent>
    </Tooltip>
  );
};
