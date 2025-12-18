'use client';

import * as React from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  DragOverlay,
  type Active,
  useDndContext,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { Staff, StaffStatus, WithId, Order, Customer, ScheduleEvent } from '../../lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { addMinutes, differenceInMinutes, format, parseISO, subMinutes, isToday, isValid, isEqual, startOfDay } from 'date-fns';
import { cn, findKey, formatTime, mapRawToOrder, getContrastingTextColor, darkenColor, lightenColor } from '../../lib/utils';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../ui/dialog";
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { useCustomer } from '../../contexts/customer-context';
import { useToast } from '../../hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { useOrder } from '../../contexts/order-context';
import { updateSheetStatus, sendIcsEmail } from '../../app/actions/gas-actions';
import { ORDER_GAS_URL } from '../../lib/settings';
import { Mail, Pencil } from 'lucide-react';
import { createContext, useContext } from 'react';
import { STORE_COLORS } from '../../lib/constants';

const PIXELS_PER_MINUTE = 1.5;
const timelineStartHour = 9;
const timelineEndHour = 19;
const timelineTotalHours = timelineEndHour - timelineStartHour;
const TRAVEL_TIME_MINUTES = 30;
const UNASSIGNED_TASKS_DROPPABLE_ID = 'unassigned-tasks-droppable-area';
const STAFF_COL_WIDTH = 144;
const STATUS_COL_WIDTH = 120;
const TOTAL_TIMELINE_WIDTH = STAFF_COL_WIDTH + timelineTotalHours * 60 * PIXELS_PER_MINUTE + STATUS_COL_WIDTH;

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

  const startOfTimelineDay = new Date(start);
  startOfTimelineDay.setHours(timelineStartHour, 0, 0, 0);

  const leftInMinutes = differenceInMinutes(start, startOfTimelineDay);
  const widthInMinutes = differenceInMinutes(end, start);

  return {
    left: minutesToPixels(leftInMinutes),
    width: minutesToPixels(widthInMinutes > 0 ? widthInMinutes : 30),
  };
};

interface OrderChipProps {
  order: WithId<Order>;
  customer?: WithId<Customer>;
  className?: string;
  style?: React.CSSProperties;
  isOverlay?: boolean;
}

const OrderChip: React.FC<OrderChipProps> = ({ order, className, style, isOverlay }) => {
  const [line1, line2] = order.taskDetails.split('\n');

  // Convert equipment status to symbol: 有→○, 無/空欄→×, △→△
  const getEquipmentSymbol = (status: string | undefined): string => {
    if (!status || status.trim() === '') return '×';
    if (status === '有' || status.includes('有')) return '○';
    if (status === '無' || status.includes('無')) return '×';
    if (status === '△' || status.includes('△')) return '△';
    return '×'; // Default to × for unknown values
  };

  const equipmentSymbol = getEquipmentSymbol(order.equipmentStatus);
  const scheduledTime = order.scheduledTime ? formatTime(order.scheduledTime) : '';

  // Format 本数 to include 本 suffix if not already present
  const formatHonsu = (honsu: string | number | undefined): string => {
    if (honsu === undefined || honsu === null || honsu === '') return '';
    const str = String(honsu).trim();
    if (str === '') return '';
    if (str.endsWith('本')) return str;
    return `${str}本`;
  };

  const tooltipContent = (
    <div className="space-y-1">
      <p className="font-bold">
        {order.customerName || line1}
        {!['移動', '業務', '休憩'].some(t => (line1 || '').includes(t)) && <span className="ml-1">({equipmentSymbol})</span>}
        {scheduledTime && <span className="ml-2">{scheduledTime}</span>}
      </p>
      {(order.tireSize || order['本数']) && (
        <p className="text-sm">
          {order.tireSize && <span>{order.tireSize}</span>}
          {order.tireSize && order['本数'] && <span className="mx-1"></span>}
          {order['本数'] && <span>{formatHonsu(order['本数'])}</span>}
        </p>
      )}
    </div>
  );

  const content = (
    <div style={style} className={cn("h-full min-h-[2.5rem] rounded-md px-1.5 py-1 flex flex-col justify-center cursor-move bg-primary text-primary-foreground text-[10px] leading-tight", className)}>
      {/* Row 1: StoreName(Equip) Time */}
      <div className="flex justify-between items-center w-full overflow-hidden">
        <span className="font-bold truncate mr-1 flex-1">
          {order.customerName || line1}
          {!['移動', '業務', '休憩'].some(t => (line1 || '').includes(t)) && `(${equipmentSymbol})`}
        </span>
        <span className="shrink-0 font-medium">{scheduledTime}</span>
      </div>

      {/* Row 2: TireSize Quantity (Only for non-generic tasks) */}
      {!['移動', '業務', '休憩'].some(t => (line1 || '').includes(t)) && (
        <div className="flex justify-start items-center gap-2 w-full overflow-hidden opacity-90 mt-0.5">
          <span className="truncate">{order.tireSize}</span>
          <span className="shrink-0">{formatHonsu(order['本数'])}</span>
        </div>
      )}
    </div>
  );

  if (isOverlay) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {content}
      </TooltipTrigger>
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
};


interface DraggableOrderProps {
  order: WithId<Order>;
  customer?: WithId<Customer>;
  className?: string;
  onDoubleClick?: () => void;
}

