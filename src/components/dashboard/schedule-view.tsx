'use client';

import * as React from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ScheduleEvent, Staff, Order, WithId, StaffStatus, Customer } from '@/lib/types';
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
import { cn, getContrastingTextColor, formatTime } from '@/lib/utils';
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
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { updateSheetStatus, sendIcsViaGmail } from '@/app/actions/gas-actions';
import { ORDER_GAS_URL } from '@/lib/settings';
import { useOrder } from '@/contexts/order-context';
import { Mail } from 'lucide-react';
import { useCustomer } from '@/contexts/customer-context';


const PIXELS_PER_MINUTE = 1.2;
const timelineStartHour = 9;
const timelineEndHour = 19;
const timelineTotalHours = timelineEndHour - timelineStartHour;
const TRAVEL_TIME_MINUTES = 30;
const UNASSIGNED_TASKS_DROPPABLE_ID = 'unassigned-tasks-droppable-area';
const STAFF_COL_WIDTH = 144;
const STATUS_COL_WIDTH = 120;
const HEADER_AREA_HEIGHT_REM = 15;

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
  
  const startOfTimeline = new Date(start);
  startOfTimeline.setHours(timelineStartHour, 0, 0, 0);

  const leftInMinutes = differenceInMinutes(start, startOfTimeline);
  const widthInMinutes = differenceInMinutes(end, start);

  return {
    left: minutesToPixels(leftInMinutes),
    width: minutesToPixels(widthInMinutes > 0 ? widthInMinutes : 30), 
  };
};

interface DraggableOrderProps {
  order: WithId<Order>;
  style?: React.CSSProperties;
  isOverlay?: boolean;
}

