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
import type { ScheduleEvent, Staff, Customer, Order, WithId } from '@/lib/types';
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
  TooltipProvider,
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
import { updateSheetStatus, handleCalendarEvent, sendEmailWithIcs } from '@/app/actions/gas-actions';
import { ORDER_GAS_URL } from '@/lib/settings';
import { Mail, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PIXELS_PER_MINUTE = 1.5;
const timelineStartHour = 9;
const timelineEndHour = 19;
const timelineTotalHours = timelineEndHour - timelineStartHour;
const TRAVEL_TIME_MINUTES = 30;
const UNASSIGNED_TASKS_DROPPABLE_ID = 'unassigned-tasks-droppable-area';
const STAFF_COL_WIDTH = 144;


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
    customerData: WithId<Customer>[];
    rawOrdersData: any[]; 
    currentDate: Date;
}

const genericTasks: WithId<Order>[] = [
      { id: 'generic-travel', customerCode: '', taskDetails: '移動', estimatedDuration: 30 },
      { id: 'generic-work', customerCode: '', taskDetails: '業務', estimatedDuration: 60 },
      { id: 'generic-break', customerCode: '', taskDetails: '休憩', estimatedDuration: 60 },
];

function GenericTasks() {
    const getDraggableClassName = (task: Order) => {
        if (task.id === 'generic-travel') return 'bg-yellow-500 text-black';
        if (task.id === 'generic-work') return 'bg-gray-400 text-white';
        if (task.id === 'generic-break') return 'bg-green-500 text-white';
        return 'bg-primary text-primary-foreground';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">汎用タスク</CardTitle>
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

function UnassignedTasks({ orders, customers, date }: { orders: WithId<Order>[], customers: WithId<Customer>[], date: Date }) {
    const getCustomerByCode = (code: string | undefined): WithId<Customer> | undefined => customers?.find(c => c.userCode === code);
    const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_TASKS_DROPPABLE_ID });
    
    const titleText = isToday(date) ? '本日の受注タスク' : `${format(date, 'M/d')}の受注タスク`;

    return (
        <Card 
            ref={setNodeRef}
            className={cn("transition-colors", isOver && "bg-primary/10 border-primary/50")}
        >
            <CardHeader>
                <CardTitle className="text-lg">{titleText}</CardTitle>
                <CardDescription>下のタイムラインにタスクをドラッグして割り当てます。タイムラインからここに戻すと未割り当てになります。</CardDescription>
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
    customerData,
    rawOrdersData,
    currentDate,
}: ScheduleViewProps) {
  const [isClient, setIsClient] = React.useState(false);
  const { customers: allCustomers } = useCustomer();
  const { toast } = useToast();
  const { scheduleEvents, setScheduleEvents, refetchOrders } = useOrder();

  const [dialogState, setDialogState] = React.useState<DialogState>({ mode: 'closed' });
  const [editedEventDetails, setEditedEventDetails] = React.useState<EditedEventDetails>({ title: '', description: '', startTime: '', endTime: '' });
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);

  const [unassignedOrders, setUnassignedOrders] = React.useState<WithId<Order>[]>([]);
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  React.useEffect(() => {
    if (!rawOrdersData) return;
    
    const dailySchedule = scheduleEvents.filter(event => {
        const eventDate = typeof event.start === 'string' ? parseISO(event.start) : event.start;
        return isValid(eventDate) && isEqual(startOfDay(eventDate), startOfDay(currentDate));
    });
    const scheduledRawOrderIds = new Set(dailySchedule.map(e => e.rawOrderId).filter(Boolean));

    const newUnassignedOrders = rawOrdersData.filter(order => {
        const workDate = findKey(order, ['作業予定日']);
        if (!workDate) return false;
        const scheduledDate = parseISO(workDate);
        if (!isValid(scheduledDate) || !isEqual(startOfDay(scheduledDate), startOfDay(currentDate))) {
            return false;
        }
        const orderId = findKey(order, ['受注 ID', '受注id', '受注ID', 'id']);
        return !scheduledRawOrderIds.has(String(orderId));
    }).map(mapRawToOrder);

    setUnassignedOrders(newUnassignedOrders);
  }, [rawOrdersData, scheduleEvents, currentDate]);

  const getCustomerByCode = (code: string | undefined): WithId<Customer> | undefined => allCustomers?.find(c => c.userCode === code);
  const getStaffById = (id: string | undefined): WithId<Staff> | undefined => staffData?.find(s => s.id === id);

  const [activeItem, setActiveItem] = React.useState<any | null>(null);
  const [currentOverStaffId, setCurrentOverStaffId] = React.useState<string | null>(null);
  
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

  const unassignTask = (eventToUnassign: WithId<ScheduleEvent>) => {
      if (!eventToUnassign.rawOrderId) return;
      const staff = getStaffById(eventToUnassign.staffId);
      if (!staff || !staff.calendarId) {
          toast({ variant: 'destructive', title: 'エラー', description: '担当スタッフにカレンダーIDが設定されていません。' });
          return;
      }
      
      const originalEvents = [...scheduleEvents];
      const originalUnassigned = [...unassignedOrders];

      const originalOrderRaw = rawOrdersData.find(o => String(findKey(o, ['受注 ID','受注id', '受注ID', 'id'])) === eventToUnassign.rawOrderId);
      if (originalOrderRaw) {
        const orderToAddBack = mapRawToOrder(originalOrderRaw);
         setUnassignedOrders(prev => {
          if (!prev.some(o => o.id === orderToAddBack.id)) {
            return [...prev, orderToAddBack];
          }
          return prev;
        });
      }
      setScheduleEvents(prev => prev.filter(e => e.tripId !== eventToUnassign.tripId));
      toast({ title: 'タスクを未割り当てに戻しました' });

      (async () => {
        try {
          await updateSheetStatus({
              gasUrl: ORDER_GAS_URL,
              eventTitle: `(ID: ${eventToUnassign.rawOrderId})`,
              staffName: "",
              statusValue: "未割当",
              scheduledTime: "",
              timestamp: new Date().toISOString(),
          });
          
          const eventsToDelete = originalEvents.filter(e => e.tripId === eventToUnassign.tripId);
          for (const event of eventsToDelete) {
              if (event.calendarEventId) {
                  await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'delete', calendarId: staff.calendarId, eventId: event.calendarEventId });
              }
          }
        } catch(e: any) {
            console.error("Unassignment failed:", e);
            toast({ variant: 'destructive', title: '更新エラー', description: `シートまたはカレンダーの更新に失敗しました: ${e.message}` });
            setScheduleEvents(originalEvents);
            setUnassignedOrders(originalUnassigned);
        }
      })();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const item = active.data.current;

    setActiveItem(null);
    setCurrentOverStaffId(null);
    
    if (!item || !over) return;
    
    if (over.id === UNASSIGNED_TASKS_DROPPABLE_ID && 'staffId' in item) {
        if (item.rawOrderId) {
          unassignTask(item);
        } else {
           const staff = getStaffById(item.staffId);
           if(item.calendarEventId && staff?.calendarId) {
              handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'delete', calendarId: staff.calendarId, eventId: item.calendarEventId });
           }
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
        const oldStaff = getStaffById(draggedEvent.staffId);
        if (!newStaff || !oldStaff) return;
        
        const originalEvents = [...scheduleEvents];
        const newStart = getNewStartFromDrop();
        const isStaffChange = draggedEvent.staffId !== newStaffId;
        const customer = getCustomerByCode(draggedEvent.locationId);

        let optimisticEvents = originalEvents;

        // Optimistic UI update
        if (draggedEvent.tripId) {
            const taskDuration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
            const newEnd = addMinutes(newStart, taskDuration);
            optimisticEvents = originalEvents.map(e => {
                if (e.id === draggedEvent.id) {
                    return { ...e, staffId: newStaffId, start: newStart.toISOString(), end: newEnd.toISOString() };
                }
                if (e.tripId === draggedEvent.tripId && e.id !== draggedEvent.id) {
                    const isTask = e.id.endsWith('-task');
                    const isTravel = e.id.endsWith('-travel');
                    let updatedEvent = { ...e, staffId: newStaffId };
                    
                    if(draggedEvent.id.endsWith('-task') && isTravel) {
                       updatedEvent.start = subMinutes(newStart, TRAVEL_TIME_MINUTES).toISOString();
                       updatedEvent.end = newStart.toISOString();
                    } else if (draggedEvent.id.endsWith('-travel') && isTask) {
                       updatedEvent.start = addMinutes(newStart, TRAVEL_TIME_MINUTES).toISOString();
                       updatedEvent.end = addMinutes(newStart, TRAVEL_TIME_MINUTES + taskDuration).toISOString();
                    }
                    return updatedEvent;
                }
                return e;
            });
        } else { // Generic event
          const duration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
          const newEnd = addMinutes(newStart, duration);
          optimisticEvents = originalEvents.map(e => e.id === draggedEvent.id ? {...e, staffId: newStaffId, start: newStart.toISOString(), end: newEnd.toISOString()} : e);
        }
        setScheduleEvents(optimisticEvents);


        // Background Sync
        (async () => {
          try {
              if (draggedEvent.tripId) {
                const originalTripEvents = originalEvents.filter(e => e.tripId === draggedEvent.tripId);
                const originalTask = originalTripEvents.find(e => e.id.endsWith('-task'))!;
                const originalTravel = originalTripEvents.find(e => e.id.endsWith('-travel'));
                
                let newTaskStart = newStart;
                if (draggedEvent.id.endsWith('-travel')) {
                  const travelDuration = originalTravel ? differenceInMinutes(parseISO(originalTravel.end as string), parseISO(originalTravel.start as string)) : TRAVEL_TIME_MINUTES;
                  newTaskStart = addMinutes(newStart, travelDuration);
                }

                await updateSheetStatus({
                    gasUrl: ORDER_GAS_URL,
                    eventTitle: `(ID: ${originalTask.rawOrderId})`,
                    scheduledTime: newTaskStart.toISOString(),
                    staffName: newStaff.name,
                    statusValue: '作業待ち',
                    timestamp: new Date().toISOString(),
                });

                if (isStaffChange) {
                    if (oldStaff.calendarId) {
                        if (originalTask.calendarEventId) await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'delete', calendarId: oldStaff.calendarId, eventId: originalTask.calendarEventId });
                        if (originalTravel?.calendarEventId) await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'delete', calendarId: oldStaff.calendarId, eventId: originalTravel.calendarEventId });
                    }
                    // Re-fetching will create new calendar events if needed.
                    await refetchOrders();
                }

              } else { // Generic Event
                 const duration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
                 const newEnd = addMinutes(newStart, duration);
                 if (isStaffChange) {
                    if (oldStaff.calendarId && draggedEvent.calendarEventId) await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'delete', calendarId: oldStaff.calendarId, eventId: draggedEvent.calendarEventId });
                    if (newStaff.calendarId) {
                       const result = await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'create', calendarId: newStaff.calendarId, title: draggedEvent.title, description: draggedEvent.description, startTime: newStart.toISOString(), endTime: newEnd.toISOString()});
                       setScheduleEvents(prev => prev.map(e => e.id === draggedEvent.id ? {...e, calendarEventId: result.eventId} : e));
                    }
                 } else {
                    if(newStaff.calendarId && draggedEvent.calendarEventId) await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'update', calendarId: newStaff.calendarId, eventId: draggedEvent.calendarEventId, startTime: newStart.toISOString(), endTime: newEnd.toISOString()});
                 }
              }

              if (isStaffChange && draggedEvent.rawOrderId) {
                  toast({ title: `${newStaff.name}に${customer?.storeName || 'タスク'}の作業を割り当てました` });
              } else {
                  toast({ title: "スケジュールを更新しました" });
              }

          } catch (e: any) {
              toast({ variant: 'destructive', title: '更新エラー', description: `移動に失敗しました: ${e.message}` });
              setScheduleEvents(originalEvents);
          }
        })();

    } else if ('estimatedDuration' in item) { // Adding a new event from orders
        const order = item as WithId<Order>;
        const staff = getStaffById(newStaffId);
        if (!staff) return;
        if (!staff.calendarId) {
            toast({ variant: 'destructive', title: 'エラー', description: `${staff.name}にカレンダーIDが設定されていません。` });
            return;
        }

        const taskStart = getNewStartFromDrop();
        const customer = getCustomerByCode(order.customerCode);
        const isGeneric = order.id.startsWith('generic-');
        
        const originalUnassigned = [...unassignedOrders];
        setUnassignedOrders(prev => prev.filter(o => o.id !== order.id));

        (async () => {
          try {
              if (isGeneric) {
                  const newEventEnd = addMinutes(taskStart, order.estimatedDuration);
                  const result = await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'create', calendarId: staff.calendarId, title: order.taskDetails, startTime: taskStart.toISOString(), endTime: newEventEnd.toISOString() });
                  if (result.status === 'error') throw new Error(result.message);
                  const newEvent: WithId<ScheduleEvent> = { id: `event-${Date.now()}`, title: order.taskDetails, staffId: newStaffId, start: taskStart.toISOString(), end: newEventEnd.toISOString(), calendarEventId: result.eventId };
                  setScheduleEvents(prev => [...prev, newEvent]);
              } else {
                const taskEnd = addMinutes(taskStart, order.estimatedDuration);
                const travelStart = subMinutes(taskStart, TRAVEL_TIME_MINUTES);
                const travelTitle = `移動: ${customer?.storeName || order.taskDetails.split('\n')[0]}`;
                const travelResult = await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'create', calendarId: staff.calendarId, title: travelTitle, startTime: travelStart.toISOString(), endTime: taskStart.toISOString() });
                const taskTitle = order.taskDetails;
                const taskDescription = `顧客: ${customer?.storeName || 'N/A'}\n住所: ${customer?.address || 'N/A'}`;
                const taskResult = await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'create', calendarId: staff.calendarId, title: taskTitle, startTime: taskStart.toISOString(), endTime: taskEnd.toISOString(), description: taskDescription });
                if (taskResult.status === 'error' || travelResult.status === 'error') throw new Error(taskResult.message || travelResult.message);
                await updateSheetStatus({ gasUrl: ORDER_GAS_URL, eventTitle: `(ID: ${order.rawOrderId})`, staffName: staff.name, statusValue: '作業待ち', scheduledTime: taskStart.toISOString(), timestamp: new Date().toISOString(), taskCalendarEventId: taskResult.eventId, travelCalendarEventId: travelResult.eventId });
                const tripId = `trip-${order.rawOrderId}`;
                const travelEvent: WithId<ScheduleEvent> = { id: `${tripId}-travel`, tripId, title: travelTitle, staffId: newStaffId, start: travelStart.toISOString(), end: taskStart.toISOString(), rawOrderId: order.rawOrderId, calendarEventId: travelResult.eventId };
                const taskEvent: WithId<ScheduleEvent> = { id: `${tripId}-task`, tripId, orderId: order.id, rawOrderId: order.rawOrderId, title: taskTitle, staffId: newStaffId, locationId: order.customerCode, start: taskStart.toISOString(), end: taskEnd.toISOString(), calendarEventId: taskResult.eventId, description: taskDescription };
                setScheduleEvents(prev => [...prev, travelEvent, taskEvent]);
                toast({ title: `${staff.name}に${customer?.storeName || 'タスク'}の作業を割り当てました` });
              }
          } catch (e: any) {
               toast({ variant: 'destructive', title: '割当エラー', description: `タスクの割り当てに失敗しました: ${e.message}` });
               setUnassignedOrders(originalUnassigned);
          }
        })();
    }
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
        let savedEvent: WithId<ScheduleEvent> | null = null;
        if (dialogState.mode === 'new') {
            const staff = getStaffById(dialogState.staffId);
            if (!staff || !staff.calendarId) throw new Error("担当スタッフにカレンダーIDが設定されていません。");

            const result = await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'create', calendarId: staff.calendarId, title, description, startTime: newStart.toISOString(), endTime: newEnd.toISOString() });
            
             savedEvent = {
                id: `event-${Date.now()}`,
                title, description,
                staffId: dialogState.staffId,
                locationId: '',
                start: newStart.toISOString(),
                end: newEnd.toISOString(),
                calendarEventId: result.eventId,
            };
            setScheduleEvents(prev => [...prev, savedEvent!]);

        } else if (dialogState.mode === 'edit') {
            const staff = getStaffById(dialogState.event.staffId);
            if (!staff || !staff.calendarId) throw new Error("担当スタッフにカレンダーIDが設定されていません。");
            
            savedEvent = { ...dialogState.event, title, description, start: newStart.toISOString(), end: newEnd.toISOString() };

            if (dialogState.event.rawOrderId) { 
                await updateSheetStatus({
                    gasUrl: ORDER_GAS_URL,
                    eventTitle: `(ID: ${dialogState.event.rawOrderId})`,
                    scheduledTime: newStart.toISOString(),
                    timestamp: new Date().toISOString(),
                });
                await refetchOrders();
            } else if(dialogState.event.calendarEventId) { 
                await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'update', calendarId: staff.calendarId, eventId: dialogState.event.calendarEventId, title, description, startTime: newStart.toISOString(), endTime: newEnd.toISOString() });
                setScheduleEvents(prev => prev.map(e => e.id === savedEvent!.id ? savedEvent! : e));
            }
        }
        setDialogState({ mode: 'closed' });
        return savedEvent;
    } catch (e: any) {
        toast({ variant: 'destructive', title: '保存エラー', description: `カレンダーの更新に失敗しました: ${e.message}` });
        return null;
    }
  };

  const handleDeleteEvent = async (eventToDelete: WithId<ScheduleEvent>) => {
    if (eventToDelete.rawOrderId) {
        await unassignTask(eventToDelete);
    } else {
        const staff = getStaffById(eventToDelete.staffId);
        if(eventToDelete.calendarEventId && staff?.calendarId) {
            try {
                await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'delete', calendarId: staff.calendarId, eventId: eventToDelete.calendarEventId });
                setScheduleEvents(prev => prev.filter(e => e.id !== eventToDelete.id));
                toast({ title: '予定を削除しました' });
            } catch (e: any) {
                toast({ variant: 'destructive', title: '削除エラー', description: `カレンダーの更新に失敗しました: ${e.message}` });
            }
        }
    }
    setDialogState({ mode: 'closed' });
  };
  
    const createIcsData = (event: WithId<ScheduleEvent>, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED'): string => {
        const startDate = parseISO(event.start as string);
        const endDate = parseISO(event.end as string);
        
        const pad = (i: number) => (i < 10 ? '0' + i : '' + i);
        
        const toUTC = (date: Date) => {
            return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
        };
        
        const method = status === 'CANCELLED' ? 'CANCEL' : 'REQUEST';
        
        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//WorkWise//App//EN',
            `METHOD:${method}`,
            'BEGIN:VEVENT',
            `UID:${event.calendarEventId || event.id}@workwise.app`,
            `DTSTAMP:${toUTC(new Date())}`,
            `DTSTART:${toUTC(startDate)}`,
            `DTEND:${toUTC(endDate)}`,
            `SUMMARY:${event.title}`,
            `DESCRIPTION:${event.description || ''}`,
            `STATUS:${status}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        return ics;
    };

    const handleEmailEvent = async (event: WithId<ScheduleEvent>, action: 'create' | 'update' | 'delete') => {
        const staff = getStaffById(event.staffId);

        if (!staff || !staff.email) {
            toast({ variant: 'destructive', title: '送信エラー', description: '担当スタッフのメールアドレスが登録されていません。' });
            return;
        }
        
        setIsSendingEmail(true);

        try {
            let subject = '';
            let icsData = '';
            let status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED';

            if (action === 'create' || action === 'update') {
                subject = `【予定${action === 'create' ? '追加' : '変更'}】${event.title}`;
                status = 'CONFIRMED';
            } else { // delete
                subject = `【予定キャンセル】${event.title}`;
                status = 'CANCELLED';
            }
            icsData = createIcsData(event, status);
            
            const body = `
以下の予定が${status === 'CONFIRMED' ? '追加/更新' : 'キャンセル'}されました。

タイトル: ${event.title}
開始: ${format(parseISO(event.start as string), 'yyyy/MM/dd HH:mm')}
終了: ${format(parseISO(event.end as string), 'yyyy/MM/dd HH:mm')}
詳細:
${event.description || '特になし'}

iCalファイルが添付されていますので、カレンダーに取り込んでください。
            `.trim();

            const result = await sendEmailWithIcs({
                gasUrl: ORDER_GAS_URL,
                to: staff.email,
                subject: subject,
                body: body,
                icsData: icsData,
            });

            if (result.status === 'error') {
                throw new Error(result.message);
            }

            toast({
                title: 'メール送信完了',
                description: `${staff.name} <${staff.email}> に予定を送信しました。`,
            });
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: 'メール送信失敗',
                description: e.message || '不明なエラーが発生しました。',
            });
        } finally {
            setIsSendingEmail(false);
        }
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
  
  const dailySchedule = React.useMemo(() => {
      if (!scheduleEvents) return [];
      return scheduleEvents.filter(event => {
          const eventDate = typeof event.start === 'string' ? parseISO(event.start) : event.start;
          return isValid(eventDate) && isEqual(startOfDay(eventDate), startOfDay(currentDate));
      });
  }, [scheduleEvents, currentDate]);

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
      <TooltipProvider>
        <div className="space-y-4">
            <GenericTasks />
            <UnassignedTasks orders={unassignedOrders} customers={allCustomers || []} date={currentDate} />

            <Card>
                <CardHeader>
                    <CardTitle>タイムライン</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="relative">
                      <div className="sticky top-0 z-20 flex bg-background/95 backdrop-blur-sm">
                          <div className="flex-shrink-0" style={{ width: `${STAFF_COL_WIDTH}px` }}></div>
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
                      </div>
                      <div className="relative">
                        <ScrollArea className="w-full whitespace-nowrap">
                          <div className="relative mt-2" style={{ width: `${timelineTotalHours * 60 * PIXELS_PER_MINUTE + STAFF_COL_WIDTH}px`}}>
                              <div className="relative space-y-2">
                                  {staffData?.map((staff) => {
                                      const events = dailySchedule.filter((e) => e.staffId === staff.id);
                                      return (
                                          <StaffRow
                                              key={staff.id}
                                              staff={staff}
                                              events={events}
                                              getCustomerByCode={getCustomerByCode}
                                              isOver={currentOverStaffId === staff.id}
                                              onDoubleClickEvent={handleDoubleClickEvent}
                                              onDoubleClickTimeline={handleDoubleClickTimeline}
                                          />
                                      );
                                  })}
                              </div>
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      
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
      
                  <DialogFooter className="sm:justify-between flex-wrap gap-2">
                       <div className="flex gap-2">
                           {dialogState.mode === 'edit' && event && (
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <Button variant="destructive">削除</Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                          <AlertDialogTitle>予定を削除しますか？</AlertDialogTitle>
                                          <AlertDialogDescription>
                                              この操作は元に戻せません。{staff?.email && '担当者に削除を通知するメールを送信することもできます。'}
                                          </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteEvent(event)}>
                                            削除のみ
                                          </AlertDialogAction>
                                          {staff?.email &&
                                           <AlertDialogAction onClick={async () => { await handleEmailEvent(event, 'delete'); await handleDeleteEvent(event); }} disabled={isSendingEmail}>
                                            {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                            削除して通知
                                          </AlertDialogAction>
                                          }
                                      </AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
                           )}
                       </div>
                       <div className="flex gap-2 mt-4 sm:mt-0">
                           <DialogClose asChild>
                               <Button variant="ghost">キャンセル</Button>
                           </DialogClose>
                           {staff?.email &&
                           <Button onClick={async () => {
                                const savedEvent = await handleSaveEvent();
                                if (savedEvent) {
                                    await handleEmailEvent(savedEvent, dialogState.mode === 'new' ? 'create' : 'update');
                                }
                           }} disabled={isSendingEmail}>
                                {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                保存して通知
                           </Button>
                           }
                           <Button onClick={handleSaveEvent}>保存</Button>
                       </div>
                   </DialogFooter>
              </DialogContent>
          </Dialog>
      </TooltipProvider>
    </DndContext>
  );
}

interface StaffRowProps {
  staff: WithId<Staff>;
  events: WithId<ScheduleEvent>[];
  getCustomerByCode: (code: string | undefined) => WithId<Customer> | undefined;
  isOver: boolean;
  onDoubleClickEvent: (event: WithId<ScheduleEvent>) => void;
  onDoubleClickTimeline: (staffId: string, e: React.MouseEvent) => void;
}

const StaffRow: React.FC<StaffRowProps> = ({ staff, events, getCustomerByCode, isOver, onDoubleClickEvent, onDoubleClickTimeline }) => {
  const { setNodeRef } = useDroppable({ id: staff.id });

  const areaColors: Record<string, string> = {
    '横浜店': 'bg-blue-50',
    '東名川崎店': 'bg-green-50',
    '綾瀬店': 'bg-orange-50',
  };
  const areaBgClass = staff['母店'] ? areaColors[staff['母店']] || 'bg-background' : 'bg-background';

  return (
    <div className={cn("flex h-16 relative", areaBgClass)}>
      <div className={cn("sticky left-0 z-10 flex-shrink-0 pr-2 flex items-center border-t border-b", areaBgClass)} style={{ width: `${STAFF_COL_WIDTH}px` }}>
        <div className="font-semibold flex items-center gap-2 w-full">
          <div className='w-2 h-8 rounded-full' style={{backgroundColor: staff.color}}></div>
          <span className='truncate flex-1'>{staff.name}</span>
        </div>
      </div>
      <div 
        id={`staff-row-${staff.id}`}
        ref={setNodeRef} 
        className={cn("relative flex-1 h-full", isOver && "bg-primary/10")} 
        onDoubleClick={(e) => onDoubleClickTimeline(staff.id, e)}
      >
        <div className="h-full border-t border-b"></div>
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
    zIndex: isDragging ? 100 : 20,
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
  if (staff.name && brightStaff.includes(staff.name)) {
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
          className={cn("w-full h-full rounded-md flex flex-col justify-center p-1", textColorClass)}
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