const DraggableOrder: React.FC<DraggableOrderProps> = ({ order, customer, className, onDoubleClick }) => {
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({
      id: `order-${order.id}`,
      data: order,
    });

  const style = {
    opacity: isDragging ? 0.5 : 1,
    width: `${minutesToPixels(order.estimatedDuration || 60)}px`,
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (onDoubleClick) {
      e.stopPropagation();
      onDoubleClick();
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onDoubleClick={handleDoubleClick}>
      <OrderChip order={order} className={className} />
    </div>
  );
};

type DialogState =
  | { mode: 'closed' }
  | { mode: 'edit'; event: WithId<ScheduleEvent> }
  | { mode: 'details'; event: WithId<ScheduleEvent> }
  | { mode: 'order-details'; order: WithId<Order> }
  | { mode: 'new'; staffId: string; start: Date };


type EditedEventDetails = {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
};

interface ScheduleViewProps {
  staffData: WithId<Staff>[];
  currentDate: Date;
  statuses: StaffStatus[];
  checkedOutStaffIds?: Set<string>;
}

const genericTasks: WithId<Order>[] = [
  { id: 'generic-travel', customerCode: '', taskDetails: '移動', estimatedDuration: 30, customerName: '', address: '', serviceType: '', status: '', scheduledDate: '', value: 0, raw: {} },
  { id: 'generic-work', customerCode: '', taskDetails: '業務', estimatedDuration: 60, customerName: '', address: '', serviceType: '', status: '', scheduledDate: '', value: 0, raw: {} },
  { id: 'generic-break', customerCode: '', taskDetails: '休憩', estimatedDuration: 60, customerName: '', address: '', serviceType: '', status: '', scheduledDate: '', value: 0, raw: {} },
];

function GenericTasks() {
  const getDraggableClassName = (task: Order) => {
    if (task.id === 'generic-travel') return 'bg-yellow-500 text-black';
    if (task.id === 'generic-work') return 'bg-gray-400 text-white';
    if (task.id === 'generic-break') return 'bg-green-500 text-white';
    return 'bg-primary text-primary-foreground';
  };

  return (
    <Card className="h-full border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">汎用タスク</CardTitle>
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

function UnassignedTasks({ orders, customers, date, onDoubleClickOrder }: { orders: WithId<Order>[], customers: WithId<Customer>[], date: Date, onDoubleClickOrder: (order: WithId<Order>) => void }) {
  const getCustomerByCode = (code: string | undefined): WithId<Customer> | undefined => customers?.find(c => c.userCode === code);
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_TASKS_DROPPABLE_ID });

  const titleText = isToday(date) ? '本日の受注タスク' : `${format(date, 'M/d')}の受注タスク`;

  const dailyOrders = orders.filter(order => {
    // Show undated tasks
    if (!order.scheduledDate) {
      return true;
    }
    const scheduledDate = parseISO(order.scheduledDate);
    if (!isValid(scheduledDate)) return true;

    // Show tasks scheduled for today
    if (isEqual(startOfDay(scheduledDate), startOfDay(date))) {
      return true;
    }

    return false;
  });

  return (
    <Card
      ref={setNodeRef}
      className={cn("transition-colors h-full border", isOver && "bg-primary/10")}
    >
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{titleText}</CardTitle>
        <CardDescription>下のタイムラインにタスクをドラッグして割り当てます。</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap h-32">
          <div className="pr-4 min-h-[6rem]">
            <div className="flex flex-wrap gap-2">
              {dailyOrders.map((order, index) => (
                <DraggableOrder
                  key={`${order.id}-${index}`}
                  order={order}
                  customer={getCustomerByCode(order.customerCode)}
                  onDoubleClick={() => onDoubleClickOrder(order)}
                />
              ))}
              {dailyOrders.length === 0 && (
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
      style={{ left: `${leftPosition}px`, zIndex: 101 }}
    >
      <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500"></div>
    </div>
  );
};

const RenderDragOverlay = () => {
  const { active } = useDndContext();
  const { getCustomerByCode, getStaffById } = useScheduleView();

  // Remove manual transform application as DragOverlay handles it
  // const style: React.CSSProperties = {
  //   transform: CSS.Translate.toString(delta),
  // };

  if (!active) return null;

  const activeItem = active.data.current;

  return (
    <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
      <div>
        {activeItem && 'estimatedDuration' in activeItem && !('staffId' in activeItem) ? (
          <OrderChip order={activeItem as WithId<Order>} style={{ width: `${minutesToPixels((activeItem as WithId<Order>).estimatedDuration || 60)}px` }} isOverlay={true} />
        ) : activeItem && 'staffId' in activeItem ? (
          (() => {
            const staff = getStaffById((activeItem as WithId<ScheduleEvent>).staffId);
            if (!staff) return null;
            return (
              <DraggableEvent
                event={activeItem as WithId<ScheduleEvent>}
                staff={staff}
                getCustomerByCode={getCustomerByCode}
                onDoubleClick={() => { }}
                isOverlay={true}
              />
            );
          })()
        ) : null}
      </div>
    </DragOverlay>
  );
}

interface ScheduleViewContextType {
  getCustomerByCode: (code: string | undefined) => WithId<Customer> | undefined;
  getStaffById: (id: string | undefined) => WithId<Staff> | undefined;
}

const ScheduleViewContext = createContext<ScheduleViewContextType | undefined>(undefined);

const useScheduleView = () => {
  const context = useContext(ScheduleViewContext);
  if (!context) {
    throw new Error('useScheduleView must be used within a ScheduleView');
  }
  return context;
}


export function ScheduleView({
  staffData,
  currentDate,
  statuses,
}: ScheduleViewProps) {

  const { customers: allCustomers } = useCustomer();
  const { toast } = useToast();
  const { refetchOrders, unassignedOrders, setUnassignedOrders, scheduleEvents, setScheduleEvents, saveLocalEvent } = useOrder();

  const [isClient, setIsClient] = React.useState(false);
  const [dialogState, setDialogState] = React.useState<DialogState>({ mode: 'closed' });
  const [editedEventDetails, setEditedEventDetails] = React.useState<EditedEventDetails>({ title: '', description: '', startTime: '', endTime: '' });
  const [active, setActive] = React.useState<Active | null>(null);

  const getCustomerByCode = (code: string | undefined): WithId<Customer> | undefined => allCustomers?.find(c => c.userCode === code);
  const getStaffById = (id: string | undefined): WithId<Staff> | undefined => staffData?.find(s => s.id === id);

  const dailySchedule = React.useMemo(() => {
    if (!scheduleEvents) return [];
    return scheduleEvents.filter(event => {
      const eventDate = typeof event.start === 'string' ? parseISO(event.start) : event.start;
      return isValid(eventDate) && isEqual(startOfDay(eventDate), startOfDay(currentDate));
    });
  }, [scheduleEvents, currentDate]);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActive(event.active);
  };

  // ... (lines 436-580 are mostly unchanged, just jumping to specific updates around line 590)

  // Wait, I can't use replace_file_content for non-contiguous blocks like this easily.
  // I need to use multi_replace for schedule-view.tsx.
  // The first chunk is adding saveLocalEvent to destructuring.
  // The second chunk is updating handleDragEnd to use saveLocalEvent.
  // The third chunk is fixing the icon logic.

  // Cancelling this tool call to use multi_replace.


  const unassignTask = async (eventToUnassign: WithId<ScheduleEvent>) => {
    if (!eventToUnassign.rawOrderId) return;

    const staff = getStaffById(eventToUnassign.staffId);
    if (!staff) {
      toast({ variant: 'destructive', title: 'エラー', description: '担当スタッフが見つかりません。' });
      return;
    }

    const previousSchedule = [...scheduleEvents];
    const orderToUnassign = mapRawToOrder(eventToUnassign.raw);

    // Optimistic UI update
    setScheduleEvents(prev => prev.filter(e => e.tripId !== eventToUnassign.tripId));
    setUnassignedOrders(prev => [...prev, orderToUnassign]);

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
    } catch (e: any) {
      console.error("Unassignment failed:", e);
      toast({ variant: 'destructive', title: '更新エラー', description: `シートの更新に失敗しました: ${e.message}` });
      // Revert UI on error
      setScheduleEvents(previousSchedule);
      setUnassignedOrders(prev => prev.filter(o => o.id !== orderToUnassign.id));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    setActive(null);

    if (!over) return;

    if (Math.abs(delta.x) < 5 && Math.abs(delta.y) < 5) {
      return;
    }

    const item = active.data.current as unknown as (WithId<Order> | WithId<ScheduleEvent>);

    const previousSchedule = [...scheduleEvents];
    const previousUnassigned = [...unassignedOrders];

    // --- Dropping back to unassigned area ---
    if (over.id === UNASSIGNED_TASKS_DROPPABLE_ID && 'staffId' in item) {
      if (item.rawOrderId) {
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
      if (!active.rect.current.translated) return new Date();
      const dropX = active.rect.current.translated.left - timelineRect.left;
      const newStartMinutes = pixelsToMinutes(dropX);
      return addMinutes(startOfTimelineDay, newStartMinutes);
    };

    const newStart = getNewStartFromDrop();

    // --- Moving an existing event ---
    if ('staffId' in item) {
      const draggedEvent = item as WithId<ScheduleEvent>;
      const newStaff = getStaffById(newStaffId);
      if (!newStaff) return;

      // Optimistic UI Update
      setScheduleEvents(prev => {
        const otherEvents = prev.filter(e => e.id !== draggedEvent.id && e.tripId !== draggedEvent.tripId);

        let eventsToUpdate: WithId<ScheduleEvent>[];
        if (draggedEvent.tripId) {
          eventsToUpdate = previousSchedule.filter(e => e.tripId === draggedEvent.tripId);
        } else {
          eventsToUpdate = [draggedEvent];
        }

        const taskEventInTrip = eventsToUpdate.find(e => e.id.endsWith('-task') || !e.tripId) || eventsToUpdate[0];
        const travelEventInTrip = eventsToUpdate.find(e => e.id.endsWith('-travel'));

        const taskDuration = differenceInMinutes(parseISO(taskEventInTrip.end as string), parseISO(taskEventInTrip.start as string));
        const travelDuration = travelEventInTrip ? differenceInMinutes(parseISO(travelEventInTrip.end as string), parseISO(travelEventInTrip.start as string)) : TRAVEL_TIME_MINUTES;

        let newTaskStart = newStart;
        if (draggedEvent.id.endsWith('-travel')) {
          newTaskStart = addMinutes(newStart, travelDuration);
        }
        const newTaskEnd = addMinutes(newTaskStart, taskDuration);
        const newTravelStart = subMinutes(newTaskStart, travelDuration);

        const updatedTripEvents: WithId<ScheduleEvent>[] = [];
        const updatedTask = { ...taskEventInTrip, staffId: newStaffId, start: newTaskStart.toISOString(), end: newTaskEnd.toISOString() };
        updatedTripEvents.push(updatedTask);
        if (travelEventInTrip) {
          const updatedTravel = { ...travelEventInTrip, staffId: newStaffId, start: newTravelStart.toISOString(), end: newTaskStart.toISOString() };
          updatedTripEvents.push(updatedTravel);
        }

        return [...otherEvents, ...updatedTripEvents];
      });

      // Backend Update
      (async () => {
        try {
          if (draggedEvent.id.startsWith('event-')) {
            const duration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
            const updatedEvent = {
              ...draggedEvent,
              staffId: newStaffId,
              start: newStart.toISOString(),
              end: addMinutes(newStart, duration).toISOString()
            };
            saveLocalEvent(updatedEvent);
            toast({ title: "スケジュールを更新しました" });
          } else if (draggedEvent.rawOrderId) {
            let taskStart = newStart;
            if (draggedEvent.id.endsWith('-travel')) {
              const travelDuration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
              taskStart = addMinutes(newStart, travelDuration);
            }
            await updateSheetStatus({
              gasUrl: ORDER_GAS_URL,
              eventTitle: `(ID: ${draggedEvent.rawOrderId})`,
              staffName: newStaff.name,
              scheduledTime: taskStart.toISOString(),
            });
            toast({ title: "スケジュールを更新しました" });
            await refetchOrders();
          }
        } catch (e: any) {
          toast({ variant: 'destructive', title: '更新エラー', description: `スケジュールの更新に失敗しました: ${e.message}` });
          setScheduleEvents(previousSchedule); // Revert on error
        }
      })();

    } else if ('estimatedDuration' in item) { // --- Creating a new event ---
      const order = item as WithId<Order>;
      const staff = getStaffById(newStaffId);
      if (!staff) return;

      const isGeneric = order.id.startsWith('generic-');

      const taskStart = getNewStartFromDrop();

      let newEvent: WithId<ScheduleEvent> | undefined;

      // Optimistic UI Update
      if (isGeneric) {
        newEvent = {
          id: `event-${Date.now()}`,
          title: order.taskDetails, description: '',
          staffId: newStaffId, locationId: '',
          start: taskStart.toISOString(),
          end: addMinutes(taskStart, order.estimatedDuration).toISOString(),
          raw: {},
          // Add missing Order fields
          customerCode: '',
          customerName: '',
          address: '',
          taskDetails: order.taskDetails,
          serviceType: '',
          status: '未割当',
          scheduledDate: '',
          estimatedDuration: order.estimatedDuration,
          value: 0,
          staffName: staff.name,
          equipmentStatus: '',
        };
        setScheduleEvents(prev => [...prev, newEvent!]);
      } else {
        const tripId = `trip-${order.rawOrderId}`;
        const customer = getCustomerByCode(order.customerCode);
        const travelEvent: WithId<ScheduleEvent> = {
          ...order, // Spread order properties
          id: `${tripId}-travel`, tripId,
          title: `移動: ${customer?.storeName || order.taskDetails.split('\n')[0]}`,
          staffId: newStaffId, locationId: customer?.userCode || '',
          start: subMinutes(taskStart, TRAVEL_TIME_MINUTES).toISOString(), end: taskStart.toISOString(),
          rawOrderId: order.rawOrderId, raw: order.raw,
        };
        const taskEvent: WithId<ScheduleEvent> = {
          ...order, // Spread order properties
          id: `${tripId}-task`, tripId,
          title: order.taskDetails,
          staffId: newStaffId, locationId: customer?.userCode || '',
          start: taskStart.toISOString(), end: addMinutes(taskStart, order.estimatedDuration).toISOString(),
          rawOrderId: order.rawOrderId, raw: order.raw,
        };
        setScheduleEvents(prev => [...prev.filter(e => e.rawOrderId !== order.rawOrderId), travelEvent, taskEvent]);
        setUnassignedOrders(prev => prev.filter(o => o.id !== order.id));
      }

      // Backend Update
      (async () => {
        try {
          if (isGeneric) {
            // Save to localStorage using the context method
            if (newEvent) saveLocalEvent(newEvent);
            toast({ title: "汎用タスクを追加しました" });
          } else {
            await updateSheetStatus({ gasUrl: ORDER_GAS_URL, eventTitle: `(ID: ${order.rawOrderId})`, staffName: staff.name, statusValue: '作業待ち', scheduledTime: taskStart.toISOString(), timestamp: new Date().toISOString() });
            await refetchOrders();

            const taskEvent = scheduleEvents.find(e => e.start === taskStart.toISOString() && e.staffId === newStaffId);
            if (taskEvent) setDialogState({ mode: 'details', event: taskEvent });

            toast({ title: "タスクを割り当てました。詳細を確認しメールを送信してください。" });
          }
        } catch (e: any) {
          toast({ variant: 'destructive', title: '割当エラー', description: `タスクの割り当てに失敗しました: ${e.message}` });
          setScheduleEvents(previousSchedule); // Revert UI
          setUnassignedOrders(previousUnassigned);
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
    if (event.rawOrderId) {
      setDialogState({ mode: 'details', event });
    } else {
      setDialogState({ mode: 'edit', event });
    }
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

  const handleSaveEvent = async (shouldSendEmail: boolean = false) => {
    if (dialogState.mode === 'closed') return;

    const newStart = timeStringToDate(editedEventDetails.startTime, currentDate);
    const newEnd = timeStringToDate(editedEventDetails.endTime, currentDate);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      toast({ variant: 'destructive', title: 'エラー', description: '無効な時間形式です。' });
      return;
    }

    try {
      if (dialogState.mode === 'new') {
        const staff = getStaffById(dialogState.staffId);
        if (!staff) throw new Error("担当スタッフが見つかりません。");

        const { title, description } = editedEventDetails;
        const newEvent: WithId<ScheduleEvent> = {
          id: `event-${Date.now()}`,
          title, description,
          staffId: dialogState.staffId, locationId: '',
          start: newStart.toISOString(),
          end: newEnd.toISOString(),
          raw: {},
          // Add missing Order fields
          customerCode: '',
          customerName: '',
          address: '',
          taskDetails: title,
          serviceType: '',
          status: '未割当',
          scheduledDate: '',
          estimatedDuration: (newEnd.getTime() - newStart.getTime()) / (1000 * 60),
          value: 0,
          staffName: staff.name,
          equipmentStatus: '',
        };
        setScheduleEvents(prev => [...prev, newEvent]);
      } else if (dialogState.mode === 'edit' || dialogState.mode === 'details') {
        const eventToUpdate = dialogState.event;
        const { title, description } = editedEventDetails;

        if (eventToUpdate.rawOrderId) { // Sheet-based event
          await updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            eventTitle: `(ID: ${eventToUpdate.rawOrderId})`,
            scheduledTime: newStart.toISOString(),
            scheduledEndTime: newEnd.toISOString(),
            timestamp: new Date().toISOString(),
          });
          await refetchOrders();

        } else { // Generic event (not from sheet)
          const updatedEvent = { ...eventToUpdate, title, description, start: newStart.toISOString(), end: newEnd.toISOString() };
          setScheduleEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
        }
      }
      toast({ title: '予定を保存しました' });

      if (shouldSendEmail) {
        let staffName = "";
        let staffEmail = "";
        let eventStart = "";
        let eventEnd = "";
        let location = "";

        if (dialogState.mode === 'new') {
          const staff = getStaffById(dialogState.staffId);
          staffName = staff?.name || "";
          staffEmail = staff?.email || "";
          eventStart = newStart.toISOString();
          eventEnd = newEnd.toISOString();
          location = ""; // New generic event no location
        } else if (dialogState.mode === 'edit') {
          const event = dialogState.event;
          const staff = getStaffById(event.staffId);
          staffName = staff?.name || "";
          staffEmail = staff?.email || "";
          eventStart = newStart.toISOString();
          eventEnd = newEnd.toISOString();
          location = getCustomerByCode(event.locationId)?.address || "";
        }

        if (staffName) {
          sendIcsEmail({
            gasUrl: ORDER_GAS_URL,
            staffName: staffName,
            staffEmail: staffEmail,
            title: editedEventDetails.title,
            description: editedEventDetails.description,
            startTime: eventStart,
            endTime: eventEnd,
            location: location,
            isUpdate: dialogState.mode === 'edit'
          }).then(result => {
            if (result.status === 'success') {
              toast({ title: 'メール送信成功', description: 'スタッフにメールを送信しました。' });
            } else {
              toast({ variant: 'destructive', title: 'メール送信エラー', description: result.message });
            }
          }).catch(e => {
            toast({ variant: 'destructive', title: 'メール送信エラー', description: e.message });
          });
        }
      }

      setDialogState({ mode: 'closed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '保存エラー', description: `更新に失敗しました: ${e.message}` });
    }
  };


  const handleDeleteEvent = async () => {
    if (dialogState.mode !== 'details' && dialogState.mode !== 'edit') return;
    const eventToDelete = dialogState.event;

    if (eventToDelete.rawOrderId) {
      await unassignTask(eventToDelete);
    } else {
      setScheduleEvents(prev => prev.filter(e => e.id !== eventToDelete.id));
      toast({ title: '予定を削除しました' });
    }

    setDialogState({ mode: 'closed' });
  };

  const handleSendIcs = async (event: WithId<ScheduleEvent>) => {
    const staff = getStaffById(event.staffId);
    if (!staff) {
      toast({ variant: 'destructive', title: 'エラー', description: '担当者が見つかりません。' });
      return;
    }
    try {
      const result = await sendIcsEmail({
        gasUrl: ORDER_GAS_URL,
        staffName: staff.name,
        staffEmail: staff.email || '',
        title: event.title,
        description: `顧客: ${findKey(event.raw, ['お取引先名', '店舗']) || 'N/A'}\n住所: ${findKey(event.raw, ['住所']) || 'N/A'}`,
        startTime: event.start as string,
        endTime: event.end as string,
        location: findKey(event.raw, ['住所']) || '',
        isUpdate: false,
      });
      if (result.status === 'error') throw new Error(result.message);

      toast({ title: 'メール送信成功', description: `${staff.name}にiCalメールを送信しました。` });
      setDialogState({ mode: 'closed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'メール送信エラー', description: e.message });
    }
  };

  const getDialogDetails = () => {
    if (dialogState.mode === 'details') {
      const { event } = dialogState;
      const staff = getStaffById(event.staffId);
      const customer = getCustomerByCode(event.locationId);
      return { event, staff, customer, title: '受注詳細' };
    }
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

  const renderDetailItem = (label: string, value: any) => (
    value ? <div className="text-sm"><span className="font-semibold text-muted-foreground">{label}:</span> {String(value)}</div> : null
  );

  const contextValue: ScheduleViewContextType = { getCustomerByCode, getStaffById };
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  if (!isClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>スケジュール</CardTitle>
          <CardDescription>各スタッフのタイムライン形式のスケジュールです。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64"><p>Loading schedule...</p></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScheduleViewContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >

        <TooltipProvider>
          <div className="space-y-1" style={{ maxWidth: `${TOTAL_TIMELINE_WIDTH + 2}px` }}>
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-20 py-1">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <div className="md:col-span-3">
                  <UnassignedTasks orders={unassignedOrders} customers={allCustomers || []} date={currentDate} onDoubleClickOrder={(order) => setDialogState({ mode: 'order-details', order })} />
                </div>
                <div className="md:col-span-2">
                  <GenericTasks />
                </div>
              </div>
            </div>

            <div>
              <div>
                <ScrollArea className="w-full border rounded-md h-[calc(100vh-200px)]">
                  <div className="relative" style={{ width: `${TOTAL_TIMELINE_WIDTH}px` }}>

                    {/* Header Row - Now inside ScrollArea for perfect alignment */}
                    <div className="sticky top-0 z-40 flex h-[34px] border-b bg-background/95 backdrop-blur-sm">
                      <div className="sticky left-0 z-50 flex-shrink-0 font-semibold p-2 border-r bg-background w-[144px]">スタッフ</div>
                      <div className="relative flex-1 h-full">
                        {Array.from({ length: timelineTotalHours + 1 }).map((_, i) => (
                          <div key={i} className="absolute h-full border-l" style={{ left: `${i * 60 * PIXELS_PER_MINUTE}px` }}>
                            <span className="absolute top-1 -translate-x-1/2 text-xs text-muted-foreground">{timelineStartHour + i}:00</span>
                          </div>
                        ))}
                      </div>
                      <div className="sticky right-0 z-50 flex-shrink-0 font-semibold p-2 border-l bg-background w-[120px]">ステータス</div>
                    </div>

                    <div className="relative space-y-2 pb-2">
                      {isToday(currentDate) && (
                        <div className="absolute top-0 h-full pointer-events-none z-10" style={{ left: `${STAFF_COL_WIDTH}px`, width: `${timelineTotalHours * 60 * PIXELS_PER_MINUTE}px` }}>
                          <TimeIndicator />
                        </div>
                      )}
                      {staffData?.map((staff) => {
                        const events = dailySchedule.filter((e) => e.staffId === staff.id);
                        const status = statuses.find(s => s.staffId === staff.id);
                        return (
                          <StaffRow key={staff.id} staff={staff} events={events} status={status} getCustomerByCode={getCustomerByCode} isOver={false} onDoubleClickEvent={handleDoubleClickEvent} onDoubleClickTimeline={handleDoubleClickTimeline} isToday={isToday(currentDate)} />
                        );
                      })}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

          <Dialog open={dialogState.mode !== 'closed'} onOpenChange={() => setDialogState({ mode: 'closed' })}>
            <DialogContent className={cn(dialogState.mode === 'details' && "max-w-xl")}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {dialogState.mode === 'details' ? '受注詳細' : dialogState.mode === 'edit' ? '予定の編集' : dialogState.mode === 'order-details' ? '未割当オーダー詳細' : '新規予定の作成'}
                  {(dialogState.mode === 'details') && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                      if (dialogState.mode === 'details') {
                        setDialogState({ mode: 'edit', event: dialogState.event })
                      }
                    }
                    }>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {dialogState.mode === 'details' ? 'スプレッドシートから取得した受注の詳細情報です。' :
                    dialogState.mode === 'edit' ? '予定の詳細を編集または削除します。' :
                      dialogState.mode === 'order-details' ? '未割当オーダーの詳細情報です。' : '新しい予定の詳細を入力してください。'
                  }
                </DialogDescription>
              </DialogHeader>
              {(dialogState.mode === 'details' || dialogState.mode === 'edit') && event ? (
                <>
                  <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    {/* Details section */}
                    {dialogState.mode === 'details' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 p-1">
                        {renderDetailItem('担当者', staff?.name)}
                        {renderDetailItem('お取引先名', findKey(event.raw, ['お取引先名', '店舗']))}
                        {renderDetailItem('機材有無', findKey(event.raw, ['機材有無']))}
                        {renderDetailItem('作業予定日', findKey(event.raw, ['作業予定日']))}
                        {renderDetailItem('予定時間', formatTime(findKey(event.raw, ['予定時間', 'チップ配置作業予定'])))}
                        {renderDetailItem('車名', findKey(event.raw, ['車名']))}
                        {renderDetailItem('登録ナンバー(下４桁)', findKey(event.raw, ['登録ナンバー(下４桁)']))}
                        {renderDetailItem('入庫状況', findKey(event.raw, ['入庫状況']))}
                        {renderDetailItem('タイヤ品番', findKey(event.raw, ['タイヤ品番']))}
                        {renderDetailItem('タイヤサイズ', findKey(event.raw, ['タイヤサイズ']))}
                        {renderDetailItem('品名', findKey(event.raw, ['品名']))}
                        {renderDetailItem('作業内容', findKey(event.raw, ['作業内容']))}
                        {renderDetailItem('本数', findKey(event.raw, ['本数']))}
                        {renderDetailItem('空気圧センサーパッキン交換', findKey(event.raw, ['空気圧センサーパッキン交換']))}
                        {renderDetailItem('タイヤ手配状況', findKey(event.raw, ['タイヤ手配状況']))}
                        {renderDetailItem('廃タイヤ処分', findKey(event.raw, ['廃タイヤ処分']))}
                      </div>
                    )}

                    {/* Edit form */}
                    <div className="grid gap-4 pt-4 border-t">
                      <div className="text-sm"><p><span className="font-semibold text-muted-foreground">担当:</span> {staff?.name}</p></div>
                      {!event.rawOrderId && (
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="title" className="text-right">タスク名</Label>
                          <Input id="title" value={editedEventDetails.title} onChange={(e) => setEditedEventDetails(prev => ({ ...prev, title: e.target.value }))} className="col-span-3" placeholder="例：定期メンテナンス" />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="start-time">開始時間</Label>
                          <Input id="start-time" type="time" value={editedEventDetails.startTime} onChange={(e) => setEditedEventDetails(prev => ({ ...prev, startTime: e.target.value }))} />
                        </div>
                        <div>
                          <Label htmlFor="end-time">終了時間</Label>
                          <Input id="end-time" type="time" value={editedEventDetails.endTime} onChange={(e) => setEditedEventDetails(prev => ({ ...prev, endTime: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="sm:justify-between pt-4 border-t">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => handleSaveEvent(true)}>
                        <Mail className="mr-2 h-4 w-4" />
                        保存して送信
                      </Button>
                      <Button variant="destructive" onClick={handleDeleteEvent}>未割当に戻す</Button>
                    </div>
                    <div className='flex gap-2 mt-4 sm:mt-0'>
                      <DialogClose asChild><Button variant="ghost">キャンセル</Button></DialogClose>
                      <Button onClick={() => handleSaveEvent(false)}>保存</Button>
                    </div>
                  </DialogFooter>
                </>
              ) : (dialogState.mode === 'new') ? (
                <>
                  <div className="grid gap-4 py-4">
                    <div className="text-sm"><p><span className="font-semibold text-muted-foreground">担当:</span> {staff?.name}</p></div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="title" className="text-right">タスク名</Label>
                      <Input id="title" value={editedEventDetails.title} onChange={(e) => setEditedEventDetails(prev => ({ ...prev, title: e.target.value }))} className="col-span-3" placeholder="例：定期メンテナンス" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="description" className="text-right">詳細</Label>
                      <Textarea id="description" value={editedEventDetails.description} onChange={(e) => setEditedEventDetails(prev => ({ ...prev, description: e.target.value }))} className="col-span-3" placeholder="予定の詳細やメモ" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start-time">開始時間</Label>
                        <Input id="start-time" type="time" value={editedEventDetails.startTime} onChange={(e) => setEditedEventDetails(prev => ({ ...prev, startTime: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="end-time">終了時間</Label>
                        <Input id="end-time" type="time" value={editedEventDetails.endTime} onChange={(e) => setEditedEventDetails(prev => ({ ...prev, endTime: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="sm:justify-between">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => handleSaveEvent(true)}>
                        <Mail className="mr-2 h-4 w-4" />
                        保存して送信
                      </Button>
                    </div>
                    <div className="flex gap-2 mt-4 sm:mt-0">
                      <DialogClose asChild><Button variant="ghost">キャンセル</Button></DialogClose>
                      <Button onClick={() => handleSaveEvent(false)}>保存</Button>
                    </div>
                  </DialogFooter>
                </>
              ) : (dialogState.mode === 'order-details') ? (
                <>
                  <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 p-1">
                      {renderDetailItem('受注ID', dialogState.order.id)}
                      {renderDetailItem('お取引先名', findKey(dialogState.order.raw, ['お取引先名', '店舗']))}
                      {renderDetailItem('機材有無', findKey(dialogState.order.raw, ['機材有無']))}
                      {renderDetailItem('作業予定日', findKey(dialogState.order.raw, ['作業予定日']))}
                      {renderDetailItem('予定時間', formatTime(findKey(dialogState.order.raw, ['予定時間', 'チップ配置作業予定'])))}
                      {renderDetailItem('車名', findKey(dialogState.order.raw, ['車名']))}
                      {renderDetailItem('登録ナンバー', findKey(dialogState.order.raw, ['登録ナンバー(下４桁)']))}
                      {renderDetailItem('入庫状況', findKey(dialogState.order.raw, ['入庫状況']))}
                      {renderDetailItem('タイヤ品番', findKey(dialogState.order.raw, ['タイヤ品番']))}
                      {renderDetailItem('タイヤサイズ', findKey(dialogState.order.raw, ['タイヤサイズ']))}
                      {renderDetailItem('品名', findKey(dialogState.order.raw, ['品名']))}
                      {renderDetailItem('作業内容', findKey(dialogState.order.raw, ['作業内容']))}
                      {renderDetailItem('本数', findKey(dialogState.order.raw, ['本数']))}
                      {renderDetailItem('タイヤ手配状況', findKey(dialogState.order.raw, ['タイヤ手配状況']))}
                      {renderDetailItem('廃タイヤ処分', findKey(dialogState.order.raw, ['廃タイヤ処分']))}
                    </div>
                  </div>
                  <DialogFooter className="sm:justify-between">
                    <div className="flex gap-2"></div>
                    <DialogClose asChild><Button variant="ghost">閉じる</Button></DialogClose>
                  </DialogFooter>
                </>
              ) : null}
            </DialogContent>
          </Dialog>
          <RenderDragOverlay />
        </TooltipProvider>
      </DndContext>
    </ScheduleViewContext.Provider >
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
  isToday: boolean;
}

const StaffRow: React.FC<StaffRowProps> = ({ staff, events, status, getCustomerByCode, isOver, onDoubleClickEvent, onDoubleClickTimeline, isToday }) => {
  const { setNodeRef } = useDroppable({ id: staff.id });
  const areaBgClass = staff['母店'] ? STORE_COLORS[staff['母店']] || 'bg-background' : 'bg-background';

  return (
    <div className={cn("flex relative h-14 border-b", areaBgClass)}>
      <div className={cn("sticky left-0 z-20 flex-shrink-0 px-2 flex items-center border-r bg-inherit w-[144px]")}>
        <div className="font-semibold flex items-center gap-2 w-full truncate">
          <div className='w-2 h-8 rounded-full' style={{ backgroundColor: staff.color }}></div>
          <span className='truncate flex-1'>{staff.name}</span>
        </div>
      </div>
      <div id={`staff-row-${staff.id}`} ref={setNodeRef} className={cn("relative flex-1 h-full", isOver && "bg-primary/10")} onDoubleClick={(e) => onDoubleClickTimeline(staff.id, e)}>
        <div className="absolute top-0 left-0 h-full w-full">
          {events.map((event) => (<DraggableEvent key={event.id} event={event} staff={staff} getCustomerByCode={getCustomerByCode} onDoubleClick={() => onDoubleClickEvent(event)} />))}
        </div>
      </div>
      <div className={cn("sticky right-0 z-20 flex-shrink-0 px-2 flex items-center justify-center border-l bg-inherit w-[120px]")}>
        {status && isToday && (<div className="text-xs text-center font-medium">{status.status}</div>)}
      </div>
    </div>
  )
};

interface DraggableEventProps {
  event: WithId<ScheduleEvent>;
  staff: WithId<Staff>;
  getCustomerByCode: (code: string | undefined) => WithId<Customer> | undefined;
  onDoubleClick: () => void;
  isOverlay?: boolean;
}

const DraggableEvent: React.FC<DraggableEventProps> = ({ event, staff, getCustomerByCode, onDoubleClick, isOverlay }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: event.id, data: event });
  const { left, width } = getEventDimensions(event.start, event.end);

  const style: React.CSSProperties = isOverlay ?
    {} :
    {
      left: `${left}px`,
      width: `${width}px`,
      opacity: isDragging ? 0 : 1,
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 50,
    };

  const handleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); onDoubleClick(); };

  const isTravelEvent = event.title?.startsWith('移動');

  const divStyle: React.CSSProperties = { backgroundColor: staff.color || 'hsl(var(--primary))' };

  let textColorClass = getContrastingTextColor(staff.color || 'hsl(var(--primary))') === '#FFFFFF' ? 'text-white' : 'text-black';

  if (isTravelEvent) {
    // Lighten the staff color to make it look "thinner" or "mixed with white"
    const lightenedColor = lightenColor(staff.color || 'hsl(var(--primary))', 0.6);
    divStyle.backgroundColor = lightenedColor;
    // Recalculate contrast for the new light background (likely needs black text)
    textColorClass = getContrastingTextColor(lightenedColor) === '#FFFFFF' ? 'text-white' : 'text-black';
  }

  if (event.title === '業務') {
    divStyle.backgroundColor = 'rgb(156 163 175)';
    textColorClass = 'text-white';
  } else if (event.title === '休憩') {
    divStyle.backgroundColor = 'rgb(34 197 94)';
    textColorClass = 'text-white';
  }

  const [line1, ...rest] = (event.title || '').split('\n');
  const line2 = rest.join('\n');
  const customer = event.locationId ? getCustomerByCode(event.locationId) : undefined;

  // Get equipment status and other details from raw order data
  const getEquipmentSymbol = (status: string | undefined): string => {
    if (!status || status.trim() === '') return '×';
    if (status === '有' || status.includes('有')) return '○';
    if (status === '無' || status.includes('無')) return '×';
    if (status === '△' || status.includes('△')) return '△';
    return '×';
  };

  const formatHonsu = (honsu: string | number | undefined): string => {
    if (honsu === undefined || honsu === null || honsu === '') return '';
    const str = String(honsu).trim();
    if (str === '') return '';
    if (str.endsWith('本')) return str;
    return `${str}本`;
  };

  const equipmentStatus = event.raw ? findKey(event.raw, ['機材有無']) : undefined;
  const equipmentSymbol = getEquipmentSymbol(equipmentStatus);
  const tireSize = event.raw ? findKey(event.raw, ['タイヤサイズ', 'サイズ', 'タイヤ']) : undefined;
  const honsu = event.raw ? findKey(event.raw, ['本数', 'honsu']) : undefined;
  const customerName = event.raw ? findKey(event.raw, ['お取引先名', '店舗', '取引先']) : (customer?.storeName || line1);

  const eventContent = (
    <div
      className={cn("w-full h-full rounded-md flex flex-col justify-center p-1", textColorClass, isDragging && !isOverlay && "opacity-50")}
      style={{ ...divStyle, width: isOverlay ? `${width}px` : '100%' }}
    >
      <p className="text-xs font-semibold truncate pointer-events-none">{customerName || line1}</p>
      <p className="text-xs opacity-80 truncate pointer-events-none">{formatTime(event.start)}</p>
    </div>
  );

  const tooltipContent = (
    <div className="space-y-1">
      <p className="font-bold">
        {customerName || line1}
        {(!isTravelEvent && !['移動', '業務', '休憩'].some(t => (event.title || '').includes(t))) && <span className="ml-1">({equipmentSymbol})</span>}
        <span className="ml-2">{formatTime(event.start)}</span>
      </p>
      {!isTravelEvent && (tireSize || honsu) && (
        <p className="text-sm">
          {tireSize && <span>{tireSize}</span>}
          {tireSize && honsu && <span className="mx-1"></span>}
          {honsu && <span>{formatHonsu(honsu)}</span>}
        </p>
      )}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={handleDoubleClick}
      className={cn("rounded-md flex flex-col justify-center cursor-move h-12", isOverlay ? 'shadow-lg' : '')}
      data-event-chip="true"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          {eventContent}
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltipContent}</TooltipContent>
      </Tooltip>
    </div>
  );
};