const DraggableOrder: React.FC<DraggableOrderProps> = ({ order, style: customStyle, isOverlay }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `order-${order.rawOrderId}`,
      data: { ...order, isOrder: true },
    });

  const style: React.CSSProperties = {
      ...(transform && !isOverlay ? { transform: CSS.Translate.toString(transform) } : {}),
      width: `${minutesToPixels(order.estimatedDuration || 60)}px`,
      ...customStyle,
  };
  
  const isGeneric = order.id.startsWith('generic-');

  let line1, line2, tooltipContent;

  if (isGeneric) {
    line1 = order.taskDetails;
    tooltipContent = (
      <>
        <p className="font-bold">{line1}</p>
        <p className="text-xs text-muted-foreground">所要時間: {order.estimatedDuration}分</p>
      </>
    );
  } else {
    const equipmentMark = order.equipmentStatus ? `（${order.equipmentStatus.charAt(0)}）` : '';
    const name = order.customerName || '不明な顧客';
    line1 = `${name}${equipmentMark}`;
    const scheduledTimeFormatted = order.scheduledTime ? formatTime(order.scheduledTime) : '';
    line2 = [scheduledTimeFormatted, order.tireSize].filter(Boolean).join('・');
     tooltipContent = (
      <>
        <p className="font-bold">{line1}</p>
        <p>{line2}</p>
        <p className="text-xs text-muted-foreground mt-1">所要時間: {order.estimatedDuration}分</p>
        <p className="text-xs text-muted-foreground">作業内容: {order.taskDetails}</p>
      </>
    );
  }
  
  return (
      <Tooltip>
        <TooltipTrigger
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          className={cn(
            "h-12 rounded-md px-2 flex flex-col justify-center cursor-move",
            !customStyle && 'bg-primary text-primary-foreground',
            isDragging && !isOverlay && "opacity-30"
          )}
        >
          <div className="pointer-events-none">
            <p className="text-xs font-semibold truncate">
              {line1}
            </p>
            {line2 && <p className="text-xs opacity-80 truncate">
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
    orders: WithId<Order>[]; // unassigned orders
    scheduleEvents: WithId<ScheduleEvent>[];
    currentDate: Date;
    statuses: StaffStatus[];
}

const genericTasks: WithId<Order>[] = [
      { id: 'generic-travel', rawOrderId: 'generic-travel', customerCode: '', taskDetails: '移動', estimatedDuration: 30, customerName: '', address: '', serviceType: '', status: 'Scheduled', scheduledDate: '', value: 0 },
      { id: 'generic-work', rawOrderId: 'generic-work', customerCode: '', taskDetails: '業務', estimatedDuration: 60, customerName: '', address: '', serviceType: '', status: 'Scheduled', scheduledDate: '', value: 0 },
      { id: 'generic-break', rawOrderId: 'generic-break', customerCode: '', taskDetails: '休憩', estimatedDuration: 60, customerName: '', address: '', serviceType: '', status: 'Scheduled', scheduledDate: '', value: 0 },
];

function GenericTasks() {
    const getDraggableStyle = (task: Order): React.CSSProperties => {
        let backgroundColor = 'hsl(var(--primary))';
        if (task.id === 'generic-travel') backgroundColor = '#facc15'; // yellow-400
        if (task.id === 'generic-work') backgroundColor = '#9ca3af'; // gray-400
        if (task.id === 'generic-break') backgroundColor = '#22c55e'; // green-500

        const color = getContrastingTextColor(backgroundColor);
        return { backgroundColor, color };
    };

    return (
        <Card className="h-full">
            <CardHeader className='pb-4'>
                <CardTitle className="text-lg">汎用タスク</CardTitle>
                 <CardDescription>休憩や移動など、受注以外のタスクです。</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex flex-wrap gap-2">
                    {genericTasks.map((task) => (
                        <DraggableOrder
                            key={task.id}
                            order={task}
                            style={getDraggableStyle(task)}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function UnassignedTasks({ orders, date }: { orders: WithId<Order>[], date: Date }) {
    const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_TASKS_DROPPABLE_ID });
    
    const titleText = isToday(date) ? '本日の受注タスク' : `${format(date, 'M/d')}の受注タスク`;
    
    const todaysOrders = orders.filter(order => {
        const orderDateStr = order.scheduledDate;
        if (!orderDateStr) return false;
        
        const orderDate = parseISO(orderDateStr);
        if (!isValid(orderDate)) return false;

        return isEqual(startOfDay(orderDate), startOfDay(date));
    });

    return (
        <Card 
            ref={setNodeRef}
            className={cn("transition-colors h-full", isOver && "bg-primary/10 border-primary/50")}
        >
            <CardHeader className='pb-4'>
                <CardTitle className="text-lg">{titleText}</CardTitle>
                <CardDescription>下のタイムラインにタスクをドラッグして割り当てます。</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="pr-4 min-h-[6rem]">
                        <div className="flex flex-wrap gap-2">
                            {todaysOrders.map((order) => (
                                <DraggableOrder
                                    key={order.id}
                                    order={order}
                                    style={{
                                        backgroundColor: 'hsl(var(--primary))',
                                        color: 'hsl(var(--primary-foreground))'
                                    }}
                                />
                            ))}
                            {todaysOrders.length === 0 && (
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

    if (!now || !isToday(now)) return null; 
    
    const isVisible = now.getHours() >= timelineStartHour && now.getHours() < timelineEndHour;
    if (!isVisible) return null;
    
    const minutesFromStart = (now.getHours() - timelineStartHour) * 60 + now.getMinutes();
    const leftPosition = minutesToPixels(minutesFromStart);

    return (
        <div
            className="absolute top-0 w-0.5 bg-red-500 pointer-events-none z-40"
            style={{ left: `${leftPosition}px`, bottom: "-100vh" }}
        >
            <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500"></div>
        </div>
    );
};

export function ScheduleView({ 
    staffData, 
    orders,
    scheduleEvents: initialScheduleEvents,
    currentDate,
    statuses,
}: ScheduleViewProps) {
  const [isClient, setIsClient] = React.useState(false);
  const { toast } = useToast();
  const { refetchOrders } = useOrder();
  const { customers: allCustomers } = useCustomer();
  
  const [scheduleEvents, setScheduleEvents] = React.useState<WithId<ScheduleEvent>[]>(initialScheduleEvents);
  const [unassignedOrders, setUnassignedOrders] = React.useState<WithId<Order>[]>(orders);

  // When initial data from props changes, update the internal state
  React.useEffect(() => {
      setScheduleEvents(initialScheduleEvents);
      setUnassignedOrders(orders);
  }, [initialScheduleEvents, orders]);


  const [dialogState, setDialogState] = React.useState<DialogState>({ mode: 'closed' });
  const [editedEventDetails, setEditedEventDetails] = React.useState<EditedEventDetails>({ title: '', description: '', startTime: '', endTime: '' });
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const dailySchedule = React.useMemo(() => {
      if (!scheduleEvents) return [];
      return scheduleEvents.filter(event => {
          const eventDate = typeof event.start === 'string' ? parseISO(event.start) : event.start;
          return isValid(eventDate) && isEqual(startOfDay(eventDate), startOfDay(currentDate));
      });
  }, [scheduleEvents, currentDate]);

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
        
        toast({ title: 'タスクを未割り当てに戻しました' });
        await refetchOrders(); // Re-fetch all data to ensure consistency
      } catch(e: any) {
          console.error("Unassignment failed:", e);
          toast({ variant: 'destructive', title: '更新エラー', description: `シートの更新に失敗しました: ${e.message}` });
      }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    const item = active.data.current as (WithId<Order> & {isOrder?: boolean}) | WithId<ScheduleEvent>;

    setActiveItem(null);
    setCurrentOverStaffId(null);
    
    if (!item || !over) return;
    
    if (over.id === UNASSIGNED_TASKS_DROPPABLE_ID && 'staffId' in item) {
        if (item.rawOrderId && !item.rawOrderId.startsWith('generic-')) {
          await unassignTask(item as WithId<ScheduleEvent>);
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

    const newStart = getNewStartFromDrop();

    if ('staffId' in item) {
        const draggedEvent = item as WithId<ScheduleEvent>;
        
        // Optimistic UI update
        const isTripEvent = !!draggedEvent.tripId;
        
        setScheduleEvents(prev => {
            return prev.map(e => {
                if (isTripEvent && e.tripId === draggedEvent.tripId) {
                    const taskDuration = differenceInMinutes(parseISO(e.end as string), parseISO(e.start as string));
                    let newTaskStart;
                    if (draggedEvent.id.endsWith('-task')) {
                      newTaskStart = addMinutes(parseISO(e.start as string), delta.x / PIXELS_PER_MINUTE);
                    } else { // Ends with -travel
                      const travelDuration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
                      const originalTravelStart = addMinutes(parseISO(e.start as string), delta.x / PIXELS_PER_MINUTE);
                      newTaskStart = addMinutes(originalTravelStart, travelDuration);
                    }

                    const roundedNewTaskStart = addMinutes(startOfTimelineDay, pixelsToMinutes(differenceInMinutes(newTaskStart, startOfTimelineDay)));
                    const newTaskEnd = addMinutes(roundedNewTaskStart, taskDuration);
                    
                    if(e.id.endsWith('-task')){
                      return { ...e, staffId: newStaffId, start: roundedNewTaskStart.toISOString(), end: newTaskEnd.toISOString() };
                    } else { // travel event
                      const travelDuration = differenceInMinutes(parseISO(e.end as string), parseISO(e.start as string));
                      return { ...e, staffId: newStaffId, start: subMinutes(roundedNewTaskStart, travelDuration).toISOString(), end: roundedNewTaskStart.toISOString() };
                    }
                } else if (!isTripEvent && e.id === draggedEvent.id) {
                    const duration = differenceInMinutes(parseISO(e.end as string), parseISO(e.start as string));
                    const eventStart = addMinutes(parseISO(e.start as string), delta.x / PIXELS_PER_MINUTE);
                    const roundedNewStart = addMinutes(startOfTimelineDay, pixelsToMinutes(differenceInMinutes(eventStart, startOfTimelineDay)));
                    const newEnd = addMinutes(roundedNewStart, duration);
                    return { ...e, staffId: newStaffId, start: roundedNewStart.toISOString(), end: newEnd.toISOString() };
                }
                return e;
            });
        });
        
        // Backend update
        (async () => {
            try {
                if (draggedEvent.rawOrderId && !draggedEvent.rawOrderId.startsWith('generic-')) {
                    const newStaff = getStaffById(newStaffId);
                    await updateSheetStatus({
                        gasUrl: ORDER_GAS_URL,
                        eventTitle: `(ID: ${draggedEvent.rawOrderId})`,
                        staffName: newStaff?.name,
                        scheduledTime: newStart.toISOString(),
                    });
                }
                toast({ title: "スケジュールを更新しました" });
            } catch (e: any) {
                toast({ variant: 'destructive', title: '更新エラー', description: `スケジュールの更新に失敗しました: ${e.message}` });
            } finally {
                await refetchOrders();
            }
        })();
    
    } else if ('isOrder' in item && item.isOrder) {
        const order = item as WithId<Order>;
        const staff = getStaffById(newStaffId);
        if (!staff) return;

        const isGeneric = order.id.startsWith('generic-');
        
        if (isGeneric) {
             const newEvent: WithId<ScheduleEvent> = {
                ...order,
                id: `event-${Date.now()}`,
                title: order.taskDetails,
                description: '',
                staffId: newStaffId,
                locationId: '',
                start: newStart.toISOString(),
                end: addMinutes(newStart, order.estimatedDuration).toISOString(),
             };
             setScheduleEvents(prev => [...prev, newEvent]);
             toast({ title: "汎用タスクを追加しました" });
        } else {
             const tripId = `trip-${order.rawOrderId}`;
             const taskEvent: WithId<ScheduleEvent> = {
                ...order,
                id: `${tripId}-task`,
                tripId,
                orderId: order.id,
                title: order.taskDetails,
                staffId: newStaffId,
                locationId: order.customerCode || '',
                start: newStart.toISOString(),
                end: addMinutes(newStart, order.estimatedDuration).toISOString(),
             };

             const travelEvent: WithId<ScheduleEvent> = {
                ...order,
                id: `${tripId}-travel`,
                tripId,
                orderId: order.id,
                title: `移動: ${order.customerName || order.taskDetails.split('\n')[0]}`,
                staffId: newStaffId,
                locationId: order.customerCode || '',
                start: subMinutes(newStart, TRAVEL_TIME_MINUTES).toISOString(),
                end: newStart.toISOString(),
             };
             
             // Optimistic UI Update
             setScheduleEvents(prev => [...prev, travelEvent, taskEvent]);
             setUnassignedOrders(prev => prev.filter(o => o.id !== order.id));
        
            // Backend Update
            (async () => {
                try {
                    await updateSheetStatus({
                        gasUrl: ORDER_GAS_URL,
                        eventTitle: `(ID: ${order.rawOrderId})`,
                        staffName: staff.name,
                        statusValue: '作業待ち',
                        scheduledTime: newStart.toISOString(),
                        timestamp: new Date().toISOString(),
                    });
                    toast({ title: "タスクを割り当てました" });
                } catch (e: any) {
                    toast({ variant: 'destructive', title: '割当エラー', description: `タスクの割り当てに失敗しました: ${e.message}` });
                } finally {
                    await refetchOrders();
                }
            })();
        }
    }
  };

  const handleEventClick = (event: WithId<ScheduleEvent>) => {
    if (event.id.endsWith('-travel')) return;
    setEditedEventDetails({
        title: event.customerName || event.title || '',
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
    
    const startOfTimelineDay = new Date(currentDate);
    startOfTimelineDay.setHours(timelineStartHour, 0, 0, 0);
    const newStart = addMinutes(startOfTimelineDay, clickMinutes);

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
                 // Fill required Order properties for the type
                rawOrderId: `generic-${Date.now()}`,
                customerCode: '',
                customerName: '',
                address: '',
                taskDetails: title,
                serviceType: '',
                status: '作業待ち',
                scheduledDate: currentDate.toISOString(),
                estimatedDuration: differenceInMinutes(newEnd, newStart),
                value: 0,
            };
            setScheduleEvents(prev => [...prev, newEvent]);

        } else if (dialogState.mode === 'edit') {
            if (dialogState.event.rawOrderId && !dialogState.event.rawOrderId.startsWith('generic-')) { // Sheet-based event
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
    
    if (eventToDelete.rawOrderId && !eventToDelete.rawOrderId.startsWith('generic-')) {
        await unassignTask(eventToDelete);
    } else {
        setScheduleEvents(prev => prev.filter(e => e.id !== eventToDelete.id));
        toast({ title: '予定を削除しました' });
    }

    setDialogState({ mode: 'closed' });
  };
    
  const handleSendIcalMail = async () => {
        if (dialogState.mode !== 'edit') return;
        const { event } = dialogState;
        const staff = getStaffById(event.staffId);

        if (!staff || !staff.email) {
            toast({ variant: 'destructive', title: '送信エラー', description: '担当スタッフにメールアドレスが設定されていません。' });
            return;
        }

        try {
            const result = await sendIcsViaGmail({
                gasUrl: ORDER_GAS_URL,
                recipient: staff.email,
                title: event.title,
                description: event.description,
                startTime: (event.start as Date | string).toString(),
                endTime: (event.end as Date | string).toString(),
                location: event.address,
            });
             if (result.status === 'error') throw new Error(result.message);
            toast({ title: 'iCalメールを送信しました', description: `${staff.name}宛に予定を送信しました。` });

        } catch (e: any) {
            toast({ variant: 'destructive', title: '送信エラー', description: `iCalメールの送信に失敗しました: ${e.message}` });
        }
    }

  const getDialogDetails = () => {
    if (dialogState.mode === 'edit') {
      const { event } = dialogState;
      const staff = getStaffById(event.staffId);
      return { event, staff, title: '予定の編集' };
    }
    if (dialogState.mode === 'new') {
      const staff = getStaffById(dialogState.staffId);
      return { staff, start: dialogState.start, title: '新規予定の作成' };
    }
    return { event: undefined, staff: undefined, start: undefined, title: '' };
  };

  const { event, staff, title } = getDialogDetails();

  if (!isClient) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3 h-48 rounded-lg bg-muted animate-pulse"></div>
          <div className="md:col-span-2 h-48 rounded-lg bg-muted animate-pulse"></div>
        </div>
        <div className="h-[calc(100vh-20rem)] rounded-lg bg-muted animate-pulse"></div>
      </div>
    );
  }

  const getDraggableStyle = (task: Order) => {
      let backgroundColor = 'hsl(var(--primary))';
      if (task.id === 'generic-travel') backgroundColor = '#facc15'; // yellow-400
      if (task.id === 'generic-work') backgroundColor = '#9ca3af'; // gray-400
      if (task.id === 'generic-break') backgroundColor = '#22c55e'; // green-500
      
      const color = getContrastingTextColor(backgroundColor);
      return { backgroundColor, color };
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver} sensors={sensors}>
      <TooltipProvider>
        <div className="flex flex-col h-full">
            <div className="sticky top-0 z-20 bg-background pt-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="md:col-span-3">
                      <UnassignedTasks orders={unassignedOrders} date={currentDate} />
                  </div>
                  <div className="md:col-span-2">
                      <GenericTasks />
                  </div>
                </div>
                
                <div className="relative flex border-t border-b mt-2 bg-background/95 backdrop-blur-sm">
                    <div className="flex-shrink-0 font-semibold p-2" style={{ width: `${STAFF_COL_WIDTH}px` }}>スタッフ</div>
                    <div className="relative flex-1">
                        {isToday(currentDate) && <TimeIndicator />}
                        {Array.from({ length: timelineTotalHours + 1 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute border-l"
                                style={{ left: `${i * 60 * PIXELS_PER_MINUTE}px`, top: 0, bottom: 0 }}
                            >
                                <span className="absolute top-1 -translate-x-1/2 text-xs text-muted-foreground">
                                    {timelineStartHour + i}:00
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex-shrink-0 font-semibold p-2 border-l text-center" style={{ width: `${STATUS_COL_WIDTH}px`}}>ステータス</div>
                </div>
            </div>
            
            <ScrollArea 
                className="flex-grow" 
                style={{ height: `calc(100vh - ${HEADER_AREA_HEIGHT_REM + 6}rem)` }}
            >
              <div className="relative space-y-2 pb-4">
                {staffData?.map((staff) => {
                    const events = dailySchedule.filter((e) => e.staffId === staff.id);
                    const status = statuses.find(s => s.staffId === staff.id);
                    return (
                        <StaffRow
                            key={staff.id}
                            staff={staff}
                            events={events}
                            status={status}
                            isOver={currentOverStaffId === staff.id}
                            onEventClick={handleEventClick}
                            onDoubleClickTimeline={handleDoubleClickTimeline}
                        />
                    );
                })}
              </div>
            </ScrollArea>
        </div>
      
      <DragOverlay>
        {activeItem && activeItem.isOrder && (
            <DraggableOrder
              order={activeItem}
              style={activeItem.id.startsWith('generic-') ? getDraggableStyle(activeItem) : {
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))'
              }}
              isOverlay
            />
        )}
        {activeItem && activeItem.staffId && (
           <DraggableEvent
              event={activeItem}
              staff={getStaffById(activeItem.staffId)!}
              onClick={() => {}}
              isOverlay
            />
        )}
      </DragOverlay>

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
                          </div>
                      )}
                       {dialogState.mode === 'new' && (
                          <div className="text-sm">
                              <p><span className="font-semibold text-muted-foreground">担当:</span> {staff?.name}</p>
                          </div>
                      )}
                      <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="title" className="text-right">お取引先名</Label>
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
                            <>
                              <Button variant="outline" size="sm" onClick={handleSendIcalMail}><Mail className="mr-2 h-4 w-4" /> メール</Button>
                              <Button variant="destructive" size="sm" onClick={handleDeleteEvent}>削除</Button>
                            </>
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
      </TooltipProvider>
    </DndContext>
  );
}

interface StaffRowProps {
  staff: WithId<Staff>;
  events: WithId<ScheduleEvent>[];
  status?: StaffStatus;
  isOver: boolean;
  onEventClick: (event: WithId<ScheduleEvent>) => void;
  onDoubleClickTimeline: (staffId: string, e: React.MouseEvent) => void;
}

const StaffRow: React.FC<StaffRowProps> = ({ staff, events, status, isOver, onEventClick, onDoubleClickTimeline }) => {
  const { setNodeRef } = useDroppable({ id: staff.id });
  const areaColorMap: Record<string, string> = {
    '横浜店': '#e0f2fe', // blue-50
    '東名川崎店': '#f0fdf4', // green-50
    '綾瀬店': '#fff7ed', // orange-50
  };
  
  const bgColor = staff['母店'] ? areaColorMap[staff['母店']] || '#ffffff' : '#ffffff';
  
  const staffRowStyle: React.CSSProperties = {
    backgroundColor: bgColor,
  };

  const staffNameStyle: React.CSSProperties = {
    width: `${STAFF_COL_WIDTH}px`,
    backgroundColor: bgColor,
  };

  const statusStyle: React.CSSProperties = {
    width: `${STATUS_COL_WIDTH}px`,
    backgroundColor: bgColor,
  };


  return (
    <div className="flex relative" style={staffRowStyle}>
      {/* Staff Name Cell */}
      <div className="sticky left-0 z-10 flex-shrink-0 px-2 flex items-center border-r h-16" style={staffNameStyle}>
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
              onClick={() => onEventClick(event)}
            />
          ))}
        </div>
      </div>

      {/* Status Cell */}
      <div className="sticky right-0 z-10 flex-shrink-0 px-2 flex items-center justify-center border-l border-b h-16" style={statusStyle}>
        {status && isToday(new Date()) && (
          <div className="text-xs text-center font-medium">
             {status.status}
          </div>
        )}
      </div>
    </div>
  )
};

interface DraggableEventProps {
  event: WithId<ScheduleEvent>;
  staff: WithId<Staff>;
  onClick: () => void;
  isOverlay?: boolean;
}

const DraggableEvent: React.FC<DraggableEventProps> = ({ event, staff, onClick, isOverlay }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: event,
  });

  const { left, width } = getEventDimensions(event.start, event.end);

  const style: React.CSSProperties = {
    left: isOverlay ? undefined : `${left}px`,
    width: `${width}px`,
    transform: transform && !isOverlay ? CSS.Translate.toString(transform) : undefined,
    zIndex: isDragging ? 100 : 20, // ensure events are above the timeline grid but below overlay
  };
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };
  
  const isTravelEvent = event.title?.startsWith('移動');

  const divStyle: React.CSSProperties = {
      backgroundColor: staff.color || 'hsl(var(--primary))',
      color: getContrastingTextColor(staff.color || 'hsl(var(--primary))')
  };

  if (isTravelEvent) {
    divStyle.opacity = 0.5;
  }

  const isGeneric = !event.rawOrderId || event.rawOrderId.startsWith('generic-');
  let line1: string;
  let line2: string | undefined;

  if (isTravelEvent) {
    line1 = event.title;
  } else if (isGeneric) {
    line1 = event.title;
  } else {
    const equipmentMark = event.equipmentStatus ? `（${event.equipmentStatus.charAt(0)}）` : '';
    line1 = `${event.customerName || '不明な顧客'}${equipmentMark}`;
    const scheduledTimeFormatted = event.scheduledTime ? formatTime(event.scheduledTime) : formatTime(event.start);
    line2 = [scheduledTimeFormatted, event.tireSize].filter(Boolean).join('・');
  }

  const tooltipTitle = isTravelEvent || isGeneric ? event.title : line1;
  const tooltipDescription = !isGeneric ? (
    <>
      <p>{line2}</p>
      <p className="text-xs text-muted-foreground mt-1">所要時間: {event.estimatedDuration}分</p>
      <p className="text-xs text-muted-foreground">作業内容: {event.taskDetails}</p>
    </>
  ) : null;
  
  return (
    <Tooltip>
      <TooltipTrigger
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={handleClick}
        className={cn(
          "absolute h-12 top-1/2 -translate-y-1/2 rounded-lg border p-1 shadow-sm transition-all flex items-center cursor-grab active:cursor-grabbing active:shadow-lg",
          isOverlay ? "" : "transition-all duration-200 ease-in-out",
          isDragging && !isOverlay && "opacity-30 shadow-2xl scale-105"
        )}
        data-event-chip="true"
      >
        <div className="flex h-full w-1.5 flex-shrink-0 rounded-full bg-current mr-2" style={{ backgroundColor: staff.color }}></div>
        <div
          className="w-full h-full rounded-md flex flex-col justify-center"
          style={{ backgroundColor: 'transparent' }} // Let the parent handle the color
        >
          <p className="text-xs font-semibold truncate pointer-events-none" style={{ color: divStyle.color }}>
            {line1}
          </p>
          {line2 && (
            <p className="text-xs opacity-80 truncate pointer-events-none" style={{ color: divStyle.color }}>
                {line2}
            </p>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-bold">{tooltipTitle || '未定のタスク'}</p>
        <p className="text-sm">時間: {formatTime(event.start)} - {formatTime(event.end)}</p>
        <p className="text-sm">担当: {staff.name}</p>
        {tooltipDescription}
      </TooltipContent>
    </Tooltip>
  );
};
