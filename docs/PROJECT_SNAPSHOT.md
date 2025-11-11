# WorkWise Project Snapshot

This file contains a snapshot of the key files in the WorkWise project. You can use this as a reference or a backup of the current state.

---

## `src/lib/settings.ts`

```typescript
/**
 * アプリケーション全体で使用される設定値を管理します。
 * GASのURLなど、環境によって変更される可能性のある値を一元管理します。
 */

// 注: これらのURLはサンプルです。実際のGASのデプロイURLやシートのURLに置き換えてください。

// --- データソース (Google Apps Script) ---

/**
 * スタッフマスターのデータを取得・更新するためのGoogle Apps ScriptのURL。
 * 主に staff-context.tsx や auth.ts で使用されます。
 */
export const STAFF_GAS_URL = 'https://script.google.com/macros/s/AKfycbyjdlLbXbsqg3bRM-FyHElXqwdBIhB82mKnf8IydWjG_1OgVwmejURN0psdjgmLndhj/exec';

/**
 * 顧客情報（販売店情報）を取得・更新するためのGoogle Apps ScriptのURL。
 * 主に customer-context.tsx で使用されます。
 */
export const CUSTOMER_GAS_URL = 'https://script.google.com/macros/s/AKfycbygUg4b1tD4Y489xg0Fz09e84DtDAy_35KhJ_VD4RyJ3J1DavI0B_aZP5ck8hssWPCi/exec';

/**
 * 受注情報を取得・更新し、カレンダー連携も行うGoogle Apps ScriptのURL。
 * 主に order-context.tsx や schedule-view.tsx で使用されます。
 */
export const ORDER_GAS_URL = 'https://script.google.com/macros/s/AKfycbx-X3zK_YBrqdnUXV2r85h-OnPU-O6WIFQ_nlqU6kI8feEldAGJ3WcUACCgpAPegX3O/exec';


// --- スプレッドシート本体のURL ---

/**
 * スタッフ情報が記載されているスプレッドシートのURL。
 * staff/page.tsx のヘッダークリックで開かれます。
 */
export const STAFF_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1ojkHXVYFyomm-2RMbWq6QrG4NPCit2y6lxXQFsK_J60/edit?usp=sharing'; // TODO: Replace with your actual Staff sheet URL

/**
 * 販売店情報が記載されているスプレッドシートのURL。
 * customers/page.tsx のヘッダークリックで開かれます。
 */
export const CUSTOMER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1ojkHXVYFyomm-2RMbWq6QrG4NPCit2y6lxXQFsK_J60/edit?usp=sharing';

/**
 * 受注情報が記載されているスプレッドシートのURL。
 * orders/page.tsx のヘッダークリックで開かれます。
 */
export const ORDER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Q3i81tz-j8GahLBRtdMJfnUjsx_VmM8fN7gn--j85JU/edit?usp=sharing';


// --- その他設定 ---

/**
 * スプレッドシートでステータスを管理している列のヘッダー名。
 */
export const STATUS_COLUMN_NAME = '受注ステータス';
```

---

## `src/app/actions/gas-actions.ts`

```typescript
'use server';

interface GasApiArgs {
    gasUrl: string;
    [key: string]: any;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    data?: any;
    eventId?: string;
}

async function callGasApi(args: GasApiArgs): Promise<GasResponse> {
    const { gasUrl, ...bodyPayload } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }

    try {
        console.log("Sending request to GAS with body:", bodyPayload);

        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyPayload),
            cache: 'no-store',
            redirect: 'follow',
        });
        
        console.log("GAS response status:", response.status);

        if (response.redirected && response.url.includes('accounts.google.com')) {
             throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GASへのリクエストに失敗しました。 Status: ${response.status}. Response: ${errorText}`);
        }

        const result = await response.json();
        console.log("GAS response:", result);
        
        if (result.status === 'error' || result.error) {
            const errorMessage = result.message || 'GASスクリプトでエラーが発生しました。';
            throw new Error(`GASスクリプトエラー: ${errorMessage}`);
        }

        return result;
    } catch (error: any) {
        console.error('Failed to call GAS API:', error);
        return {
            status: 'error',
            message: `GAS呼び出しに失敗しました: ${error.message}`,
        };
    }
}


