
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
import { addMinutes, differenceInMinutes, format, parseISO, subMinutes, isToday, isValid, getYear, getMonth, getDate, getHours, getMinutes } from 'date-fns';
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
import { useToast } from '@/hooks/use-toast';
import { useOrder } from '@/contexts/order-context';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Textarea } from '../ui/textarea';
import { updateSheetStatus } from '@/app/actions/update-sheet-status';
import { Download } from 'lucide-react';
import * as ics from 'ics';


const PIXELS_PER_MINUTE = 1.5;
const timelineStartHour = 8;
const timelineEndHour = 18;
const timelineTotalHours = timelineEndHour - timelineStartHour;
const TRAVEL_TIME_MINUTES = 30;
const UNASSIGNED_TASKS_DROPPABLE_ID = 'unassigned-tasks-droppable-area';

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
   if (!d || !isValid(d) || isNaN(d.getTime())) {
    // Try to parse just time part like "10:00"
     if (typeof date === 'string') {
        const today = new Date();
        const [hours, minutes] = date.split(':');
        if (hours && minutes) {
            today.setHours(parseInt(hours, 10), parseInt(minutes, 10));
            if (isValid(today)) {
                return format(today, 'HH:mm');
            }
        }
     }
    return "Invalid time";
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

const parseDate = (dateString: any): Date | null => {
  if (!dateString || typeof dateString !== 'string') return null;
  const date = parseISO(dateString);
  return isValid(date) ? date : null;
};

const findKey = (item: any, possibleKeys: string[]) => {
    for (const key of possibleKeys) {
        const lowerKey = key.toLowerCase();
        for (const itemKey in item) {
            if (itemKey.toLowerCase() === lowerKey) {
                return item[itemKey];
            }
        }
    }
    return undefined;
};

const mapRawToOrder = (rawOrder: any): WithId<Order> => {
    const duration = parseInt(rawOrder['作業時間（分）'], 10);
    const line1 = `${rawOrder['お取引先名'] || ''}${rawOrder['予定時間'] ? `：${formatTime(rawOrder['予定時間'])}` : ''}`;
    const line2 = `${rawOrder['タイヤサイズ'] || ''}${rawOrder['本数'] ? `：${rawOrder['本数']}本` : ''}`;
    let taskDetails = line1;
    if (line2.trim()) {
        taskDetails += `\n${line2}`;
    }
    const orderId = findKey(rawOrder, ['受注id', '受注id', 'id', '受注 ID']);
    return {
        id: String(orderId || `ord-${Math.random()}`),
        customerCode: String(findKey(rawOrder, ['ユーザーコード', 'usercode']) || ''),
        taskDetails: taskDetails.trim(),
        estimatedDuration: !isNaN(duration) && duration > 0 ? duration : 60,
        raw: rawOrder,
        rawOrderId: String(orderId || '')
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
    rawOrdersData: any[]; // These are the dynamic, unassigned orders
    setScheduleData: React.Dispatch<React.SetStateAction<WithId<ScheduleEvent>[]>>;
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
                                    <p>本日の未割り当てオーダーはありません。</p>
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
    rawOrdersData,
    setScheduleData,
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
  const { orderGasUrl } = useOrder();

  const [unassignedOrders, setUnassignedOrders] = React.useState<WithId<Order>[]>([]);

  React.useEffect(() => {
      const scheduledOrderIds = new Set(scheduleData.map(e => e.orderId).filter(Boolean));
      const todaysOrders = rawOrdersData
        .filter(order => {
          const scheduledDate = parseDate(order['作業予定日']);
          const receptionDate = parseDate(order['受付日']);
          const isScheduledForToday = scheduledDate ? isToday(scheduledDate) : false;
          const isReceivedToday = receptionDate ? isToday(receptionDate) : false;
          return isScheduledForToday || (isReceivedToday && !scheduledDate);
        })
        .map(mapRawToOrder)
        .filter(order => !scheduledOrderIds.has(order.id));

      setUnassignedOrders(todaysOrders);
  }, [rawOrdersData, scheduleData]);


  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  const getCustomerByCode = (code: string | undefined): WithId<Customer> | undefined => allCustomers?.find(c => c.userCode === code);
  const getCustomerById = (id: string | undefined): WithId<Customer> | undefined => allCustomers?.find(c => c.id === id);
  const getStaffById = (id: string | undefined): WithId<Staff> | undefined => staffData?.find(s => s.id === id);


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

    const rawOrderId = eventToUnassign.rawOrderId;
    
    if (rawOrderId) {
      try {
          const sheetResult = await updateSheetStatus({
              gasUrl: orderGasUrl,
              orderId: rawOrderId,
              staffName: null, 
              eventTitle: eventToUnassign.title,
          });

          if (sheetResult.status === 'error') {
              throw new Error(sheetResult.message);
          }
          
          toast({ title: "担当者をシートから削除しました", description: sheetResult.message });

          const eventsToDeleteIds = eventToUnassign.tripId 
              ? scheduleData.filter(e => e.tripId === eventToUnassign.tripId).map(e => e.id)
              : [eventToUnassign.id];
          
          const orderToPutBack = rawOrdersData.map(mapRawToOrder).find(o => o.rawOrderId === rawOrderId);

          setScheduleData(prev => prev.filter(e => !eventsToDeleteIds.includes(e.id)));
          
          if (orderToPutBack && !unassignedOrders.some(o => o.id === orderToPutBack.id)) {
              setUnassignedOrders(currentOrders => [...currentOrders, orderToPutBack]);
          }

      } catch (e: any) {
          toast({ variant: 'destructive', title: 'シート更新エラー', description: `シートの更新に失敗しました: ${e.message}` });
          return; 
      }
    } else {
        const eventsToDeleteIds = eventToUnassign.tripId 
            ? scheduleData.filter(e => e.tripId === eventToUnassign.tripId).map(e => e.id)
            : [eventToUnassign.id];
        setScheduleData(prev => prev.filter(e => !eventsToDeleteIds.includes(e.id)));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta, over } = event;
    const item = active.data.current as WithId<ScheduleEvent> | WithId<Order>;
    
    setActiveItem(null);
    setCurrentOverStaffId(null);
    
    if (!item) {
      return;
    }

    if (over?.id === UNASSIGNED_TASKS_DROPPABLE_ID && 'staffId' in item) {
        await handleUnassignEvent(item);
        return;
    }
    
    const newStaffId = over?.id as string | undefined;

    // This block handles MOVING an existing event on the timeline
    if ('staffId' in item && 'start' in item && newStaffId && newStaffId !== UNASSIGNED_TASKS_DROPPABLE_ID) {
      const eventToUpdate = item;
      const dragMinutes = pixelsToMinutes(delta.x);
      
      const originalStart = typeof eventToUpdate.start === 'string' ? parseISO(eventToUpdate.start) : eventToUpdate.start;
      const originalEnd = typeof eventToUpdate.end === 'string' ? parseISO(eventToUpdate.end) : eventToUpdate.end;

      const newStart = addMinutes(originalStart, dragMinutes);
      const newEnd = addMinutes(originalEnd, dragMinutes);
      
      const finalStaffId = newStaffId || eventToUpdate.staffId;
      const staffMember = allStaff.find(s => s.id === finalStaffId);

      if (!staffMember) return;
      
      const updatedEvent = {
        ...eventToUpdate,
        staffId: finalStaffId,
        start: newStart,
        end: newEnd,
      };
      
      if (updatedEvent.rawOrderId && eventToUpdate.staffId !== finalStaffId) {
          try {
              const sheetResult = await updateSheetStatus({
                  gasUrl: orderGasUrl,
                  orderId: updatedEvent.rawOrderId,
                  staffName: staffMember.name,
                  eventTitle: updatedEvent.title,
              });
              if (sheetResult.status === 'error') {
                 toast({ variant: 'destructive', title: 'シート更新エラー', description: `シートの更新に失敗しました: ${sheetResult.message}` });
                 return; // Do not update UI if sheet update fails
              }
              toast({ title: '担当者をシートで更新しました', description: `担当者を「${staffMember.name}」に変更しました。`});
              setScheduleData(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
          } catch(e: any) {
              toast({ variant: 'destructive', title: 'シート更新エラー', description: `シートの更新に失敗しました: ${e.message}` });
          }
      } else {
          setScheduleData(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
          toast({ title: 'タスクを更新しました', description: `時間を変更しました。` });
      }
    }
    // This block handles ADDING a NEW event from the unassigned list
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

        if (isGeneric) {
             const newStart = addMinutes(startOfDay, dropMinutes);
             const newEnd = addMinutes(newStart, order.estimatedDuration);
             const newEvent: WithId<ScheduleEvent> = {
                id: `event-${Date.now()}`,
                title: order.taskDetails,
                description: '',
                staffId: newStaffId,
                locationId: '',
                start: newStart,
                end: newEnd,
             };
             setScheduleData(prev => [...prev, newEvent]);
        } else {
            const taskStart = addMinutes(startOfDay, dropMinutes);
            const taskEnd = addMinutes(taskStart, order.estimatedDuration);
            const travelStart = subMinutes(taskStart, TRAVEL_TIME_MINUTES);
            const customer = getCustomerByCode(order.customerCode);
            const tripId = `trip-${Date.now()}`;
            
            const rawOrderId = order.rawOrderId;
            
            const taskEvent: WithId<ScheduleEvent> = {
                id: `event-${Date.now()}-task`,
                tripId: tripId,
                orderId: order.id,
                rawOrderId: rawOrderId,
                title: order.taskDetails,
                description: `顧客: ${customer?.storeName || 'N/A'}\n住所: ${customer?.address || 'N/A'}\n詳細:\n${order.taskDetails}`,
                staffId: newStaffId,
                locationId: customer?.id || '',
                start: taskStart,
                end: taskEnd,
            };

            const travelEvent: WithId<ScheduleEvent> = {
                id: `event-${Date.now()}-travel`,
                tripId: tripId,
                title: `移動: ${customer?.storeName || order.customerCode}`,
                description: `目的地: ${customer?.address || 'N/A'}`,
                staffId: newStaffId,
                locationId: customer?.id || '',
                start: travelStart,
                end: taskStart,
            };
            
            try {
              const sheetResult = await updateSheetStatus({
                gasUrl: orderGasUrl,
                orderId: rawOrderId,
                staffName: staff.name,
                eventTitle: taskEvent.title,
              });

              if (sheetResult.status === 'error') {
                toast({ variant: 'destructive', title: 'シート更新エラー', description: `シートの更新に失敗しました: ${sheetResult.message}` });
                return; // Do not update UI if sheet fails
              }
              
              toast({ title: '担当者をシートに記録しました', description: sheetResult.message });
              
              setUnassignedOrders(prev => prev.filter(o => o.id !== order.id));
              setScheduleData(prev => [...prev, travelEvent, taskEvent]);
              
            } catch (e: any) {
              toast({ variant: 'destructive', title: 'シート更新エラー', description: `シートの更新に失敗しました: ${e.message}` });
            }
        }
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

        const newEvent: WithId<ScheduleEvent> = {
            id: `event-${Date.now()}`,
            title,
            description,
            staffId: dialogState.staffId,
            locationId: '',
            start: newStart,
            end: newEnd,
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

        setScheduleData(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    }
    setDialogState({ mode: 'closed' });
  };

  const handleDeleteEvent = async () => {
    if (dialogState.mode !== 'edit') return;
    await handleUnassignEvent(dialogState.event);
    setDialogState({ mode: 'closed' });
  };


  const handleExportToIcs = () => {
    if (dialogState.mode !== 'edit') return;
    
    const { event } = dialogState;
    const start = typeof event.start === 'string' ? parseISO(event.start) : event.start;
    const end = typeof event.end === 'string' ? parseISO(event.end) : event.end;
    
    if (!isValid(start) || !isValid(end)) {
      toast({
        variant: 'destructive',
        title: 'エクスポート失敗',
        description: 'イベントの日時が無効です。',
      });
      return;
    }
    
    const eventToExport: ics.EventAttributes = {
      title: event.title,
      description: event.description,
      start: [getYear(start), getMonth(start) + 1, getDate(start), getHours(start), getMinutes(start)],
      end: [getYear(end), getMonth(end) + 1, getDate(end), getHours(end), getMinutes(end)],
    };

    ics.createEvent(eventToExport, (error, value) => {
      if (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'エクスポート失敗',
          description: 'iCalファイルの生成中にエラーが発生しました。',
        });
        return;
      }

      if (value) {
        const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'schedule.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
         toast({
          title: 'エクスポート成功',
          description: 'カレンダーファイル（schedule.ics）がダウンロードされました。',
        });
      }
    });
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

            <DialogFooter className="justify-between sm:justify-between w-full">
                <div className="flex gap-2">
                  {dialogState.mode === 'edit' && (
                      <Button variant="destructive" onClick={handleDeleteEvent}>削除</Button>
                  )}
                   {dialogState.mode === 'edit' && (
                    <Button variant="outline" onClick={handleExportToIcs}>
                      <Download className="mr-2 h-4 w-4" />
                      エクスポート (.ics)
                    </Button>
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

  const hslMatch = typeof backgroundColor === 'string' ? backgroundColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/) : null;
  const hexMatch = typeof backgroundColor === 'string' ? backgroundColor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i) : null;


  if (isTravelEvent) {
    if (hslMatch) {
      const [_, h, s] = hslMatch;
      backgroundColor = `hsl(${h}, ${Number(s) * 0.5}%, 50%)`;
      color = 'white';
    } else if (hexMatch) {
       backgroundColor = '#a0aec0'; // A generic gray color as hex fallback
       color = 'white';
    }
     else {
      backgroundColor = 'hsl(210, 14%, 88%)'; // Muted color fallback
      color = 'hsl(var(--foreground))';
    }
  } else if (isBreakEvent) {
     if (hslMatch) {
      const [_, h, s] = hslMatch;
      backgroundColor = `hsl(${h}, ${s}%, 90%)`;
      color = 'hsl(var(--foreground))';
    } else if (hexMatch) {
        backgroundColor = '#c6f6d5'; // A generic light green as hex fallback
        color = 'black';
    } else {
      backgroundColor = `hsl(120, 40%, 85%)`;
      color = 'hsl(var(--foreground))';
    }
  }
  
  const [line1, ...rest] = (event.title || '').split('\n');
  const line2 = rest.join('\n');


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
          {line2 && (
            <p className="text-xs opacity-80 truncate pointer-events-none">
                {line2}
            </p>
          )}
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