export async function updateSheetStatus(args: {
    gasUrl: string;
    eventTitle?: string | null;
    staffName?: string | null;
    statusValue?: string | null;
    timestamp?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    actionType?: string | null;
    actionTimestamp?: string | null;
    scheduledTime?: string | null;
}): Promise<GasResponse> {
    return callGasApi(args);
}
```

---

## `src/components/dashboard/schedule-view.tsx`

```typescript
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
import { updateSheetStatus } from '@/app/actions/gas-actions';
import { ORDER_GAS_URL } from '@/lib/settings';

const PIXELS_PER_MINUTE = 1.5;
const timelineStartHour = 9;
const timelineEndHour = 19;
const timelineTotalHours = timelineEndHour - timelineStartHour;
const TRAVEL_TIME_MINUTES = 30;
const UNASSIGNED_TASKS_DROPPABLE_ID = 'unassigned-tasks-droppable-area';
const STAFF_COL_WIDTH = 144;
const STATUS_COL_WIDTH = 120;

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

function GenericTasks() {
    const getDraggableClassName = (task: Order) => {
        if (task.id === 'generic-travel') return 'bg-yellow-500 text-black';
        if (task.id === 'generic-work') return 'bg-gray-400 text-white';
        if (task.id === 'generic-break') return 'bg-green-500 text-white';
        return 'bg-primary text-primary-foreground';
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
  const [unassignedOrders, setUnassignedOrders] = React.useState<WithId<Order>[]>([]);

  const [dialogState, setDialogState] = React.useState<DialogState>({ mode: 'closed' });
  const [editedEventDetails, setEditedEventDetails] = React.useState<EditedEventDetails>({ title: '', description: '', startTime: '', endTime: '' });
  
  const dailySchedule = React.useMemo(() => {
      if (!scheduleEvents) return [];
      return scheduleEvents.filter(event => {
          const eventDate = typeof event.start === 'string' ? parseISO(event.start) : event.start;
          return isValid(eventDate) && isEqual(startOfDay(eventDate), startOfDay(currentDate));
      });
  }, [scheduleEvents, currentDate]);

  React.useEffect(() => {
    if (!rawOrdersData) return;
    
    const scheduledRawOrderIds = new Set(scheduleEvents.map(e => e.rawOrderId).filter(Boolean));
    
    const newUnassignedOrders = rawOrdersData.filter(order => {
        const staffName = findKey(order, ['担当']);
        const scheduledTime = findKey(order, ['チップ配置作業予定']);
        const orderId = findKey(order, ['受注 ID', '受注id', '受注ID', 'id']);
        
        if (scheduledRawOrderIds.has(orderId)) return false;
        
        const isAssigned = staffName && scheduledTime;
        if (isAssigned) return false;

        const workDate = findKey(order, ['作業予定日']);
        if (!workDate) return false;

        const scheduledDate = parseISO(workDate);
        return isValid(scheduledDate) && isEqual(startOfDay(scheduledDate), startOfDay(currentDate));
    }).map(mapRawToOrder);

    setUnassignedOrders(newUnassignedOrders);
  }, [rawOrdersData, currentDate, scheduleEvents]);

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
      
      setScheduleEvents(prev => prev.filter(e => e.tripId !== eventToUnassign.tripId));

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
      } catch(e: any) {
          console.error("Unassignment failed:", e);
          toast({ variant: 'destructive', title: '更新エラー', description: `シートの更新に失敗しました: ${e.message}` });
      } finally {
          await refetchOrders();
      }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const item = active.data.current as (WithId<Order> | WithId<ScheduleEvent>);

    setActiveItem(null);
    setCurrentOverStaffId(null);
    
    if (!item || !over) return;
    
    // --- Dropping back to unassigned area ---
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
    
    const newStart = getNewStartFromDrop();

    // --- Moving an existing event ---
    if ('staffId' in item) {
        const draggedEvent = item as WithId<ScheduleEvent>;
        
        // Optimistic UI update
        setScheduleEvents(prev => {
            const isTripEvent = !!draggedEvent.tripId;
            if (isTripEvent) {
                const tripEvents = prev.filter(e => e.tripId === draggedEvent.tripId);
                const taskEvent = tripEvents.find(e => e.id.endsWith('-task')) || draggedEvent;
                const travelEvent = tripEvents.find(e => e.id.endsWith('-travel'));
                
                const taskDuration = differenceInMinutes(parseISO(taskEvent.end as string), parseISO(taskEvent.start as string));
                const travelDuration = travelEvent ? differenceInMinutes(parseISO(travelEvent.end as string), parseISO(travelEvent.start as string)) : TRAVEL_TIME_MINUTES;

                let newTaskStart = newStart;
                if (draggedEvent.id.endsWith('-travel') && travelEvent) {
                    newTaskStart = addMinutes(newStart, travelDuration);
                }
                const newTaskEnd = addMinutes(newTaskStart, taskDuration);
                const newTravelStart = subMinutes(newTaskStart, travelDuration);
                
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

            } else { // Moving a generic event
                const duration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
                const newEnd = addMinutes(newStart, duration);
                return prev.map(e => e.id === draggedEvent.id ? { ...e, staffId: newStaffId, start: newStart.toISOString(), end: newEnd.toISOString() } : e);
            }
        });
        
        (async () => {
            try {
                if (draggedEvent.rawOrderId) {
                    let taskStart = newStart;
                    if(draggedEvent.id.endsWith('-travel')) {
                        const travelDuration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
                        taskStart = addMinutes(newStart, travelDuration);
                    }
                    const newStaff = getStaffById(newStaffId);
                    await updateSheetStatus({
                        gasUrl: ORDER_GAS_URL,
                        eventTitle: `(ID: ${draggedEvent.rawOrderId})`,
                        staffName: newStaff?.name,
                        scheduledTime: taskStart.toISOString(),
                    });
                }
                toast({ title: "スケジュールを更新しました" });
            } catch (e: any) {
                toast({ variant: 'destructive', title: '更新エラー', description: `スケジュールの更新に失敗しました: ${e.message}` });
            } finally {
                await refetchOrders();
            }
        })();
    
    } else if ('estimatedDuration' in item) {
        const order = item as WithId<Order>;
        const staff = getStaffById(newStaffId);
        if (!staff) return;

        const isGeneric = order.id.startsWith('generic-');
        
        if (isGeneric) {
             const newEvent: WithId<ScheduleEvent> = {
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
             const customer = getCustomerByCode(order.customerCode);
             const travelEvent: WithId<ScheduleEvent> = {
                id: `${tripId}-travel`, tripId,
                title: `移動: ${customer?.storeName || order.taskDetails.split('\n')[0]}`,
                staffId: newStaffId, locationId: customer?.id || '',
                start: subMinutes(newStart, TRAVEL_TIME_MINUTES).toISOString(), end: newStart.toISOString(),
                rawOrderId: order.rawOrderId,
             };
             const taskEvent: WithId<ScheduleEvent> = {
                id: `${tripId}-task`, tripId, orderId: order.id, rawOrderId: order.rawOrderId,
                title: order.taskDetails,
                staffId: newStaffId, locationId: customer?.id || '',
                start: newStart.toISOString(), end: addMinutes(newStart, order.estimatedDuration).toISOString(),
             };
             setScheduleEvents(prev => [...prev.filter(e => e.orderId !== order.id), travelEvent, taskEvent]);
             setUnassignedOrders(prev => prev.filter(o => o.id !== order.id));
        
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
      <TooltipProvider>
        <div className="relative">
          <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm -mx-4 sm:-mx-8 px-4 sm:px-8 py-4 mb-4 border-b">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="md:col-span-3">
                      <UnassignedTasks orders={unassignedOrders} customers={allCustomers || []} date={currentDate} />
                  </div>
                  <div className="md:col-span-2">
                      <GenericTasks />
                  </div>
              </div>
          </div>
          <Card className="pt-8">
              <CardHeader className='absolute top-0 left-6'>
                  <CardTitle>タイムライン</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                  <ScrollArea className="w-full whitespace-nowrap">
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
                            </div>
                            <div className="flex-shrink-0 font-semibold p-2" style={{ width: `${STATUS_COL_WIDTH}px`}}>ステータス</div>
                        </div>
                        <div className="relative mt-2 space-y-2">
                            {isToday(currentDate) && (
                            <div 
                                className="absolute top-0 h-full pointer-events-none z-[101]"
                                style={{ left: `${STAFF_COL_WIDTH}px`, width: `${timelineTotalHours * 60 * PIXELS_PER_MINUTE}px`}}
                            >
                                <TimeIndicator />
                            </div>
                            )}
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
                  </ScrollArea>
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
      </TooltipProvider>
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
```

---

## `src/app/check-in/page.tsx`

```typescript
'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, MapPin, AlertCircle, Loader2, PlayCircle, LogIn, LogOut, CheckCircle, MessageSquare, Send, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useUserProfile } from '@/hooks/use-user-profile';
import { updateSheetStatus } from '@/app/actions/update-sheet-status';
import { ORDER_GAS_URL, STATUS_COLUMN_NAME } from '@/lib/settings';
import type { StaffStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';

type ActionType = 'Clock In' | 'Clock Out' | 'Start Travel' | 'Arrive' | 'Begin Task' | 'Finish Task' | 'Wait' | 'Send Message';
type StatusValue = StaffStatus['status'];

function CheckInClient() {
  const [isLoading, setIsLoading] = React.useState<ActionType | null>(null);
  const [location, setLocation] = React.useState<{ latitude: number, longitude: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastAction, setLastAction] = React.useState<{ action: ActionType, time: string } | null>(null);
  const [message, setMessage] = React.useState('');
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');


  const getJapaneseActionName = (action: ActionType) => {
    const map: Record<ActionType, string> = {
        'Clock In': '出勤',
        'Clock Out': '退勤',
        'Start Travel': '移動開始',
        'Arrive': '現場到着',
        'Begin Task': '作業開始',
        'Finish Task': '作業終了',
        'Wait': '位置情報更新',
        'Send Message': 'メッセージ送信'
    };
    return map[action];
  };

  const handleAction = async (action: ActionType) => {
    setIsLoading(action);
    setError(null);
    const now = new Date();
    
    // Actions that don't require location or sheet updates
    if (action === 'Clock In' || action === 'Clock Out') {
        console.log(`Action: ${action}`);
        setTimeout(() => {
          const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          setLastAction({ action, time: currentTime });
          toast({
            title: 'アクションを記録しました',
            description: `${getJapaneseActionName(action)} at ${currentTime}`,
          });
          setIsLoading(null);
        }, 1000);
        return;
    }
    
    if (action === 'Send Message') {
        if (!message.trim()) {
            setError('メッセージを入力してください。');
            setIsLoading(null);
            return;
        }
        console.log(`Message to admin: ${message}`);
        setTimeout(() => {
          toast({
            title: 'メッセージを送信しました',
            description: '管理者にメッセージが送信されました。',
          });
          const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          setLastAction({ action: 'Send Message', time: currentTime });
          setMessage('');
          setIsLoading(null);
        }, 1000);
        return;
    }

    // Map actions to their corresponding status values for the sheet update
    const statusMap: Partial<Record<ActionType, StatusValue>> = {
      'Start Travel': '移動中',
      'Begin Task': '作業中',
      'Finish Task': '待機中',
      'Wait': '待機中',
      'Arrive': '作業待ち',
    };

    const statusValue = statusMap[action];
    
    if (!statusValue) {
        console.error("No status defined for this action:", action);
        setIsLoading(null);
        return;
    }

    if (!navigator.geolocation) {
      setError('お使いのブラウザは位置情報取得に対応していません。');
      setIsLoading(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });
        
        console.log(`Action: ${action}`, { latitude, longitude });
        
        if (!profile?.name) {
            setError('ユーザー情報が取得できません。ログインしているか確認してください。');
            setIsLoading(null);
            return;
        }

        try {
            const eventTitleForUpdate = `(ID: ${orderId || 'N/A'})`;
            const result = await updateSheetStatus({
                gasUrl: ORDER_GAS_URL,
                eventTitle: eventTitleForUpdate,
                staffName: profile.name,
                statusValue: statusValue,
                timestamp: now.toISOString(),
                latitude: latitude,
                longitude: longitude,
                actionType: action,
                actionTimestamp: now.toISOString()
            });

            if (result.status === 'error') {
                throw new Error(result.message);
            }

            toast({
                title: 'ステータスを更新しました',
                description: result.message,
            });

            const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            setLastAction({ action, time: currentTime });

        } catch (e: any) {
            setError(e.message || 'スプレッドシートの更新に失敗しました。');
            toast({
                variant: 'destructive',
                title: '更新エラー',
                description: e.message || 'スプレッドシートの更新に失敗しました。'
            });
        }
        
        setIsLoading(null);
      },
      (err) => {
        let message = '';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = '位置情報の利用が許可されていません。ブラウザの設定を確認してください。';
            break;
          case err.POSITION_UNAVAILABLE:
            message = '現在地の取得に失敗しました。';
            break;
          case err.TIMEOUT:
            message = '位置情報の取得がタイムアウトしました。';
            break;
          default:
            message = '不明なエラーが発生しました。';
            break;
        }
        setError(message);
        setIsLoading(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const actionButtons: { action: ActionType; label: string; icon: React.ElementType }[] = [
    { action: 'Clock In', label: '出勤', icon: LogIn },
    { action: 'Clock Out', label: '退勤', icon: LogOut },
    { action: 'Start Travel', label: '移動開始', icon: PlayCircle },
    { action: 'Arrive', label: '現場到着', icon: MapPin },
    { action: 'Begin Task', label: '作業開始', icon: Clock },
    { action: 'Finish Task', label: '作業終了', icon: CheckCircle },
    { action: 'Wait', label: '位置情報更新', icon: RefreshCw },
  ];

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>勤怠・作業記録</CardTitle>
          <CardDescription>現在地情報と共に、作業状況を記録します。対象のオーダーID: {orderId || '未選択'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {actionButtons.map(({ action, label, icon: Icon }) => (
              <Button
                key={action}
                size="lg"
                className={cn(
                  "h-20 text-base flex-col",
                  action === 'Wait' && "col-span-2"
                )}
                onClick={() => handleAction(action)}
                disabled={!!isLoading || (!orderId && !['Clock In', 'Clock Out', 'Send Message', 'Wait'].includes(action))}
              >
                {isLoading === action ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Icon className="h-6 w-6 mb-1" />
                    {label}
                  </>
                )}
              </Button>
            ))}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {!orderId && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>オーダーが選択されていません</AlertTitle>
              <AlertDescription>
                勤怠以外の記録を行うには、スケジュール画面からタスクを選択してください。
              </AlertDescription>
            </Alert>
          )}

          {lastAction && (
             <Alert>
              <MapPin className="h-4 w-4" />
              <AlertTitle>最後の記録</AlertTitle>
              <AlertDescription>
                {getJapaneseActionName(lastAction.action)} @ {lastAction.time}
                {location && !['Clock In', 'Clock Out', 'Send Message'].includes(lastAction.action) && <span className="text-xs block mt-1">({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})</span>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            管理者へ連絡
          </CardTitle>
          <CardDescription>緊急の連絡や報告がある場合に使用してください。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="メッセージを入力..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isLoading === 'Send Message'}
          />
          <Button
            className="w-full"
            onClick={() => handleAction('Send Message')}
            disabled={!!isLoading}
          >
            {isLoading === 'Send Message' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            メッセージ送信
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckInPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <CheckInClient />
        </Suspense>
    )
}
```

---

## Google Apps Script (GAS) `src/lib/gapps-script.js`

```javascript
// ↓↓↓↓【要設定】↓↓↓↓
// 「受注管理」シートがあるスプレッドシートのIDを貼り付けてください
const ORDER_SPREADSHEET_ID = "1Q3i81tz-j8GahLBRtdMJfnUjsx_VmM8fN7gn--j85JU"; 
const ORDER_SHEET_NAME = "受注管理"; 

// 「スタッフマスタ」シートがあるスプレッドシートのIDを貼り付けてください
const STAFF_SPREADSHEET_ID = "1ojkHXVYFyomm-2RMbWq6QrG4NPCit2y6lxXQFsK_J60";
const STAFF_SHEET_NAME = "スタッフマスタ";
// ↓↓↓↓【設定はここまで】↓↓↓↓


/**
 * GET リクエストを処理し、スプレッドシートのデータを JSON で返します
 */
function doGet(e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);
    if (!sheet) throw new Error(`シート '${ORDER_SHEET_NAME}' がスプレッドシートID '${ORDER_SPREADSHEET_ID}' 内に見つかりません。`);
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length < 1) {
       return ContentService.createTextOutput(JSON.stringify({ data: [] })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const headers = values.shift();
    const sheetId = sheet.getSheetId();
    const spreadsheetId = sheet.getParent().getId();

    const data = values.map((row, rowIndex) => {
      const obj = {};
      headers.forEach((header, index) => {
        const cellValue = row[index];
        // Check if the cell value is a valid Date object before calling toISOString
        if (cellValue && cellValue instanceof Date && !isNaN(cellValue)) {
          obj[header] = cellValue.toISOString();
        } else {
          obj[header] = cellValue;
        }
      });
      obj["Order_URL"] = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}&range=A${rowIndex + 2}`;
      return obj;
    });

    return ContentService.createTextOutput(JSON.stringify({ data: data })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error("GAS doGet Error:", error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `GAS doGet Error: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST リクエストを処理し、スプレッドシートを更新します
 */
function doPost(e) {
  try {
    console.log("doPost Request received:", JSON.stringify(e));
    
    let params;
    if (e.postData && e.postData.type === "application/json") {
      try {
        params = JSON.parse(e.postData.contents);
        console.log("JSON data parsed:", JSON.stringify(params));
      } catch (parseError) {
        console.error("JSON parse error:", parseError.message);
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "JSONデータの解析に失敗しました: " + parseError.message
        })).setMimeType(ContentService.MimeType.JSON);
      }
    } else {
      console.error("No JSON data received in request");
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "リクエストにJSONデータがありません"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (params.eventTitle) { // Update sheet from app
      return updateSheetWithOrderInfo(params);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "必要なパラメータ (eventTitle) がありません"
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    console.error("Error in doPost:", error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "エラーが発生しました: " + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 受注IDでシートを検索し、指定された情報で更新する
 */
function updateSheetWithOrderInfo(params) {
  const { 
      eventTitle, staffName, statusValue, timestamp, latitude, longitude, actionType, 
      actionTimestamp, scheduledTime
  } = params;

  try {
    console.log("Updating sheet with:", JSON.stringify(params));
    
    const match = eventTitle.match(/\(ID:\s*([\w-]+)\)/);
    if (!match || !match[1] || match[1].toUpperCase() === 'N/A') {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "汎用タスクまたはIDなしタスクのためシート更新はスキップされました。" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const orderId = match[1];
    console.log("Extracted order ID:", orderId);
    
    const orderSpreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
    const sheet = orderSpreadsheet.getSheetByName(ORDER_SHEET_NAME);
    if (!sheet) throw new Error(`シート「${ORDER_SHEET_NAME}」がスプレッドシートID '${ORDER_SPREADSHEET_ID}' 内に見つかりません。`);

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const orderIdCol = headers.indexOf("受注ID");
    if (orderIdCol === -1) throw new Error("スプレッドシートに「受注ID」列が見つかりません。");
    
    let rowNum = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][orderIdCol]) === String(orderId)) {
        rowNum = i + 1;
        break;
      }
    }
    if (rowNum === -1) {
      throw new Error(`指定された受注ID: ${orderId} がシートに見つかりませんでした。`);
    }
    
    console.log(`Updating row: ${rowNum}, ID: ${orderId}`);
    
    const updateColumn = (colName, value) => {
      if (value !== undefined) {
        const colIdx = headers.indexOf(colName);
        if (colIdx !== -1) {
          sheet.getRange(rowNum, colIdx + 1).setValue(value);
          console.log(`Updated column '${colName}' with value: ${value}`);
        }
      }
    };

    updateColumn("担当", staffName);
    updateColumn("受注ステータス", statusValue);
    updateColumn("最終更新日時", timestamp ? new Date(timestamp) : undefined);
    if(latitude !== undefined && longitude !== undefined) {
      updateColumn("最終位置情報（緯度,経度）", `${latitude}, ${longitude}`);
    }
    updateColumn("チップ配置作業予定", scheduledTime ? new Date(scheduledTime) : (scheduledTime === "" ? "" : undefined)); 
    
    if (actionType && actionTimestamp) {
        const dateValue = new Date(actionTimestamp);
        const actionColMap = {
            'Start Travel': "移動開始", 
            'Arrive': "現場到着",
            'Begin Task': "作業開始", 
            'Finish Task': "作業終了",
        };
        if(actionColMap[actionType]) {
            updateColumn(actionColMap[actionType], dateValue);
        }
    }
        
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: `受注ID: ${orderId} を更新しました。`,
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error("Error in updateSheetWithOrderInfo:", error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```
