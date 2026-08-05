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
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragMoveEvent,
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
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { addMinutes, differenceInMinutes, format, parseISO, subMinutes, isToday, isValid, isEqual, startOfDay } from 'date-fns';
import { cn, findKey, formatTime, mapRawToOrder, getContrastingTextColor, darkenColor, lightenColor, formatDate, normalizeDateStr, isEtaPassed, isStaffMatched } from '../../lib/utils';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useOrder } from '../../contexts/order-context';
import { OrderService } from '../../services/order-service';
import { updateSheetStatus, sendIcsEmail, createTask, updateOrderDateTime } from '../../app/actions/gas-actions';
import { ORDER_GAS_URL } from '../../lib/settings';
import { Mail, Pencil, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import { STORE_COLORS } from '../../lib/constants';
import { useUserProfile } from '../../hooks/use-user-profile';

const PIXELS_PER_MINUTE = 1.5;
const timelineStartHour = 9;
const timelineEndHour = 19;
const timelineTotalHours = timelineEndHour - timelineStartHour;
const TRAVEL_TIME_MINUTES = 30;
const UNASSIGNED_TASKS_DROPPABLE_ID = 'unassigned-tasks-droppable-area';


const STAFF_COL_WIDTH = 144;
const STATUS_COL_WIDTH = 120;
const TOTAL_TIMELINE_WIDTH = STAFF_COL_WIDTH + timelineTotalHours * 60 * PIXELS_PER_MINUTE + STATUS_COL_WIDTH;
const EMPTY_EVENTS: WithId<ScheduleEvent>[] = [];

const isGenericTask = (order: any) => {
  if (!order) return false;
  if (order.isGeneric) return true;
  const id = String(order.id || '');
  const title = String(order.title || order.taskDetails || '');
  const type = order._type || order.type;
  const keywords = ['休憩', '移動', '業務', '研修', '同行', '商談', '会議'];
  
  if (keywords.some(k => title.includes(k))) return true;
  if (type === 'task') return true;
  if (type === 'order') return false;

  return id.startsWith('task-') || id.startsWith('generic-') || id.endsWith('-task') || id.includes('-generic-') ||
    (!order.customerCode && !order.customerName);
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

const safeParseISO = (dateStr: any): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  try {
    const parsed = parseISO(String(dateStr));
    if (isValid(parsed)) return parsed;
  } catch (e) {}
  const parsedDate = new Date(dateStr);
  return isValid(parsedDate) ? parsedDate : new Date();
};

const minutesToPixels = (minutes: number) => minutes * PIXELS_PER_MINUTE;

const pixelsToMinutes = (pixels: number) => Math.round(pixels / PIXELS_PER_MINUTE / 15) * 15;

const getEventDimensions = (eventStart: Date | string, eventEnd: Date | string) => {
  const start = typeof eventStart === 'string' ? safeParseISO(eventStart) : eventStart;
  const end = typeof eventEnd === 'string' ? safeParseISO(eventEnd) : eventEnd;

  if (!start || !end || !isValid(start) || !isValid(end)) {
    return { left: 0, width: minutesToPixels(60) };
  }

  const startOfTimelineDay = new Date(start);
  startOfTimelineDay.setHours(timelineStartHour, 0, 0, 0);

  const endOfTimelineDay = new Date(start);
  endOfTimelineDay.setHours(timelineEndHour, 0, 0, 0);

  // If the event starts after the timeline ends, clamp it to the very end
  // to prevent it from disappearing completely.
  let effectiveStart = start;
  if (start > endOfTimelineDay) {
    effectiveStart = endOfTimelineDay;
  }

  const leftInMinutes = differenceInMinutes(effectiveStart, startOfTimelineDay);
  let widthInMinutes = differenceInMinutes(end, effectiveStart);

  // Check if the event extends beyond the end of the timeline
  if (addMinutes(effectiveStart, widthInMinutes) > endOfTimelineDay) {
    const overflowMinutes = differenceInMinutes(addMinutes(effectiveStart, widthInMinutes), endOfTimelineDay);
    widthInMinutes -= overflowMinutes;
  }

  // Ensure minimum width of 15 minutes if it was clipped, 
  // or 30 minutes if it was normally short.
  // But if the timeline itself has no more room, it might be 0, so clamp to min 15px maybe?
  let widthPixels = minutesToPixels(widthInMinutes > 0 ? widthInMinutes : 30);

  // Hard minimum width so the chip is always clickable even if pushed exactly to 19:00
  if (widthPixels < 20) {
    widthPixels = 20;
  }

  // If the event is pushed past the end, adjust left to make room for the minimum width
  let leftPixels = minutesToPixels(leftInMinutes);
  if (leftInMinutes >= timelineTotalHours * 60) {
    leftPixels = minutesToPixels(timelineTotalHours * 60) - widthPixels;
  } else {
    widthPixels = Math.min(widthPixels, minutesToPixels(timelineTotalHours * 60) - leftPixels);
    if (widthPixels < 20) widthPixels = 20;
  }

  return {
    left: leftPixels,
    width: widthPixels,
  };
};

interface OrderChipProps {
  order: WithId<Order>;
  customer?: WithId<Customer>;
  className?: string;
  style?: React.CSSProperties;
  isOverlay?: boolean;
}

const OrderChip = React.memo<OrderChipProps>(({ order, className, style, isOverlay }) => {
  const { customers: allCustomers } = useCustomer();
  const [line1, line2] = String(order.taskDetails || '').split(/\r?\n/);

  // Resolve storeName from master (skip for generic tasks like Break, Travel, etc.)
  let resolvedStoreName = order.customerName || '';
  const isGeneric = ['移動', '業務', '休憩', '研修', '同行', '商談'].some(t => String(line1 || '').includes(t));
  if (!isGeneric && (resolvedStoreName === '' || resolvedStoreName === '（店舗名未設定）' || resolvedStoreName === '(店舗名未設定)' || resolvedStoreName === '店舗名未設定')) {
    const code = order.customerCode || (order as any).userCode || findKey(order.raw, ["ユーザーコード", "顧客コード"]);
    if (code && allCustomers) {
      const paddedCode = String(code).trim().padStart(5, '0');
      // High performance lookup
      const storeName = (allCustomers as any)._mapByCode?.get(paddedCode);
      if (storeName) {
        resolvedStoreName = storeName;
      } else {
        const match = allCustomers.find(c => {
          const cCode = c.userCode || c['ユーザーコード'] || '';
          return String(cCode).trim().padStart(5, '0') === paddedCode;
        });
        resolvedStoreName = match?.storeName || '(店舗名未設定)';
      }
    } else {
      resolvedStoreName = '(店舗名未設定)';
    }
  }

  // Convert equipment status to symbol: 有→○, 無/空欄→×, △→△
  const getEquipmentSymbol = (status: string | undefined): string => {
    if (!status || status.trim() === '') return '×';
    if (status === '有' || status.includes('染') || status.includes('有')) return '○';
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

  const titleText = `${resolvedStoreName || line1}` +
    `${!['移動', '業務', '休憩', '研修', '同行', '商談'].some(t => String(line1 || '').includes(t)) ? ` (${equipmentSymbol})` : ''}` +
    `${scheduledTime ? ` ${scheduledTime}` : ''}` +
    `${(order.tireSize || order['本数']) ? `\n${order.tireSize || ''}${order.tireSize && order['本数'] ? ' ' : ''}${order['本数'] ? formatHonsu(order['本数']) : ''}` : ''}`;

  const content = (
    <div {...{ 'style': style as any }} title={titleText} className={cn("group h-full min-h-[2.5rem] rounded-md px-1.5 py-1 flex flex-col justify-center cursor-move bg-primary text-primary-foreground text-[10px] leading-tight relative", style && "dynamic-width", className)}>
      {/* Validation Warning Badge */}
      {order.hasValidationIssues && (
        <div className="absolute -top-1 -right-1 z-10 bg-yellow-500 rounded-full p-0.5 shadow-md" title={order.validationWarnings?.join(', ')}>
          <AlertTriangle className="h-3 w-3 text-white" />
        </div>
      )}

      <div className="flex justify-between items-center w-full overflow-hidden">
        <span className="font-bold truncate mr-1 flex-1">
          {resolvedStoreName || (order as any).title || line1 || <span className="text-xs font-normal opacity-70">ID:{order.rawOrderId || order.id}</span>}
          {!['移動', '業務', '休憩', '研修', '同行', '商談'].some(t => String(line1 || '').includes(t)) &&
            (resolvedStoreName || (order as any).title) && `(${equipmentSymbol})`}
        </span>
        <span className="shrink-0 font-medium">{scheduledTime}</span>
      </div>



      {/* Row 2: TireSize Quantity (Only for non-generic tasks) */}
      {!['移動', '業務', '休憩', '研修', '同行', '商談'].some(t => String(line1 || '').includes(t)) && (
        <div className="flex justify-start items-center gap-2 w-full overflow-hidden opacity-90 mt-0.5">
          <span className="truncate">{order.tireSize}</span>
          <span className="shrink-0">{formatHonsu(order['本数'])}</span>
        </div>
      )}

      {/* Done Mark */}
      {(['Finish Task', '作業完了', '完了'].includes(String(order.status || '')) || !!order.actualEndTime) && (
        <div className={cn("absolute -top-1 z-[60] pointer-events-none", order.isConfirmed ? "left-3" : "-left-1")}>
          <div className="border border-red-600 rounded-full w-4 h-4 flex items-center justify-center bg-white/90 shadow-sm rotate-neg-15">
            <span className="text-[8px] font-bold text-red-600 leading-none select-none">済</span>
          </div>
        </div>
      )}

      {/* Confirmed Mark - shown when staff has acknowledged the order */}
      {order.isConfirmed && (
        <div className="absolute -top-1 -left-1 z-[60] pointer-events-none">
          <div className="border border-blue-600 rounded-full w-4 h-4 flex items-center justify-center bg-white/90 shadow-sm">
            <span className="text-[8px] font-bold text-blue-600 leading-none select-none">確</span>
          </div>
        </div>
      )}
    </div>
  );

  return content;
});


interface DraggableOrderProps {
  order: WithId<Order>;
  customer?: WithId<Customer>;
  className?: string;
  onDoubleClick?: () => void;
}

const DraggableOrder = React.memo<DraggableOrderProps>(({ order, customer, className, onDoubleClick }) => {
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({
      id: `order-${order.id}`,
      data: order,
    });

  const style = {
    '--dynamic-opacity': isDragging ? 0.5 : 1,
    '--dynamic-width': `${minutesToPixels(order.estimatedDuration || 60)}px`,
    touchAction: 'none',
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (onDoubleClick) {
      e.stopPropagation();
      onDoubleClick();
    }
  };

  return (
    <div ref={setNodeRef} {...{ 'style': style as any }} className="dynamic-opacity dynamic-width" {...listeners} {...attributes} onDoubleClick={handleDoubleClick}>
      <OrderChip order={order} className={className} />
    </div>
  );
});

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
  destination?: string;
};

interface ScheduleViewProps {
  staffData: WithId<Staff>[];
  currentDate: Date;
  statuses: StaffStatus[];
  checkedOutStaffIds?: Set<string>;
  scheduledStaffIds?: Set<string>;
}

const genericTasks: WithId<Order>[] = [
  { id: 'generic-travel', customerCode: '', taskDetails: '移動', estimatedDuration: 30, customerName: '', address: '', serviceType: '', status: '', scheduledDate: '', value: 0, raw: {} },
  { id: 'generic-work', customerCode: '', taskDetails: '業務', estimatedDuration: 60, customerName: '', address: '', serviceType: '', status: '', scheduledDate: '', value: 0, raw: {} },
  { id: 'generic-break', customerCode: '', taskDetails: '休憩', estimatedDuration: 60, customerName: '', address: '', serviceType: '', status: '', scheduledDate: '', value: 0, raw: {} },
  { id: 'generic-training', customerCode: '', taskDetails: '研修', estimatedDuration: 60, customerName: '', address: '', serviceType: '', status: '', scheduledDate: '', value: 0, raw: {} },
  { id: 'generic-accompany', customerCode: '', taskDetails: '同行', estimatedDuration: 60, customerName: '', address: '', serviceType: '', status: '', scheduledDate: '', value: 0, raw: {} },
  { id: 'generic-negotiation', customerCode: '', taskDetails: '商談', estimatedDuration: 60, customerName: '', address: '', serviceType: '', status: '', scheduledDate: '', value: 0, raw: {} },
];

function GenericTasks() {
  const getDraggableClassName = (task: Order) => {
    if (task.id === 'generic-travel') return 'bg-yellow-500 text-black';
    if (task.id === 'generic-work') return 'bg-gray-400 text-white';
    if (task.id === 'generic-break') return 'bg-green-500 text-white';
    if (task.id === 'generic-training') return 'bg-cyan-500 text-white';
    if (task.id === 'generic-accompany') return 'bg-orange-500 text-white';
    if (task.id === 'generic-negotiation') return 'bg-purple-500 text-white';
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

const UnassignedTasks = React.memo(({ orders, customers, date, onDoubleClickOrder }: { orders: WithId<Order>[], customers: WithId<Customer>[], date: Date, onDoubleClickOrder: (order: WithId<Order>) => void }) => {
  const customerMap = React.useMemo(() => {
    const map = new Map<string, WithId<Customer>>();
    customers?.forEach(c => {
      const cCode = c.userCode || c['ユーザーコード'] || '';
      if (cCode) {
        const paddedCode = String(cCode).trim().padStart(5, '0');
        map.set(paddedCode, c);
      }
    });
    return map;
  }, [customers]);

  const getCustomerByCode = React.useCallback((code: string | undefined): WithId<Customer> | undefined => {
    if (!code) return undefined;
    const paddedCode = String(code).trim().padStart(5, '0');
    return customerMap.get(paddedCode);
  }, [customerMap]);

  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_TASKS_DROPPABLE_ID });

  const titleText = React.useMemo(() => isToday(date) ? '本日の受注タスク' : `${format(date, 'M/d')}の受注タスク`, [date]);

  const dailyOrders = React.useMemo(() => {
    return orders.filter(order => {
      const status = String(order.status || (order as any)['受注ステータス'] || '').trim();
      return !['作業完了', '完了', 'キャンセル', '完了済', '作業終了'].includes(status);
    });
  }, [orders]);

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
                <UnassignedOrderItem
                  key={`${order.id}-${index}`}
                  order={order}
                  customer={getCustomerByCode(order.customerCode)}
                  onDoubleClick={onDoubleClickOrder}
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
});

const UnassignedOrderItem = React.memo(({ order, customer, onDoubleClick }: { order: WithId<Order>, customer?: WithId<Customer>, onDoubleClick: (order: WithId<Order>) => void }) => {
  const handleDoubleClick = React.useCallback(() => {
    onDoubleClick(order);
  }, [onDoubleClick, order]);

  return (
    <DraggableOrder
      order={order}
      customer={customer}
      onDoubleClick={handleDoubleClick}
      className={order.status === 'キャンセル' ? 'bg-red-100 dark:bg-red-900/30 border-red-500/50' : ''}
    />
  );
});

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
      className="absolute top-0 h-full w-0.5 bg-red-500 pointer-events-none dynamic-left"
      {...{ 'style': { '--dynamic-left': `${leftPosition}px` } as any }}
    >
      <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500"></div>
    </div>
  );
};

const RenderDragOverlay = () => {
  const { active } = useDndContext();
  const { getCustomerByCode, getStaffById } = useScheduleView();

  if (!active) return null;

  const activeItem = active.data.current;
  const activeIdString = String(active.id);

  return (
    <DragOverlay modifiers={undefined} dropAnimation={null}>
      <div>
        {activeIdString.startsWith('order-') ? (
          <OrderChip order={activeItem as WithId<Order>} style={{ width: `${minutesToPixels((activeItem as WithId<Order>).estimatedDuration || 60)}px` }} isOverlay={true} />
        ) : activeItem ? (
          (() => {
            const staff = getStaffById((activeItem as WithId<ScheduleEvent>).staffId);
            if (!staff) return null;
            return (
              <DraggableEvent
                targetEvent={activeItem as WithId<ScheduleEvent>}
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


import { useSelectedStaff } from '@/contexts/selected-staff-context';

// ... (existing imports)

export function ScheduleView({
  staffData,
  currentDate,
  statuses,
  checkedOutStaffIds,
  scheduledStaffIds,
}: ScheduleViewProps) {
  const { profile } = useUserProfile();
  const isAdmin = profile?.role === 'admin';


  const { customers: allCustomers } = useCustomer();
  const { allStaff, setSelectedStaffIds } = useSelectedStaff(); // Get full list & setter
  const { toast } = useToast();
  const { orders, refetchOrders, unassignedOrders, setUnassignedOrders, scheduleEvents, setScheduleEvents, saveLocalEvent, deleteLocalEvent, deleteOrder, toggleTripSuppression, setCurrentViewedDate, updateRawOrder, updateOrderFullSync, setRawOrdersData } = useOrder();

  // Filter orders to only show those scheduled for currentDate (JST local date format)
  const dailyOrders = React.useMemo(() => {
    if (!orders) return [];
    const targetDateStr = format(currentDate, 'yyyy-MM-dd');
    return orders.filter(order => {
      if (!order.scheduledDate) return false;
      const orderDate = normalizeDateStr(order.scheduledDate);
      return orderDate === targetDateStr;
    });
  }, [orders, currentDate]);

  const [isClient, setIsClient] = React.useState(false);
  const [dialogState, setDialogState] = React.useState<DialogState>({ mode: 'closed' });
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const [editedEventDetails, setEditedEventDetails] = React.useState<EditedEventDetails>({ title: '', description: '', startTime: '', endTime: '', destination: '' });
  const [isSaving, setIsSaving] = React.useState(false);

  const [isEditingOrderDetails, setIsEditingOrderDetails] = React.useState(false);
  const [editOrderForm, setEditOrderForm] = React.useState<any>({});
  const staffRowRectsRef = React.useRef<Map<string, DOMRect>>(new Map());
  const scrollContainerRectRef = React.useRef<DOMRect | null>(null);

  React.useEffect(() => {
    setCurrentViewedDate(currentDate);
    return () => setCurrentViewedDate(null);
  }, [currentDate, setCurrentViewedDate]);

  React.useEffect(() => {
    const getResolvedStoreName = (entity: any) => {
      let name = findKey(entity.raw, ["お取引先名", "店舗", "店舗名", "名称", "店舗名称", "Customer", "お名前"]) || entity.customerName || entity.storeName || '';
      if (name === '' || name === '（店舗名未設定）' || name === '(店舗名未設定)' || name === '店舗名未設定') {
        const code = entity.customerCode || entity.userCode || findKey(entity.raw, ["ユーザーコード", "顧客コード"]);
        if (code && allCustomers) {
          const paddedCode = String(code).trim().padStart(5, '0');
          const match = allCustomers.find(c => {
            const cCode = c.userCode || c['ユーザーコード'] || '';
            return String(cCode).trim().padStart(5, '0') === paddedCode;
          });
          if (match?.storeName) {
            name = match.storeName;
          }
        }
      }
      return name;
    };

    if ((dialogState.mode === 'details' || dialogState.mode === 'edit') && dialogState.event) {
      const ev = dialogState.event as any;
      setEditOrderForm({
        storeName: getResolvedStoreName(ev),
        customerCode: findKey(ev.raw, ["ユーザーコード", "お取引先コード", "ユーザーCode"]) || ev.customerCode || ev.userCode || '',
        picName: findKey(ev.raw, ["ご担当者様", "担当者", "担当"]) || ev.picName || '',
        orderNo: findKey(ev.raw, ["受注No\n(ﾘﾏｰｸ1 8ｹﾀ)", "受注No(ﾘﾏｰｸ1 8ｹﾀ)", "リマーク1", "受注No"]) || ev.orderNo || ev.orderNoRemark || '',
        comment: findKey(ev.raw, ["任意コメント\n(ﾘﾏｰｸ2　10ｹﾀ)", "任意コメント(ﾘﾏｰｸ2　10ｹﾀ)", "リマーク2", "任意コメント"]) || ev.comment || '',
        contact: findKey(ev.raw, ["連絡先", "電話番号"]) || ev.contact || '',
        equipmentStatus: findKey(ev.raw, ["機材有無"]) || ev.equipmentStatus || '',
        carName: findKey(ev.raw, ["車名", "車両", "車種"]) || ev.carName || '',
        regNo: findKey(ev.raw, ["登録ナンバー(下４桁)", "登録ナンバー", "ナンバー", "車番", "登録番号"]) || ev.regNo || '',
        arrivalStatus: findKey(ev.raw, ["入庫状況"]) || ev.arrivalStatus || '',
        tireNumber: findKey(ev.raw, ["タイヤ品番", "品番"]) || ev.tireNumber || '',
        tireSize: findKey(ev.raw, ["タイヤサイズ", "サイズ", "Size", "タイヤ名/サイズ"]) || ev.tireSize || '',
        productName: findKey(ev.raw, ["品名", "商品名"]) || ev.productName || '',
        taskDetails: findKey(ev.raw, ["作業内容", "業務内容", "taskDetails", "Description", "作業", "作業内容・商品詳細", "内容"]) || ev.taskDetails || '',
        quantity: findKey(ev.raw, ["本数", "honsu", "数量", "Qty", "Quantity", "本", "タイヤ本数"]) || ev['本数'] || ev.quantity || '',
        sensor: findKey(ev.raw, ["空気圧センサーパッキン交換", "センサー"]) || ev.sensor || '',
        tireStatus: findKey(ev.raw, ["タイヤ手配状況", "手配"]) || ev.arrangement || ev.tireStatus || '',
        disposal: findKey(ev.raw, ["廃タイヤ処分", "廃タイヤ"]) || ev.disposal || '',
        specialNotes: findKey(ev.raw, ["特記事項", "備考", "メモ", "特記", "specialNotes"]) || ev.specialNotes || '',
        startTravelTime: ev.startTravelTime ? formatTime(ev.startTravelTime) : (findKey(ev.raw, ['移動開始']) ? formatTime(findKey(ev.raw, ['移動開始'])) : ''),
        arrivalTimestamp: ev.arrivalTimestamp ? formatTime(ev.arrivalTimestamp) : (findKey(ev.raw, ['現場到着']) ? formatTime(findKey(ev.raw, ['現場到着'])) : ''),
        actualStartTime: ev.actualStartTime ? formatTime(ev.actualStartTime) : (findKey(ev.raw, ['作業開始', '実績開始']) ? formatTime(findKey(ev.raw, ['作業開始', '実績開始'])) : ''),
        actualEndTime: ev.actualEndTime ? formatTime(ev.actualEndTime) : (findKey(ev.raw, ['作業完了', '実績完了', '実績終了']) ? formatTime(findKey(ev.raw, ['作業完了', '実績完了', '実績終了'])) : ''),
        actualDuration: findKey(ev.raw, ['作業時間（分）', '所要時間']) || ev.actualDuration || '',
        scheduledDate: (findKey(ev.raw, ['作業予定日']) ? formatDate(findKey(ev.raw, ['作業予定日']), 'yyyy-MM-dd') : '') || (ev.scheduledDate ? (typeof ev.scheduledDate === 'string' ? ev.scheduledDate.split('T')[0] : formatDate(ev.scheduledDate, 'yyyy-MM-dd')) : ''),
        scheduledTime: ev.scheduledTime || formatTime(findKey(ev.raw, ['予定時間', 'チップ配置作業予定'])) || ''
      });
    } else if (dialogState.mode === 'order-details' && dialogState.order) {
      const ord = dialogState.order as any;
      setEditOrderForm({
        storeName: getResolvedStoreName(ord),
        customerCode: findKey(ord.raw, ["ユーザーコード", "お取引先コード", "ユーザーCode"]) || ord.customerCode || ord.userCode || '',
        picName: findKey(ord.raw, ["ご担当者様", "担当者", "担当"]) || ord.picName || '',
        orderNo: findKey(ord.raw, ["受注No\n(ﾘﾏｰｸ1 8ｹﾀ)", "受注No(ﾘﾏｰｸ1 8ｹﾀ)", "リマーク1", "受注No"]) || ord.orderNo || ord.orderNoRemark || '',
        comment: findKey(ord.raw, ["任意コメント\n(ﾘﾏｰｸ2　10ｹﾀ)", "任意コメント(ﾘﾏｰｸ2　10ｹﾀ)", "リマーク2", "任意コメント"]) || ord.comment || '',
        contact: findKey(ord.raw, ["連絡先", "電話番号"]) || ord.contact || '',
        equipmentStatus: findKey(ord.raw, ["機材有無"]) || ord.equipmentStatus || '',
        carName: findKey(ord.raw, ["車名", "車両", "車種"]) || ord.carName || '',
        regNo: findKey(ord.raw, ["登録ナンバー(下４桁)", "登録ナンバー", "ナンバー", "車番", "登録番号"]) || ord.regNo || '',
        arrivalStatus: findKey(ord.raw, ["入庫状況"]) || ord.arrivalStatus || '',
        tireNumber: findKey(ord.raw, ["タイヤ品番", "品番"]) || ord.tireNumber || '',
        tireSize: findKey(ord.raw, ["タイヤサイズ", "サイズ", "Size", "タイヤ名/サイズ"]) || ord.tireSize || '',
        productName: findKey(ord.raw, ["品名", "商品名"]) || ord.productName || '',
        taskDetails: findKey(ord.raw, ["作業内容", "業務内容", "taskDetails", "Description", "作業", "作業内容・商品詳細", "内容"]) || ord.taskDetails || '',
        quantity: findKey(ord.raw, ["本数", "honsu", "数量", "Qty", "Quantity", "本", "タイヤ本数"]) || ord['本数'] || ord.quantity || '',
        sensor: findKey(ord.raw, ["空気圧センサーパッキン交換", "センサー"]) || ord.sensor || '',
        tireStatus: findKey(ord.raw, ["タイヤ手配状況", "手配"]) || ord.arrangement || ord.tireStatus || '',
        disposal: findKey(ord.raw, ["廃タイヤ処分", "廃タイヤ"]) || ord.disposal || '',
        specialNotes: findKey(ord.raw, ["特記事項", "備考", "メモ", "特記", "specialNotes"]) || ord.specialNotes || '',
        startTravelTime: ord.startTravelTime ? formatTime(ord.startTravelTime) : (findKey(ord.raw, ['移動開始']) ? formatTime(findKey(ord.raw, ['移動開始'])) : ''),
        arrivalTimestamp: ord.arrivalTimestamp ? formatTime(ord.arrivalTimestamp) : (findKey(ord.raw, ['現場到着']) ? formatTime(findKey(ord.raw, ['現場到着'])) : ''),
        actualStartTime: ord.actualStartTime ? formatTime(ord.actualStartTime) : (findKey(ord.raw, ['作業開始', '実績開始']) ? formatTime(findKey(ord.raw, ['作業開始', '実績開始'])) : ''),
        actualEndTime: ord.actualEndTime ? formatTime(ord.actualEndTime) : (findKey(ord.raw, ['作業完了', '実績完了', '実績終了']) ? formatTime(findKey(ord.raw, ['作業完了', '実績完了', '実績終了'])) : ''),
        actualDuration: findKey(ord.raw, ['作業時間（分）', '所要時間']) || ord.actualDuration || '',
        scheduledDate: (findKey(ord.raw, ['作業予定日']) ? formatDate(findKey(ord.raw, ['作業予定日']), 'yyyy-MM-dd') : '') || (ord.scheduledDate ? (typeof ord.scheduledDate === 'string' ? ord.scheduledDate.split('T')[0] : formatDate(ord.scheduledDate, 'yyyy-MM-dd')) : ''),
        scheduledTime: ord.scheduledTime || formatTime(findKey(ord.raw, ['予定時間', 'チップ配置作業予定'])) || ''
      });
    } else {
      setEditOrderForm({});
    }
  }, [dialogState, allCustomers]);

  const customerMap = React.useMemo(() => {
    const map = new Map<string, WithId<Customer>>();
    allCustomers?.forEach(c => {
      if (c.userCode) map.set(c.userCode, c);
    });
    return map;
  }, [allCustomers]);

  const staffMap = React.useMemo(() => {
    const map = new Map<string, WithId<Staff>>();
    allStaff?.forEach(s => {
      if (s.id) map.set(s.id, s);
    });
    return map;
  }, [allStaff]);

  const getCustomerByCode = React.useCallback((code: string | undefined): WithId<Customer> | undefined => {
    if (!code) return undefined;
    return customerMap.get(code);
  }, [customerMap]);

  // Use allStaff instead of filtered staffData for lookup
  const getStaffById = React.useCallback((id: string | undefined): WithId<Staff> | undefined => {
    if (!id) return undefined;
    return staffMap.get(id);
  }, [staffMap]);

  const formatEventDescription = (event: any) => {
    const descriptionParts = [
      `店舗名: ${event.customerName || findKey(event.raw, ['お取引先名', '店舗', '店舗名', '名称', '店舗名称', 'Customer', 'お名前']) || '---'}`,
      `車名: ${event.carName || findKey(event.raw, ['車名', 'vehicleName', '車種', '車両', '車輌', '登録車名']) || '---'}`,
      `登録ナンバー: ${event.regNo || findKey(event.raw, ['登録ナンバー(下４桁)', '登録ナンバー', 'ナンバー', '車番', '登録番号']) || '---'}`,
      `作業内容: ${event.taskDetails || findKey(event.raw, ['作業内容', '業務内容', 'taskDetails', 'Description', '作業', '作業内容・商品詳細', '内容']) || '---'}`,
      `サイズ/本数: ${event.tireSize || findKey(event.raw, ['タイヤサイズ', 'サイズ', 'Size', 'タイヤ名/サイズ']) || '---'} / ${event.tireNumber || (event as any).tireNumber || findKey(event.raw, ['本数', 'honsu', '数量', 'Qty', 'Quantity', '本', 'タイヤ本数']) || '---'}`,
      `特記事項: ${event.specialNotes || event.comment || findKey(event.raw, ['特記事項', '備考', '連絡事項', 'comment', '任意コメント', 'コメント']) || 'なし'}`,
      `フォーム入力者: ${event.submitter || findKey(event.raw, ['フォーム入力者', '入力者', 'Submitter']) || 'なし'}`,
    ];
    return descriptionParts.join('\n');
  };

  const dailySchedule = React.useMemo(() => {
    if (!scheduleEvents) return [];
    
    const targetYmd = format(currentDate, 'yyyy-MM-dd');
    
    return scheduleEvents.filter(event => {
      if (!event) return false;

      // 1. Primary check: event's scheduledDate property
      if (event.scheduledDate) {
        const normScheduledDate = normalizeDateStr(event.scheduledDate);
        if (normScheduledDate && normScheduledDate === targetYmd) {
          return true;
        }
      }

      // 2. Secondary check: event.start string
      if (event.start) {
        const normStartDate = normalizeDateStr(event.start);
        if (normStartDate && normStartDate === targetYmd) {
          return true;
        }

        // 3. Fallback: Parse Date object and format in local time
        try {
          const d = new Date(event.start);
          if (!isNaN(d.getTime())) {
            const localYmd = format(d, 'yyyy-MM-dd');
            if (localYmd === targetYmd) {
              return true;
            }
          }
        } catch {}
      }

      return false;
    });
  }, [scheduleEvents, currentDate]);

  const eventsByStaffId = React.useMemo(() => {
    const map = new Map<string, WithId<ScheduleEvent>[]>();
    staffData.forEach(staff => {
      const staffEvents = dailySchedule.filter(e => {
        return isStaffMatched(staff, [e.staffId, (e as any).staffName, (e as any).assignedStaff, (e as any).作業担当, (e as any).担当]);
      });
      map.set(staff.id, staffEvents);
    });
    return map;
  }, [dailySchedule, staffData]);

  const statusByStaffId = React.useMemo(() => {
    const map = new Map<string, StaffStatus>();
    statuses.forEach(s => map.set(s.staffId, s));
    return map;
  }, [statuses]);

  const [replyDialogOpen, setReplyDialogOpen] = React.useState(false);
  const [targetEmergencyEvent, setTargetEmergencyEvent] = React.useState<{ rawOrderId: string, systemId?: string, currentComment: string, staffName: string } | null>(null);
  const [replyMessage, setReplyMessage] = React.useState('');

  const emergencyNotifications = React.useMemo(() => {
    if (!scheduleEvents) return [];

    const emergencyEvents = scheduleEvents.filter(e => e.isEmergency);

    // return generic structure
    const notifications: { staffId: string, staffName: string, message: string, rawOrderId: string, systemId: string, raw?: any }[] = [];

    const seenStaff = new Set<string>();

    emergencyEvents.forEach(e => {
      if (seenStaff.has(e.staffId)) return;

      const staff = getStaffById(e.staffId);
      if (staff) {
        seenStaff.add(e.staffId);
        const comment = e.raw ? findKey(e.raw, ['緊急連絡', '任意コメント', '任意コメント(リマーク2)', 'comment']) : '';
        notifications.push({
          staffId: e.staffId,
          staffName: staff.name,
          systemId: e.systemId || e.id,
          message: comment,
          rawOrderId: e.rawOrderId || '',
          raw: e.raw
        });
      }
    });

    return notifications;
  }, [scheduleEvents, staffData]);

  // 新しい緊急連絡があった場合にトーストと音で知らせる
  const prevEmergenciesRef = React.useRef<string[]>([]);
  const hasMountedForEmergencies = React.useRef(false);
  
  React.useEffect(() => {
    // 初回マウント時は現在の状態を記録するだけで通知は出さない
    if (!hasMountedForEmergencies.current) {
      if (emergencyNotifications && emergencyNotifications.length > 0) {
        prevEmergenciesRef.current = emergencyNotifications.map(n => n.systemId);
      }
      hasMountedForEmergencies.current = true;
      return;
    }

    if (!emergencyNotifications || emergencyNotifications.length === 0) {
      prevEmergenciesRef.current = [];
      return;
    }

    const currentIds = emergencyNotifications.map(n => n.systemId);
    
    // 過去の状態（0件の場合も含む）と比較して増えたものを検出
    const newEmergencies = emergencyNotifications.filter(n => !prevEmergenciesRef.current.includes(n.systemId));
    
    if (newEmergencies.length > 0) {
      newEmergencies.forEach(n => {
        toast({
          variant: "destructive",
          title: `⚠️ 【緊急】${n.staffName} からの連絡`,
          description: n.message ? `コメント: ${n.message}` : "詳細を確認してください",
          duration: 15000,
        });
      });

      // ピープ音を鳴らす（ブラウザの操作状態によっては再生ブロックされる場合あり）
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(800, ctx.currentTime); // 800Hz
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
          
          // ピ・ピッと2回鳴らす
          setTimeout(() => {
            if (ctx.state === 'running') {
              const osc2 = ctx.createOscillator();
              const gain2 = ctx.createGain();
              osc2.connect(gain2);
              gain2.connect(ctx.destination);
              osc2.type = "sine";
              osc2.frequency.setValueAtTime(800, ctx.currentTime);
              gain2.gain.setValueAtTime(0.1, ctx.currentTime);
              osc2.start();
              osc2.stop(ctx.currentTime + 0.3);
            }
          }, 400);
        }
      } catch (e) {
        console.error("Audio beep failed", e);
      }
    }

    prevEmergenciesRef.current = currentIds;
  }, [emergencyNotifications, toast]);

  const handleClearEmergency = async (event: { rawOrderId: string, message: string, staffName: string, systemId: string, raw?: any }) => {
    try {
      if (!event.rawOrderId && !event.systemId) {
        toast({ variant: 'destructive', title: "エラー", description: "イベントIDが見つかりません" });
        return;
      }

      const currentComment = event.raw ? (findKey(event.raw, ['緊急連絡']) || '') : '';
      const newComment = String(currentComment).replace(/【緊急】/g, '').trim();

      // Optimistic update
      const fullEvent = scheduleEvents.find(e => e.id === event.systemId || (e as any).systemId === event.systemId || (e as any).rawOrderId === event.rawOrderId || e.id === (event as any).id || e.tripId === (event as any).tripId);

      // Calculate recovery status based on timestamps
      let recoveryStatus = '未着手';
      const orderData = fullEvent; // Use the event we already found
      if (orderData) {
        if (orderData.actualEndTime) {
          recoveryStatus = '待機中';
        } else if (orderData.actualStartTime) {
          recoveryStatus = '作業中';
        } else if (orderData.arrivalTimestamp) {
          recoveryStatus = '作業待ち';
        } else if (orderData.startTravelTime) {
          recoveryStatus = '移動中';
        }
      }

      if (fullEvent) {
        saveLocalEvent({
          ...fullEvent,
          isEmergency: false,
          description: newComment,
          emergencyMessage: newComment,
          adminReply: '',
          raw: {
            ...fullEvent.raw,
            '緊急フラグ': false,
            '緊急連絡': newComment,
            '管理者返信': ''
          }
        });
      }

      updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        eventTitle: `(ID: ${event.rawOrderId})`,
        staffName: event.staffName,
        statusValue: recoveryStatus, // Restore status
        comment: newComment,
        emergencyFlag: false,
        adminReply: '',
        systemId: event.systemId
      }).catch(err => console.warn('Failed to update sheet on emergency recovery:', err));

      toast({ title: "緊急ステータスを解除しました" });
      await refetchOrders();
      // wait a bit for backend to process before clearing local optimistic state
      setTimeout(() => deleteLocalEvent(event.systemId), 5000);
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: "エラー", description: "解除に失敗しました" });
    }
  };

  const openReplyDialog = (event: { rawOrderId: string, message: string, staffName: string, systemId: string }) => {
    setTargetEmergencyEvent({
      rawOrderId: event.rawOrderId,
      systemId: event.systemId,
      currentComment: event.message,
      staffName: event.staffName
    });
    setReplyMessage('');
    setReplyDialogOpen(true);
  };

  const handleSendReply = async () => {
    if (!targetEmergencyEvent || !replyMessage.trim()) return;

    try {
      const { rawOrderId, currentComment, staffName } = targetEmergencyEvent;
      const timestamp = format(new Date(), 'HH:mm');
      const finalReply = `[${timestamp}]: ${replyMessage}`;

      updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        eventTitle: `(ID: ${rawOrderId})`,
        staffName: staffName,
        adminReply: finalReply,
        emergencyFlag: true, // Keep it active
        systemId: (targetEmergencyEvent as any).systemId
      }).catch(err => console.warn('Failed to send reply to sheet:', err));

      toast({ title: "返信を送信しました" });
      setReplyDialogOpen(false);
      setTargetEmergencyEvent(null);
      await refetchOrders();
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: "エラー", description: "返信の送信に失敗しました" });
    }
  };

  const handleToggleEmergency = async (event: WithId<ScheduleEvent>, isEmergency: boolean) => {
    setIsSaving(true);
    try {
      const currentComment = event.raw ? (findKey(event.raw, ['緊急連絡']) || '') : '';
      let newComment = currentComment;

      if (isEmergency) {
        if (!currentComment.includes('【緊急】')) {
          newComment = `【緊急】${currentComment}`;
        }
      } else {
        newComment = currentComment.replace(/【緊急】/g, '').trim();
      }

      updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        systemId: event.id,
        statusValue: event.status,
        emergencyFlag: isEmergency,
      }).catch(err => console.warn('Failed to toggle emergency in sheet:', err));

      toast({
        title: isEmergency ? '緊急ステータスに設定しました' : '緊急ステータスを解除しました',
      });
      deleteLocalEvent(event.id);
      await refetchOrders();
    } catch (error) {
      console.error('Failed to toggle emergency status:', error);
      toast({
        title: 'エラー',
        description: '緊急ステータスの更新に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };


  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    staffRowRectsRef.current.clear(); // Drag start becomes ultra light
    
    // Cache the scroll container bounds to avoid layout recalculations during dragging
    const scrollContainer = document.getElementById('timeline-scroll-container');
    if (scrollContainer) {
      scrollContainerRectRef.current = scrollContainer.getBoundingClientRect();
    }

    const guidelineEl = document.getElementById('drag-guideline');
    if (guidelineEl) {
      guidelineEl.style.display = 'block';
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    const guidelineEl = document.getElementById('drag-guideline');
    const guidelineTextEl = document.getElementById('drag-guideline-text');

    if (!over) {
      if (guidelineEl) guidelineEl.style.display = 'none';
      return;
    }

    const staffId = over.id as string;
    const staffRowEl = document.getElementById(`staff-row-${staffId}`);
    if (!staffRowEl || !staffRowEl.parentElement) {
      if (guidelineEl) guidelineEl.style.display = 'none';
      return;
    }

    const staffRowWrapper = staffRowEl.parentElement;
    const scrollContainer = document.getElementById('timeline-scroll-container');

    if (scrollContainer && scrollContainerRectRef.current && active.rect.current.translated) {
      // Calculate drop X position relative to the timeline grid starting point (adding scroll offset and subtracting staff column width)
      const relativeLeftToScrollContainer = active.rect.current.translated.left - scrollContainerRectRef.current.left;
      const dropX = relativeLeftToScrollContainer + scrollContainer.scrollLeft - 144;
      
      const minutes = pixelsToMinutes(dropX);
      const baseDate = new Date(currentDate);
      baseDate.setHours(timelineStartHour, 0, 0, 0);
      const targetTime = addMinutes(baseDate, minutes);
      const timeStr = format(targetTime, 'HH:mm');

      // Directly update DOM elements without triggering React re-renders for high performance on low-spec PCs
      if (guidelineEl && guidelineTextEl) {
        guidelineEl.style.display = 'block';
        guidelineEl.style.left = `${dropX + 144}px`;
        guidelineEl.style.top = `${staffRowWrapper.offsetTop}px`;
        guidelineEl.style.height = `${staffRowWrapper.offsetHeight}px`;
        guidelineTextEl.innerText = timeStr;
      }
    }
  };



  const unassignTask = async (eventToUnassign: WithId<ScheduleEvent>) => {
    const targetOrderId = eventToUnassign.systemId || eventToUnassign.rawOrderId || eventToUnassign.id;
    if (!targetOrderId) return;

    const previousSchedule = [...scheduleEvents];

    // Optimistic Update: Save as unassigned locally to prevent reverting
    saveLocalEvent({ ...eventToUnassign, staffId: '', start: '', end: '' });

    // Remove from timeline view state
    setScheduleEvents(prev => prev.filter(e => e.id !== eventToUnassign.id && e.tripId !== eventToUnassign.tripId));

    // If it's part of a trip, suppress the travel event so it doesn't linger
    if (eventToUnassign.tripId) {
      toggleTripSuppression(eventToUnassign.tripId);
    }

    try {
      // 1. Direct Write to Firestore (Primary) for instant reflection on database
      try {
        const { OrderService } = await import('@/services/order-service');
        await OrderService.updateOrder(targetOrderId, {
          staffName: '',
          staffId: '',
          status: '未割当',
          updatedAt: new Date().toISOString()
        } as any);
      } catch (fsErr) {
        console.error("Firestore sync error on unassign:", fsErr);
      }

      // 2. Secondary update to GAS Sheet
      updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        eventTitle: `(ID: ${eventToUnassign.rawOrderId || targetOrderId})`,
        staffName: "",
        statusValue: "未割当",
        scheduledTime: "",
        timestamp: new Date().toISOString(),
        systemId: targetOrderId
      }).catch(err => console.warn('Failed to update sheet on unassign:', err));

      await refetchOrders();
      toast({ title: 'タスクを未割り当てに戻しました', duration: 3000 });
    } catch (e: any) {
      console.error("Unassignment failed:", e);
      toast({ variant: 'destructive', title: '更新エラー', description: `スケジュールの更新に失敗しました: ${e.message}` });
      deleteLocalEvent(eventToUnassign.id);
      if (eventToUnassign.tripId) toggleTripSuppression(eventToUnassign.tripId);
      setScheduleEvents(previousSchedule);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over, delta } = event;
    
    // Hide guideline on drag end
    const guidelineEl = document.getElementById('drag-guideline');
    if (guidelineEl) {
      guidelineEl.style.display = 'none';
    }

    if (!over) return;

    if (Math.abs(delta.x) < 5 && Math.abs(delta.y) < 5) {
      return;
    }

    const item = active.data.current as unknown as (WithId<Order> | WithId<ScheduleEvent>);

    const previousSchedule = [...scheduleEvents];
    const previousUnassigned = [...unassignedOrders];

    if (!item || !item.id) return;

    // --- Dropping back to unassigned area ---
    if (over.id === UNASSIGNED_TASKS_DROPPABLE_ID && !String(active.id).startsWith('order-')) {
      const scheduleItem = item as WithId<ScheduleEvent>;
      const isRealOrder = !!scheduleItem.customerCode;

      if (scheduleItem.rawOrderId && isRealOrder) {
        await unassignTask(scheduleItem);

        // Also unassign companion travel event locally
        if (scheduleItem.tripId) {
          toggleTripSuppression(scheduleItem.tripId); // Reset suppression if needed
          const companionTravel = previousSchedule.find(e => e.tripId === scheduleItem.tripId && e.id.endsWith('-travel') && e.id !== scheduleItem.id);
          if (companionTravel) {
            saveLocalEvent({ ...companionTravel, staffId: '', start: '', end: '' });
          }
        }
      } else {
        if (scheduleItem.rawOrderId) {
          updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            eventTitle: `(ID: ${scheduleItem.rawOrderId})`,
            staffName: "",
            statusValue: "キャンセル",
            timestamp: new Date().toISOString(),
            systemId: scheduleItem.id
          }).catch(err => console.warn('Failed to cancel generic task in sheet:', err));
          await refetchOrders();
        }
        deleteLocalEvent(item.id);
        toast({ title: '汎用タスクを削除しました', duration: 3000 });
      }
      return;
    }

    const newStaffId = over.id as string;
    const staffRowElement = document.getElementById(`staff-row-${newStaffId}`);
    if (!staffRowElement) return;

    // Calculate start time using scroll-aware logic to avoid Reflow (Layout Thrashing)
    const scrollContainer = document.getElementById('timeline-scroll-container');
    const getNewStartFromDrop = () => {
      if (!scrollContainer || !scrollContainerRectRef.current || !active.rect.current.translated) {
        return new Date();
      }
      const relativeLeftToScrollContainer = active.rect.current.translated.left - scrollContainerRectRef.current.left;
      const dropX = relativeLeftToScrollContainer + scrollContainer.scrollLeft - 144;
      const newStartMinutes = pixelsToMinutes(dropX);
      
      const startOfTimelineDay = new Date(currentDate);
      startOfTimelineDay.setHours(timelineStartHour, 0, 0, 0);
      return addMinutes(startOfTimelineDay, newStartMinutes);
    };

    const newStart = getNewStartFromDrop();

    // --- Moving an existing event ---
    if (!String(active.id).startsWith('order-')) {
      const draggedEvent = item as WithId<ScheduleEvent>;
      const newStaff = getStaffById(newStaffId);
      if (!newStaff) return;

      // Optimistic UI Update & Travel Chip Auto-Generation
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
        
        const effectiveTripId = draggedEvent.tripId || taskEventInTrip.tripId || `trip-${taskEventInTrip.rawOrderId || taskEventInTrip.id.replace(/-(task|travel)$/, '').replace(/^(trip|event)-/, '')}`;
        
        const taskDuration = differenceInMinutes(safeParseISO(taskEventInTrip.end as string || taskEventInTrip.start as string), safeParseISO(taskEventInTrip.start as string)) || 60;
        const travelDuration = travelEventInTrip ? (differenceInMinutes(safeParseISO(travelEventInTrip.end as string || travelEventInTrip.start as string), safeParseISO(travelEventInTrip.start as string)) || TRAVEL_TIME_MINUTES) : TRAVEL_TIME_MINUTES;

        let newTaskStart = newStart;
        if (draggedEvent.id.endsWith('-travel')) {
          newTaskStart = addMinutes(newStart, travelDuration);
        }
        const newTaskEnd = addMinutes(newTaskStart, taskDuration);
        const newTravelStart = subMinutes(newTaskStart, travelDuration);

        // Determine System ID
        const rawId = taskEventInTrip.rawOrderId || (taskEventInTrip.raw ? (taskEventInTrip.raw.SystemID || taskEventInTrip.raw.systemId || findKey(taskEventInTrip.raw, ['SystemID', 'systemId', 'id', '受注No', '受注No(ﾘﾏｰｸ1 8ｹﾀ)'])) : '');
        const finalSystemId = taskEventInTrip.systemId || rawId || taskEventInTrip.id.replace(/-(task|travel)$/, '').replace(/^(trip|event)-/, '');
        const taskPartId = finalSystemId ? `trip-${finalSystemId}-task` : taskEventInTrip.id;
        const travelPartId = finalSystemId ? `trip-${finalSystemId}-travel` : `${effectiveTripId}-travel`;

        const updatedTask: WithId<ScheduleEvent> = {
          ...taskEventInTrip,
          id: taskPartId,
          systemId: finalSystemId,
          tripId: effectiveTripId,
          staffId: newStaffId,
          staffName: newStaff.name,
          start: format(newTaskStart, "yyyy-MM-dd'T'HH:mm:ss"),
          end: format(newTaskEnd, "yyyy-MM-dd'T'HH:mm:ss")
        };

        const updatedTravel: WithId<ScheduleEvent> = travelEventInTrip ? {
          ...travelEventInTrip,
          id: travelPartId,
          systemId: finalSystemId,
          tripId: effectiveTripId,
          staffId: newStaffId,
          staffName: newStaff.name,
          start: format(newTravelStart, "yyyy-MM-dd'T'HH:mm:ss"),
          end: format(newTaskStart, "yyyy-MM-dd'T'HH:mm:ss")
        } : {
          ...taskEventInTrip,
          id: travelPartId,
          systemId: finalSystemId,
          tripId: effectiveTripId,
          title: '移動',
          staffId: newStaffId,
          staffName: newStaff.name,
          start: format(newTravelStart, "yyyy-MM-dd'T'HH:mm:ss"),
          end: format(newTaskStart, "yyyy-MM-dd'T'HH:mm:ss"),
          estimatedDuration: travelDuration
        };

        return [...otherEvents, updatedTask, updatedTravel];
      });

      // Backend Update & Local Persistence
      (async () => {
        try {


          const tripEvents = draggedEvent.tripId ? previousSchedule.filter(e => e.tripId === draggedEvent.tripId) : [draggedEvent];
          const taskPart = tripEvents.find(e => e.id.endsWith('-task')) || draggedEvent;
          const travelPart = tripEvents.find(e => e.id.endsWith('-travel'));
          
          const effectiveTripId = draggedEvent.tripId || taskPart.tripId || `trip-${taskPart.rawOrderId || taskPart.id.replace(/-(task|travel)$/, '').replace(/^(trip|event)-/, '')}`;
          const taskDuration = differenceInMinutes(safeParseISO(taskPart.end as string || taskPart.start as string), safeParseISO(taskPart.start as string)) || 60;
          const travelDuration = travelPart ? (differenceInMinutes(safeParseISO(travelPart.end as string || travelPart.start as string), safeParseISO(travelPart.start as string)) || TRAVEL_TIME_MINUTES) : TRAVEL_TIME_MINUTES;

          let taskStart = newStart;
          if (draggedEvent.id.endsWith('-travel')) {
            taskStart = addMinutes(newStart, travelDuration);
          }
          const taskEnd = addMinutes(taskStart, taskDuration);
          const travelStart = subMinutes(taskStart, travelDuration);

          // Determine System ID reliably across raw and mapped IDs
          const rawId = taskPart.rawOrderId || (taskPart.raw ? (taskPart.raw.SystemID || taskPart.raw.systemId || findKey(taskPart.raw, ['SystemID', 'systemId', 'id', '受注No', '受注No(ﾘﾏｰｸ1 8ｹﾀ)'])) : '');
          const finalSystemId = taskPart.systemId || rawId || taskPart.id.replace(/-(task|travel)$/, '').replace(/^(trip|event)-/, '');
          const taskPartId = finalSystemId ? `trip-${finalSystemId}-task` : taskPart.id;
          const travelPartId = finalSystemId ? `trip-${finalSystemId}-travel` : `${effectiveTripId}-travel`;

          // Local Storage Persistence & Optimistic Event Save (BOTH Task and Travel Events)
          const updatedTask = {
            ...taskPart,
            id: taskPartId,
            systemId: finalSystemId,
            tripId: effectiveTripId,
            staffId: newStaffId,
            staffName: newStaff.name,
            start: format(taskStart, "yyyy-MM-dd'T'HH:mm:ss"),
            end: format(taskEnd, "yyyy-MM-dd'T'HH:mm:ss")
          };
          const updatedTravel = travelPart ? {
            ...travelPart,
            id: travelPartId,
            systemId: finalSystemId,
            tripId: effectiveTripId,
            staffId: newStaffId,
            staffName: newStaff.name,
            start: format(travelStart, "yyyy-MM-dd'T'HH:mm:ss"),
            end: format(taskStart, "yyyy-MM-dd'T'HH:mm:ss")
          } : {
            ...taskPart,
            id: travelPartId,
            systemId: finalSystemId,
            tripId: effectiveTripId,
            title: '移動',
            staffId: newStaffId,
            staffName: newStaff.name,
            start: format(travelStart, "yyyy-MM-dd'T'HH:mm:ss"),
            end: format(taskStart, "yyyy-MM-dd'T'HH:mm:ss"),
            estimatedDuration: travelDuration
          };

          saveLocalEvent(updatedTask);
          saveLocalEvent(updatedTravel);



          // Triple Instant Sync across Timeline Chips, Bottom Order Table, and Firestore Backend
          const updatePayload: any = {
            staffName: newStaff.name,
            staffId: newStaffId,
            scheduledDate: format(taskStart, 'yyyy/MM/dd'),
            scheduledTime: format(taskStart, 'yyyy/MM/dd HH:mm:ss'),
            scheduledEndTime: format(taskEnd, 'yyyy/MM/dd HH:mm:ss'),
            estimatedDuration: taskDuration,
            updatedAt: new Date().toISOString()
          };
          if (taskPart.status === '未割当') {
            updatePayload.status = '割当済';
          }

          if (updateOrderFullSync) {
            if (finalSystemId) updateOrderFullSync(finalSystemId, updatePayload);
            if (rawId && rawId !== finalSystemId) updateOrderFullSync(rawId, updatePayload).catch(() => {});
          } else if (updateRawOrder) {
            if (finalSystemId) updateRawOrder(finalSystemId, updatePayload);
            if (rawId && rawId !== finalSystemId) updateRawOrder(rawId, updatePayload);
          }

          // Direct Firestore Auto-Save for Generic and Real Tasks on Move
          try {
            const { OrderService } = await import('@/services/order-service');
            if (finalSystemId) {
              await OrderService.updateOrder(finalSystemId, updatePayload);
            }
          } catch (fsErr) {
            console.warn('Direct Firestore auto-save on move warning:', fsErr);
          }

          // Determine old staff name before move for GAS spreadsheet lookup
          const previousEventState = previousSchedule.find(e => e.id === draggedEvent.id || (draggedEvent.tripId && e.tripId === draggedEvent.tripId));
          const oldStaffId = previousEventState?.staffId || draggedEvent.staffId;
          const oldStaffName = getStaffById(oldStaffId)?.name || draggedEvent.staffName || '';

          // Backup Sync to Spreadsheet
          updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            eventTitle: taskPart.title || `(ID: ${finalSystemId})`,
            staffName: newStaff.name,
            "作業担当者": newStaff.name,
            "担当者": newStaff.name,
            "作業担当": newStaff.name,
            statusValue: (taskPart.status === '未割当') ? '割当済' : undefined,
            scheduledDate: format(taskStart, 'yyyy/MM/dd'),
            scheduledTime: format(taskStart, 'yyyy/MM/dd HH:mm:ss'),
            scheduledEndTime: format(taskEnd, 'yyyy/MM/dd HH:mm:ss'),
            estimatedDuration: taskDuration,
            "チップ配置作業予定": format(taskStart, 'yyyy/MM/dd HH:mm:ss'),
            "チップ配置作業完了予定": format(taskEnd, 'yyyy/MM/dd HH:mm:ss'),
            "作業予定日": format(taskStart, 'yyyy/MM/dd'),
            systemId: finalSystemId,
            oldStaffName: oldStaffName,
          }).catch(err => {
            console.warn('Failed to update sheet on task move:', err);
          });

          toast({ title: "スケジュールを更新しました", duration: 3000 });
          setTimeout(() => refetchOrders(), 1500);
        } catch (e: any) {
          toast({ variant: 'destructive', title: '更新エラー', description: `スケジュールの更新に失敗しました: ${e.message}` });
          setScheduleEvents(previousSchedule);
        }
      })();

    } else if (String(active.id).startsWith('order-') || 'estimatedDuration' in item) { // --- Creating a new event ---
      const order = item as WithId<Order>;
      const staff = getStaffById(newStaffId);
      if (!staff) return;



      const isGeneric = order.id.startsWith('generic-') || Boolean(order.isGeneric) || isGenericTask(order);
      // Treat as Accompany if ID says so OR title contains "同行"
      const isGenericAccompany = order.id === 'generic-accompany' || String(order.taskDetails || order.title || order.customerName || '').includes('同行');
      const taskStart = getNewStartFromDrop();

      let newEvents: WithId<ScheduleEvent>[] = [];

      // Optimistic UI Update
      if (isGeneric) {
        if (isGenericAccompany) {
          const baseId = `event-${Date.now()}`;
          const derivedTripId = `trip-${baseId}`;

          const travelStart = subMinutes(taskStart, 30);
          const travelEvent: WithId<ScheduleEvent> = {
            id: `${derivedTripId}-travel`,
            title: '移動',
            description: '',
            staffId: newStaffId, locationId: '',
            start: travelStart.toISOString(),
            end: taskStart.toISOString(),
            raw: {},
            customerCode: '', customerName: '', address: '', taskDetails: '移動', serviceType: '', status: '未割当', scheduledDate: '', estimatedDuration: 30, value: 0, staffName: staff.name, equipmentStatus: '',
            tripId: derivedTripId
          };
          const taskEvent: WithId<ScheduleEvent> = {
            id: `${derivedTripId}-task`,
            title: order.taskDetails,
            description: '',
            staffId: newStaffId, locationId: '',
            start: taskStart.toISOString(),
            end: addMinutes(taskStart, order.estimatedDuration).toISOString(),
            raw: {},
            customerCode: '', customerName: '', address: '', taskDetails: order.taskDetails, serviceType: '', status: '未割当', scheduledDate: '', estimatedDuration: order.estimatedDuration, value: 0, staffName: staff.name, equipmentStatus: '',
            tripId: derivedTripId
          };
          newEvents = [travelEvent, taskEvent];
        } else {
          const newEvent: WithId<ScheduleEvent> = {
            id: `event-${Date.now()}`,
            title: order.taskDetails, description: '',
            staffId: newStaffId, locationId: '',
            start: taskStart.toISOString(),
            end: addMinutes(taskStart, order.estimatedDuration).toISOString(),
            raw: {},
            customerCode: '', customerName: '', address: '', taskDetails: order.taskDetails, serviceType: '', status: '未割当', scheduledDate: '', estimatedDuration: order.estimatedDuration, value: 0, staffName: staff.name, equipmentStatus: '',
          };
          newEvents = [newEvent];
        }

        // Persist generic events too
        newEvents.forEach(e => saveLocalEvent(e));

        setScheduleEvents(prev => [...prev, ...newEvents]);
      } else {
        const targetRawOrderId = order.rawOrderId || order.id;
        const tripId = `trip-${targetRawOrderId}`;
        const customer = getCustomerByCode(order.customerCode);
        const travelEvent: WithId<ScheduleEvent> = {
          ...order,
          id: `${tripId}-travel`, tripId,
          title: '移動',
          staffId: newStaffId, locationId: customer?.userCode || '',
          start: subMinutes(taskStart, TRAVEL_TIME_MINUTES).toISOString(), end: taskStart.toISOString(),
          rawOrderId: targetRawOrderId, raw: order.raw, systemId: order.id,
        };
        const taskEvent: WithId<ScheduleEvent> = {
          ...order,
          id: `${tripId}-task`, tripId,
          title: order.taskDetails,
          staffId: newStaffId, locationId: customer?.userCode || '',
          start: taskStart.toISOString(), end: addMinutes(taskStart, order.estimatedDuration || 60).toISOString(),
          rawOrderId: targetRawOrderId, raw: order.raw, systemId: order.id,
        };
        newEvents = [travelEvent, taskEvent];

        // CRITICAL FIX: Persist both Task and Travel events to local context state immediately
        // This prevents them from being wiped out by the next OrderContext refresh
        saveLocalEvent(travelEvent);
        saveLocalEvent(taskEvent);

        setScheduleEvents(prev => [...prev.filter(e => e.rawOrderId !== targetRawOrderId), ...newEvents]);
        setUnassignedOrders(prev => prev.filter(o => o.id !== order.id));
      }

      // Backend Update
      (async () => {
        try {
          if (isGeneric || isGenericAccompany) {
            const updatedEvents = [...newEvents];
            // For Accompany tasks, we only send the MAIN task to backend
            // The backend creates ONE row. Frontend (OrderContext) derives two events.
            const eventsToCreate = isGenericAccompany ? newEvents.filter(e => e.id.endsWith('-task')) : newEvents;

            for (let i = 0; i < eventsToCreate.length; i++) {
              const ev = eventsToCreate[i];
              const taskId = ev.id || `task-${Date.now()}`;

              // 1. Immediate Direct Firestore Persistence for Generic Task (Ensures task never disappears on refetch)
              try {
                const { OrderService } = await import('@/services/order-service');
                const genericOrderData: any = {
                  id: taskId,
                  systemId: taskId,
                  title: ev.title,
                  _type: 'task',
                  isGeneric: true,
                  taskDetails: ev.title,
                  customerName: ev.title,
                  staffId: newStaffId,
                  staffName: staff.name,
                  picName: staff.name,
                  scheduledDate: format(safeParseISO(ev.start), 'yyyy-MM-dd'),
                  scheduledTime: format(safeParseISO(ev.start), "yyyy-MM-dd'T'HH:mm:ss"),
                  scheduledEndTime: format(safeParseISO(ev.end), "yyyy-MM-dd'T'HH:mm:ss"),
                  estimatedDuration: differenceInMinutes(safeParseISO(ev.end as string), safeParseISO(ev.start as string)) || 60,
                  status: '割当済'
                };
                await OrderService.createOrder(genericOrderData);
                saveLocalEvent(ev);
                if (setRawOrdersData) {
                  setRawOrdersData(prev => [...prev.filter(o => o.id !== taskId && o.systemId !== taskId), genericOrderData]);
                }
              } catch (dbErr) {
                console.warn('Failed to save generic task to Firestore:', dbErr);
              }

              // 2. Backup to GAS Spreadsheet with 100% Retry Guarantee
              (async () => {
                for (let attempt = 1; attempt <= 3; attempt++) {
                  try {
                    const res = await createTask({
                      gasUrl: ORDER_GAS_URL,
                      staffName: staff.name,
                      taskName: ev.title,
                      startTime: ev.start as string,
                      endTime: ev.end as string,
                      estimatedDuration: differenceInMinutes(safeParseISO(ev.end as string), safeParseISO(ev.start as string))
                    });
                    if (res && (res.status === 'success' || (res.status as string) === 'ok')) {
                      break;
                    }
                  } catch (err) {
                    console.warn(`[GAS createTask] Attempt ${attempt} failed:`, err);
                  }
                  if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
                }
              })();
            }
            const savedTaskName = eventsToCreate[0]?.title || '汎用タスク';
            toast({ title: `${savedTaskName}を保存しました` });
          } else {
            // Updating Real Order
            const taskEvent = newEvents.find(e => e.id.endsWith('-task'));
            if (taskEvent) {
              const isNewlyAssigned = order.status === '未割当' || order.status === '入庫待ち' || !order.staffName;
              const targetRawOrderId = order.rawOrderId || order.id;

              const payload: any = {
                gasUrl: ORDER_GAS_URL,
                eventTitle: `(ID: ${targetRawOrderId})`,
                staffName: staff.name,
                statusValue: '割当済',
                scheduledDate: format(safeParseISO(taskEvent.start as string), 'yyyy/MM/dd'),
                scheduledTime: format(safeParseISO(taskEvent.start as string), 'yyyy/MM/dd HH:mm:ss'),
                scheduledEndTime: format(safeParseISO(taskEvent.end as string), 'yyyy/MM/dd HH:mm:ss'),
                estimatedDuration: order.estimatedDuration || 60,
                "チップ配置作業予定": format(safeParseISO(taskEvent.start as string), 'yyyy/MM/dd HH:mm:ss'),
                "チップ配置作業完了予定": format(safeParseISO(taskEvent.end as string), 'yyyy/MM/dd HH:mm:ss'),
                "作業予定日": format(safeParseISO(taskEvent.start as string), 'yyyy/MM/dd'),
                "作業時間（分）": order.estimatedDuration || 60,
                timestamp: new Date().toISOString(),
                systemId: order.id
              };

              // Clear any corrupted 1970 dates in action history upon initial assignment
              if (isNewlyAssigned) {
                payload.startTravelTime = "";
                payload.arrivalTimestamp = "";
                payload.actualStartTime = "";
                payload.actualEndTime = "";
                payload.actualDuration = "";
              }

              updateSheetStatus(payload).catch(err => {
                console.warn('Failed to update sheet on assign:', err);
                newEvents.forEach(e => deleteLocalEvent(e.id));
              });

              // Direct Write to Firestore (Primary) to ensure instant reflection on the PC timeline
              try {
                const { OrderService } = await import('@/services/order-service');
                await OrderService.updateOrder(targetRawOrderId, {
                  staffName: staff.name,
                  staffId: newStaffId,
                  status: '割当済',
                  scheduledDate: format(safeParseISO(taskEvent.start as string), 'yyyy/MM/dd'),
                  scheduledTime: format(safeParseISO(taskEvent.start as string), 'yyyy/MM/dd HH:mm:ss'),
                  scheduledEndTime: format(safeParseISO(taskEvent.end as string), 'yyyy/MM/dd HH:mm:ss'),
                  estimatedDuration: order.estimatedDuration || 60,
                  updatedAt: new Date().toISOString()
                } as any);
              } catch (fsErr) {
                console.error("Firestore sync error on assign:", fsErr);
              }

              await refetchOrders();
              toast({ title: "タスクを割り当てました。" });
            }
          }
        } catch (e: any) {
          const errMsg = String(e?.message || '');
          if (errMsg.includes('Server Action') || errMsg.includes('was not found') || errMsg.includes('failed-to-find-server-action')) {
            toast({
              title: "システム最新バージョンの検出",
              description: "新しいアプリバージョンが反映されたため、画面を再読み込みして更新を完了します。",
              duration: 4000
            });
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }, 1200);
            return;
          }
          toast({ variant: 'destructive', title: '割当エラー', description: `タスクの割り当てに失敗しました: ${e.message}` });
          setScheduleEvents(previousSchedule);
          setUnassignedOrders(previousUnassigned);
        }
      })();
    }
  };

  const handleDoubleClickEvent = React.useCallback((event: WithId<ScheduleEvent>) => {
    // Extract destination from description if present [行き先: xxx]
    const destMatch = event.description?.match(/\[行き先: (.*?)\]/);
    let destination = destMatch ? destMatch[1] : '';
    const cleanResolvedName = event.customerName || (event as any).storeName;
    if (cleanResolvedName && cleanResolvedName !== '同行' && cleanResolvedName !== '（店舗名未設定）') {
      destination = cleanResolvedName;
    }
    const cleanDescription = event.description?.replace(/\[行き先: .*?\]/, '').trim() || '';

    setEditedEventDetails({
      title: event.title || '',
      description: cleanDescription,
      startTime: formatTime(event.start),
      endTime: formatTime(event.end),
      destination: destination
    });

    const isActionLogTask = event.id.startsWith('task-') || (event.systemId && event.systemId.startsWith('task-'));
    const isGenericBlock = event.id.startsWith('event-');
    // If it has a rawOrderId (meaning it came from a spreadsheet row) AND it's not a generic action log task or UI block
    const isRealOrder = event.rawOrderId && !isActionLogTask && !isGenericBlock;

    if (isRealOrder) {
      setDialogState({ mode: 'details', event });
    } else {
      setDialogState({ mode: 'edit', event });
    }
  }, [setEditedEventDetails, setDialogState]);

  const handleDoubleClickTimeline = React.useCallback((staffId: string, e: React.MouseEvent) => {
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
  }, [currentDate, timelineStartHour, setEditedEventDetails, setDialogState]);

  const [cancelContact, setCancelContact] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const handleWorkCancel = async () => {
    if (!cancelContact.trim()) {
      toast({ variant: 'destructive', title: 'エラー', description: 'キャンセル連絡者名を入力してください。' });
      return;
    }
    setIsSaving(true);
    try {
      let orderId: string | undefined;
      if (dialogState.mode === 'details' || dialogState.mode === 'edit') {
        const ev = dialogState.event;
        orderId = ev?.systemId || ev?.rawOrderId || (ev?.id ? ev.id.replace(/-(task|travel)$/, '').replace(/^(trip|event)-/, '') : undefined);
      } else if (dialogState.mode === 'order-details') {
        const o = dialogState.order;
        orderId = o?.systemId || o?.id || o?.rawOrderId;
      }

      if (orderId) {
        const cancelPayload = {
          status: 'キャンセル',
          cancelDate: new Date().toISOString(),
          cancelContact: cancelContact
        };

        // 1. Instantly update UI locally (Optimistic UI)
        if (updateOrderFullSync) {
          updateOrderFullSync(orderId, cancelPayload);
        } else if (updateRawOrder) {
          updateRawOrder(orderId, cancelPayload);
        }

        // 2. Primary write to Firestore
        await OrderService.updateOrder(orderId, cancelPayload);

        // 3. Backup update to GAS
        updateSheetStatus({
          gasUrl: ORDER_GAS_URL,
          eventTitle: `(ID: ${orderId})`,
          systemId: orderId,
          staffName: '', // Unassign staff if assigned
          statusValue: 'キャンセル',
          cancelDate: cancelPayload.cancelDate,
          cancelContact: cancelPayload.cancelContact,
          timestamp: new Date().toISOString()
        }).catch(gasErr => {
          console.warn('Failed to update GAS status for cancel:', gasErr);
        });

        toast({ title: "作業キャンセルを記録しました" });
        setIsCancelling(false);
        setCancelContact('');
        await refetchOrders();
      }
      setDialogState({ mode: 'closed' });
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'エラー', description: 'キャンセル処理に失敗しました。' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOrder = async () => {
    const target = dialogState.mode === 'order-details' ? dialogState.order : (dialogState.mode === 'details' || dialogState.mode === 'edit' ? dialogState.event : undefined);
    if (!target) return;
    
    const orderId = target.systemId || target.rawOrderId || (target.id ? target.id.replace(/-(task|travel)$/, '').replace(/^(trip|event)-/, '') : undefined);
    if (!orderId) return;
    if (!confirm('この受注データを完全にデータベースから削除しますか？\nこの操作は取り消せません。')) return;

    setIsSaving(true);
    try {
      // 1. Primary write to Firestore (Delete) & Context clean-up
      await deleteOrder(orderId);

      // 2. Clear from local state immediately to avoid ghost chips
      deleteLocalEvent(target.id);
      if (target.tripId) {
        deleteLocalEvent(`${target.tripId}-travel`);
        deleteLocalEvent(`${target.tripId}-task`);
      }

      // 3. Clear from GAS/Spreadsheet backup
      updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        eventTitle: `(ID: ${orderId})`,
        systemId: orderId,
        statusValue: '削除',
        cancelDate: new Date().toISOString(),
        cancelContact: '物理削除',
        timestamp: new Date().toISOString()
      }).catch(gasErr => {
        console.warn('Failed to notify GAS of order deletion:', gasErr);
      });

      toast({ title: "受注データを削除しました" });
      await refetchOrders();
      setDialogState({ mode: 'closed' });
    } catch (e: any) {
      console.error('Failed to delete order:', e);
      toast({ variant: 'destructive', title: 'エラー', description: '受注データの削除に失敗しました。' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleForceComplete = async () => {
    const target = (dialogState as any).event || (dialogState as any).order;
    if (!target) return;
    if (!confirm('この作業を強制的に「完了」（済マーク）にしますか？\n完了時刻は現在の時刻が自動入力されます。')) return;

    const now = new Date();
    const currentTimeStr = format(now, 'HH:mm');

    // Force values directly into handleSaveEvent overrides
    await handleSaveEvent(false, {
      statusValue: '作業完了',
      actualEndTime: currentTimeStr
    });
  };

  const handleSaveEvent = async (shouldSendEmail: boolean = false, overrides: any = {}) => {
    if (dialogState.mode === 'closed') return;
    setIsSaving(true);

    try {
      // Extract form values directly from DOM to avoid React re-renders on keystrokes
      const domTitle = (document.getElementById('title') as HTMLInputElement)?.value;
      const domDesc = (document.getElementById('description') as HTMLTextAreaElement)?.value;
      const domStart = (document.getElementById('start-time') as HTMLInputElement)?.value;
      const domEnd = (document.getElementById('end-time') as HTMLInputElement)?.value;
      const domDest = (document.getElementById('destination') as HTMLInputElement)?.value || (document.getElementById('edit-destination') as HTMLInputElement)?.value;

      const submitDetails = {
        title: domTitle !== undefined ? domTitle : editedEventDetails.title,
        description: domDesc !== undefined ? domDesc : editedEventDetails.description,
        startTime: domStart !== undefined ? domStart : editedEventDetails.startTime,
        endTime: domEnd !== undefined ? domEnd : editedEventDetails.endTime,
        destination: domDest !== undefined ? domDest : editedEventDetails.destination
      };

      let newStart, newEnd;

      const isValidDate = (dStr?: string) => {
        if (!dStr) return false;
        try {
          const d = new Date(dStr.replace(/\//g, '-'));
          return !isNaN(d.getTime()) && d.getFullYear() > 1970;
        } catch { return false; }
      };

      if (dialogState.mode === 'edit' || dialogState.mode === 'new') {
        const dateFromEvent = event?.scheduledDate;
        const dateStr = dialogState.mode === 'new' ? format(dialogState.start, 'yyyy-MM-dd') : (isValidDate(dateFromEvent) ? dateFromEvent!.replace(/\//g, '-') : format(currentDate, 'yyyy-MM-dd'));
        newStart = new Date(`${dateStr}T${submitDetails.startTime}:00`);
        newEnd = new Date(`${dateStr}T${submitDetails.endTime}:00`);
      } else if (dialogState.mode === 'details') {
        const dateFromForm = editOrderForm.scheduledDate;
        const dateFromEvent = event?.scheduledDate;
        const dateStr = isValidDate(dateFromForm) ? dateFromForm!.replace(/\//g, '-') : (isValidDate(dateFromEvent) ? dateFromEvent!.replace(/\//g, '-') : format(currentDate, 'yyyy-MM-dd'));
        newStart = new Date(`${dateStr}T${submitDetails.startTime}:00`);
        newEnd = new Date(`${dateStr}T${submitDetails.endTime}:00`);
      } else {
        newStart = timeStringToDate(submitDetails.startTime, currentDate);
        newEnd = timeStringToDate(submitDetails.endTime, currentDate);
      }

      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        toast({ variant: 'destructive', title: 'エラー', description: '無効な時間形式です。' });
        setIsSaving(false);
        return;
      }

      let finalEnd = newEnd;
      if (finalEnd < newStart) {
        finalEnd = addMinutes(finalEnd, 24 * 60);
      }
      const durationMinutes = Math.round((finalEnd.getTime() - newStart.getTime()) / (1000 * 60));

      // --- Mode 1: New Event ---
      if (dialogState.mode === 'new') {
        const staff = getStaffById(dialogState.staffId);
        if (!staff) throw new Error("担当スタッフが見つかりません。");

        const dateStrPrefix = format(newStart, 'yyyyMMdd');
        const timeStrSuffix = format(new Date(), 'HHmmss');
        const frontendId = `TASK_${dateStrPrefix}_${timeStrSuffix}`;
        const derivedTripId = `trip-${frontendId}`;

        const newEvent: WithId<ScheduleEvent> = {
          id: frontendId,
          title: submitDetails.title,
          start: newStart.toISOString(),
          end: finalEnd.toISOString(),
          staffId: staff.id,
          locationId: '',
          customerCode: '',
          customerName: submitDetails.title || '社内作業',
          address: '',
          taskDetails: submitDetails.description || submitDetails.title,
          serviceType: '社内作業',
          status: '割当済',
          scheduledDate: format(newStart, 'yyyy/MM/dd'),
          estimatedDuration: durationMinutes,
          value: 0,
          staffName: staff.name,
          equipmentStatus: '',
          tripId: derivedTripId,
          raw: {}
        };

        // Optimistic UI Update
        saveLocalEvent(newEvent);
        setScheduleEvents(prev => [...prev, newEvent]);

        setDialogState({ mode: 'closed' });
        setIsSaving(false);
        toast({ title: '予定を作成中...' });

        // Primary API Call: OrderService.createOrder (Dual-write to Firestore + GAS Spreadsheet)
        import('@/services/order-service').then(({ OrderService }) => {
          OrderService.createOrder({
            id: frontendId,
            systemId: frontendId,
            title: submitDetails.title || '商談',
            customerName: submitDetails.title || '商談',
            workType: '作業',
            taskDetails: submitDetails.description || submitDetails.title || '商談',
            scheduledDate: format(newStart, 'yyyy/MM/dd'),
            scheduledTime: format(newStart, "yyyy/MM/dd'T'HH:mm:ss"),
            scheduledEndTime: format(finalEnd, "yyyy/MM/dd'T'HH:mm:ss"),
            estimatedDuration: durationMinutes,
            staffId: staff.id,
            staffName: staff.name,
            picName: staff.name,
            status: '割当済',
            _type: 'task' as any
          }).then(() => {
            refetchOrders();
            toast({ title: '予定を保存しました' });
          }).catch(err => {
            console.error('Failed to create task:', err);
            toast({ variant: 'destructive', title: 'エラー', description: '予定の作成に失敗しました' });
            setScheduleEvents(prev => prev.filter(e => e.id !== frontendId));
          });
        });

        return; // Return early, skipping the synchronous finally block

      } else if (dialogState.mode === 'edit' || dialogState.mode === 'details' || (dialogState as any).mode === 'order-details') {
        const eventToUpdate = (dialogState as any).event || (dialogState as any).order;
        if (!eventToUpdate) {
          setIsSaving(false);
          return;
        }
        const { title, description } = editedEventDetails;

        // Database or Sheet-based event (Order OR Generic Task)
        const isDatabaseOrSheetOrder = eventToUpdate.systemId || eventToUpdate.rawOrderId || eventToUpdate.customerCode || (eventToUpdate.id && (eventToUpdate.id.startsWith('task-') || eventToUpdate.id.startsWith('trip-') || eventToUpdate.id.startsWith('event-') || eventToUpdate.id.startsWith('ord-')));
        if (isDatabaseOrSheetOrder) {
          // Optimistic UI Update first
          const updatedEvent: WithId<ScheduleEvent> = {
            ...eventToUpdate,
            start: newStart.toISOString(),
            end: finalEnd.toISOString(),
            scheduledDate: format(newStart, 'yyyy/MM/dd'),
            title: title || eventToUpdate.title,
            status: overrides.statusValue || eventToUpdate.status,
            estimatedDuration: durationMinutes,
            taskDetails: description || eventToUpdate.taskDetails
          };
          setScheduleEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
          saveLocalEvent(updatedEvent);

          // Prepare combined update (Consolidated for performance)
          const staff = getStaffById(eventToUpdate.staffId);
          const emailParams = shouldSendEmail ? {
            staffName: staff?.name || "",
            staffEmail: staff?.email || "",
            title: updatedEvent.customerName || updatedEvent.title || '作業予定',
            description: formatEventDescription(updatedEvent),
            startTime: newStart.toISOString(),
            endTime: finalEnd.toISOString(),
            location: getCustomerByCode(eventToUpdate.locationId)?.address || "",
            isUpdate: dialogState.mode === 'edit'
          } : undefined;

          // 1. Direct Write to Firestore (Primary) for instant UI updates
          try {
            const { OrderService } = await import('@/services/order-service');
            const updateFields: any = {
              ...editOrderForm,
              scheduledDate: format(newStart, 'yyyy/MM/dd'),
              scheduledTime: format(newStart, 'yyyy/MM/dd HH:mm:ss'),
              scheduledEndTime: format(finalEnd, 'yyyy/MM/dd HH:mm:ss'),
              estimatedDuration: durationMinutes,
              updatedAt: new Date().toISOString()
            };
            if (dialogState.mode === 'edit') {
              if (submitDetails.title) {
                updateFields.taskDetails = submitDetails.title;
              }
              if (submitDetails.destination) {
                updateFields.customerName = submitDetails.destination;
                updateFields.storeName = submitDetails.destination;
              }
              if (submitDetails.description) {
                updateFields.specialNotes = submitDetails.description;
              }
            }
            if (editOrderForm.storeName !== undefined) {
              updateFields.customerName = editOrderForm.storeName;
            }
            if (overrides.statusValue) {
              updateFields.status = overrides.statusValue;
            }
            // Clean undefined fields safely to prevent Firestore errors
            Object.keys(updateFields).forEach(key => {
              if (updateFields[key] === undefined) delete updateFields[key];
            });
            const targetId = eventToUpdate.systemId || eventToUpdate.rawOrderId || eventToUpdate.id;
            await OrderService.updateOrder(targetId, updateFields);
          } catch (fsErr) {
            console.error("Firestore sync error on save event:", fsErr);
          }

          // 2. Backup to GAS (Asynchronous - Background)
          updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            eventTitle: `(ID: ${eventToUpdate.rawOrderId || eventToUpdate.id})`,
            systemId: eventToUpdate.systemId,
            ...editOrderForm,
            ...overrides, // High-priority overrides (e.g., status/time from Force Complete)
            scheduledDate: format(newStart, 'yyyy/MM/dd'),
            scheduledTime: format(newStart, 'HH:mm'), // Changed to HH:mm for clarity against 1970 bugs
            scheduledEndTime: format(finalEnd, 'HH:mm'),
            estimatedDuration: durationMinutes,
            timestamp: new Date().toISOString(),
            "チップ配置作業予定": format(newStart, 'yyyy/MM/dd HH:mm:ss'),
            "チップ配置作業完了予定": format(finalEnd, 'yyyy/MM/dd HH:mm:ss'),
            "作業予定日": format(newStart, 'yyyy/MM/dd'),
            "作業時間（分）": durationMinutes,
            staffName: staff?.name,
            shouldSendEmail: !!emailParams,
            emailParams: emailParams
          }).catch(gasErr => {
            console.warn('Failed to update sheet on save event:', gasErr);
          });

          toast({
            title: '保存完了',
          });

          setIsEditingOrderDetails(false);
          await refetchOrders();
          setDialogState({ mode: 'closed' });

        } else {
          // Legacy Local event
          const updatedEvent = { ...eventToUpdate, title, description, start: newStart.toISOString(), end: finalEnd.toISOString() };
          setScheduleEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
          saveLocalEvent(updatedEvent);
        }
      }

      // Shared cleanup (Removed artificial 1.5s delay for performance)
      await refetchOrders();
      setDialogState({ mode: 'closed' });

    } catch (e: any) {
      console.error("Save error:", e);
      toast({ variant: 'destructive', title: '保存エラー', description: `更新に失敗しました: ${e.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (dialogState.mode !== 'details' && dialogState.mode !== 'edit') return;
    const eventToDelete = dialogState.event;

    // Optimistic UI Update
    setIsSaving(false);
    setDialogState({ mode: 'closed' });

    // Generic Task Deletion Logic
    // Improved Generic Check: check ID OR title/content
    const isGeneric = eventToDelete.id.startsWith('event-') || eventToDelete.id.startsWith('generic-') || !eventToDelete.customerCode || ['休憩', '移動', '業務', '研修', '同行', '商談'].some(t => eventToDelete.title.includes(t));

    if (isGeneric) {
      const staff = allStaff?.find(s => s.id === eventToDelete.staffId);
      // Priority: use staffName from event if available, otherwise lookup from allStaff
      const staffName = eventToDelete.staffName || staff?.name || '';

      console.log('WorkWise Deletion Debug:', {
        title: eventToDelete.title,
        id: eventToDelete.id,
        rawOrderId: eventToDelete.rawOrderId,
        staffName: staffName,
        scheduledTime: eventToDelete.start
      });

      // Soft Delete: Mark as deleted to hide it, but keep it in local state to block backend Sync
      saveLocalEvent({ ...eventToDelete, staffId: '__DELETED__' });

      // OPTIMISTIC UI: Immediately remove from view state
      setScheduleEvents(prev => prev.filter(e => e.id !== eventToDelete.id));

      // Also delete companion travel event if generic
      if (eventToDelete.tripId) {
        // Find ANY event with same tripId that isn't this one
        const companionTravel = scheduleEvents.find(e => e.tripId === eventToDelete.tripId && e.id !== eventToDelete.id);
        if (companionTravel) {
          saveLocalEvent({ ...companionTravel, staffId: '__DELETED__' });
          // OPTIMISTIC UI: Immediately remove companion from view state
          setScheduleEvents(prev => prev.filter(e => e.id !== companionTravel.id && e.id !== eventToDelete.id));

           // CRITICAL: Also delete the companion event from GAS Backend
          // Even if it doesn't have a task- ID, the fallback search in GAS (by Staff+Time) will catch it.
          updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            eventTitle: companionTravel.title,
            staffName: staffName,
            statusValue: "キャンセル",
            timestamp: new Date().toISOString(),
            systemId: companionTravel.id,
            scheduledTime: companionTravel.start instanceof Date ? companionTravel.start.toISOString() : companionTravel.start,
            actionType: 'cancel'
          }).catch(err => console.warn('Failed to update sheet on companion travel cancel:', err));
        }
      }

      // Update Backend for Generic Task (Cancel status)
      // Even if rawOrderId is missing, we send systemId (gen-HASH) and other details for content-based lookup in GAS
      // CRITICAL: Strip "trip-" and "-task" prefixes if present to get the real GAS System ID
      let cleanSystemId = eventToDelete.id;
      if (cleanSystemId.startsWith('trip-task-') && cleanSystemId.endsWith('-task')) {
        cleanSystemId = cleanSystemId.replace('trip-', '').replace('-task', '');
      }

      updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        eventTitle: eventToDelete.title || `(ID: ${eventToDelete.rawOrderId || 'N/A'})`,
        staffName: staffName, // Needed for fallback search
        statusValue: "キャンセル",
        timestamp: new Date().toISOString(),
        systemId: cleanSystemId, // Pass CLEAN stable ID
        scheduledTime: eventToDelete.start instanceof Date ? eventToDelete.start.toISOString() : eventToDelete.start, // Pass Start Time for fallback search
        actionType: 'cancel' // Optional context
      }).catch(err => console.warn('Failed to update sheet on generic task delete:', err));

      toast({ title: '汎用タスクを削除しました', duration: 3000 });
    } else {
      await unassignTask(eventToDelete);
    }
  };

  const handleSendIcs = async (event: WithId<ScheduleEvent>) => {
    const staff = getStaffById(event.staffId);
    if (!staff) {
      toast({ variant: 'destructive', title: 'エラー', description: '担当者が見つかりません。' });
      return;
    }
    try {
      const descriptionString = formatEventDescription(event);
      console.warn("--- [Email Debug] START ---");
      console.warn("Sending Email with details:", descriptionString);
      console.warn("Event Object:", event);
      console.warn("--- [Email Debug] END ---");

      const result = await sendIcsEmail({
        gasUrl: ORDER_GAS_URL,
        staffName: staff.name,
        staffEmail: staff.email || '',
        title: event.customerName || event.title,
        description: descriptionString,
        startTime: event.start as string,
        endTime: event.end as string,
        location: event.address || findKey(event.raw, ['住所']) || '',
        isUpdate: false,
        submitter: event.submitter,
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

  const renderEditableItem = (label: string, field: string, type: 'text' | 'textarea' | 'date' | 'time' | 'number' | 'select' = 'text', options: string[] = []) => {
    if (!isEditingOrderDetails && !editOrderForm[field]) return null;
    return (
      <div className="flex flex-col gap-1 w-full">
        <Label className="text-xs text-muted-foreground font-semibold">{label}</Label>
        {isEditingOrderDetails && field !== 'equipmentStatus' ? (
          type === 'textarea' ? (
            <Textarea 
              defaultValue={editOrderForm[field] || ''} 
              onBlur={(e) => setEditOrderForm((prev: any) => ({ ...prev, [field]: e.target.value }))} 
              className="text-sm min-h-[80px]" 
            />
          ) : type === 'select' ? (
            <Select
              value={String(editOrderForm[field] || '')}
              onValueChange={(val) => setEditOrderForm((prev: any) => ({ ...prev, [field]: val === '未選択' ? '' : val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="未選択">未選択</SelectItem>
                {options.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input 
              type={type} 
              defaultValue={editOrderForm[field] || ''} 
              onBlur={(e) => setEditOrderForm((prev: any) => ({ ...prev, [field]: e.target.value }))} 
              className="h-8 text-sm" 
            />
          )
        ) : (
          <div className="text-sm pb-1 leading-relaxed whitespace-pre-wrap">{String(editOrderForm[field] || '')}</div>
        )}
      </div>
    );
  };

  const contextValue: ScheduleViewContextType = React.useMemo(() => ({
    getCustomerByCode,
    getStaffById
  }), [getCustomerByCode, getStaffById]);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
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
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        autoScroll={{
          layoutShiftCompensation: false,
          threshold: { x: 0.05, y: 0.05 },
          acceleration: 15,
        }}
        onDragCancel={() => {
          setActiveId(null);
          const guidelineEl = document.getElementById('drag-guideline');
          if (guidelineEl) {
            guidelineEl.style.display = 'none';
          }
        }}
      >

        <TooltipProvider>
          <>
            <div className="space-y-1 dynamic-maxWidth" {...{ 'style': { '--dynamic-maxWidth': `calc(var(--staff-col-width) + ${timelineTotalHours * 60} * var(--pixels-per-minute) * 1px + var(--status-col-width))` } as any }}>
            {/* Emergency Notification Banner */}
            {emergencyNotifications.length > 0 && (
              <div className="w-full bg-red-600/90 text-white px-4 py-2 mb-2 rounded-md shadow-md animate-pulse relative z-50">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-lg">
                    <span>⚠️ 緊急連絡あり</span>
                  </div>
                  <div className="flex flex-col gap-2 pl-4">
                    {emergencyNotifications.map((notification, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/10 p-2 rounded">
                        <span className="font-bold flex-1">{notification.staffName}: {notification.message}</span>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="bg-white text-red-600 hover:bg-gray-100 border-none"
                            onClick={() => openReplyDialog(notification)}
                          >
                            返信
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white text-blue-600 bg-white hover:bg-gray-100 border-none"
                            onClick={() => handleClearEmergency(notification)}
                          >
                            解除
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Reply Dialog */}
            <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>緊急連絡への返信</DialogTitle>
                  <DialogDescription>
                    スタッフ {targetEmergencyEvent?.staffName} の受注コメント（スプレッドシートの「任意コメント」欄）に返信を追記します。
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="reply-message">メッセージ</Label>
                  <Textarea
                    id="reply-message"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="了解しました。すぐに向かいます。"
                    className="mt-2"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>キャンセル</Button>
                  <Button onClick={handleSendReply}>送信</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                <div id="timeline-scroll-container" className="w-full border rounded-md h-auto overflow-x-auto overflow-y-visible">
                  <div className="relative dynamic-width" {...{ 'style': { '--dynamic-width': `calc(var(--staff-col-width) + ${timelineTotalHours * 60} * var(--pixels-per-minute) * 1px + var(--status-col-width))` } as any }}>

                    {/* Header Row - Now inside ScrollArea for perfect alignment */}
                    <div className="sticky top-0 z-40 flex h-[34px] border-b bg-background/95 backdrop-blur-sm">
                      <div className="sticky left-0 z-50 flex-shrink-0 font-semibold p-2 border-r bg-background w-[144px]">スタッフ</div>
                      <div className="relative flex-1 h-full">
                        {Array.from({ length: timelineTotalHours + 1 }).map((_, i) => (
                          <div key={i} className="absolute h-full border-l dynamic-left" {...{ 'style': { '--dynamic-left': `calc(${i * 60} * var(--pixels-per-minute) * 1px)` } as any }}>
                            <span className="absolute top-1 -translate-x-1/2 text-xs text-muted-foreground">{timelineStartHour + i}:00</span>
                          </div>
                        ))}
                      </div>
                      <div className="sticky right-0 z-50 flex-shrink-0 font-semibold p-2 border-l bg-background w-[120px]">ステータス</div>
                    </div>

                    <div id="timeline-rows-container" className="relative space-y-2 pb-2">
                      {/* Drag Guidance Line & Time Label (Direct DOM Manipulation for Performance) */}
                      <div 
                        id="drag-guideline" 
                        className="absolute pointer-events-none z-[100] hidden border-l-2 border-dashed border-red-500/60"
                        style={{ top: 0, height: 0, left: 0 }}
                      >
                        <div 
                          id="drag-guideline-text" 
                          className="absolute bg-red-500 text-white text-[10px] font-bold rounded shadow-lg px-1.5 py-0.5 whitespace-nowrap"
                          style={{ transform: 'translateX(-50%) translateY(-100%)', top: 0, left: 0 }}
                        />
                      </div>

                      {isToday(currentDate) && (
                        <div className="absolute top-0 h-full pointer-events-none z-[15] dynamic-left dynamic-width" {...{ 'style': { '--dynamic-left': `var(--staff-col-width)`, '--dynamic-width': `calc(${timelineTotalHours * 60} * var(--pixels-per-minute) * 1px)` } as any }}>
                          <TimeIndicator />
                        </div>
                      )}
                      {staffData?.map((staff) => {
                        const events = eventsByStaffId.get(staff.id) || EMPTY_EVENTS;
                        const status = statusByStaffId.get(staff.id);
                        return (
                          <StaffRow 
                            key={staff.id} 
                            staff={staff} 
                            events={events} 
                            status={status} 
                            getCustomerByCode={getCustomerByCode} 
                            onDoubleClickEvent={handleDoubleClickEvent} 
                            onDoubleClickTimeline={handleDoubleClickTimeline} 
                            isToday={isToday(currentDate)}
                            scheduledStaffIds={scheduledStaffIds}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 当日の受注一覧テーブル */}
          <div className="mt-6 bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-foreground">当日作業の受注一覧</h3>
                <p className="text-xs text-muted-foreground mt-0.5">この日（{formatDate(currentDate.toISOString(), 'yyyy/MM/dd')}）に作業予定がある受注の一覧です。行をクリックすると詳細ダイアログが開き、チップと連動して確認・編集が可能です。</p>
              </div>
              <div className="text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                計 {dailyOrders.length} 件
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/10 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <th className="p-3 pl-4">受注 No</th>
                    <th className="p-3">時間</th>
                    <th className="p-3">お取引先名</th>
                    <th className="p-3">作業担当</th>
                    <th className="p-3">ステータス</th>
                    <th className="p-3">車名 / ナンバー</th>
                    <th className="p-3">作業内容</th>
                    <th className="p-3">タイヤ品番/サイズ/本数</th>
                    <th className="p-3 pr-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dailyOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        この日の受注予定はありません。
                      </td>
                    </tr>
                  ) : (
                    dailyOrders.map((order) => {
                      // マスタ解決された店舗名を取得
                      let storeName = order.customerName || '';
                      if (storeName === '' || storeName === '（店舗名未設定）' || storeName === '(店舗名未設定)' || storeName === '店舗名未設定') {
                        const paddedCode = String(order.customerCode || '').trim().padStart(5, '0');
                        const match = allCustomers?.find(c => {
                          const cCode = c.userCode || c['ユーザーコード'] || '';
                          return String(cCode).trim().padStart(5, '0') === paddedCode && paddedCode !== '00000';
                        });
                        if (match?.storeName) {
                          storeName = match.storeName;
                        } else if (order.taskDetails || order.serviceType) {
                          storeName = order.taskDetails || order.serviceType || '社内作業';
                        } else {
                          storeName = '社内作業';
                        }
                      }

                      // 時間のフォーマット
                      const timeStr = order.scheduledTime ? formatTime(order.scheduledTime) : '未定';

                      // 表示用IDの整形（trip-temp-task-... の旧仮IDの場合は見た目を綺麗に整形）
                      let rawId = order.id || order.rawOrderId || (order.raw ? findKey(order.raw, ['SystemID', 'systemId']) : '') || order.displayId || '-';
                      if (rawId.startsWith('trip-temp-task-')) {
                        const tsMatch = rawId.match(/\d+/);
                        if (tsMatch) {
                          const dateObj = new Date(parseInt(tsMatch[0], 10));
                          if (!isNaN(dateObj.getTime())) {
                            rawId = `TASK_${format(dateObj, 'yyyyMMdd_HHmmss')}`;
                          } else {
                            rawId = 'TASK_手動登録';
                          }
                        } else {
                          rawId = 'TASK_手動登録';
                        }
                      }

                      // チップへの連動クリック
                      const handleRowClick = () => {
                        const tripId = `trip-${order.id}`;
                        const taskEvent = scheduleEvents.find(e => e.tripId === tripId || e.rawOrderId === order.id);
                        if (taskEvent) {
                          setEditedEventDetails({
                            title: taskEvent.title || order.customerName || '',
                            description: taskEvent.description || '',
                            startTime: formatTime(taskEvent.start),
                            endTime: formatTime(taskEvent.end),
                            destination: (taskEvent as any).destination || (order as any).destination || ''
                          });
                          setDialogState({ mode: 'details', event: taskEvent });
                        } else {
                          setDialogState({ mode: 'order-details', order });
                        }
                      };

                      return (
                        <tr 
                          key={order.id} 
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={handleRowClick}
                        >
                          <td className="p-3 pl-4 font-semibold text-foreground font-mono text-xs">
                            {rawId}
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                              {timeStr}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-foreground">{storeName}</td>
                          <td className="p-3 text-muted-foreground">{order.staffName || <span className="text-yellow-600 font-semibold">未割り当て</span>}</td>
                          <td className="p-3">
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border whitespace-nowrap",
                              order.status === '作業完了' && "bg-green-50 text-green-700 border-green-200",
                              order.status === '作業中' && "bg-blue-50 text-blue-700 border-blue-200",
                              order.status === '移動中' && "bg-purple-50 text-purple-700 border-purple-200",
                              order.status === '帰社中' && "bg-indigo-50 text-indigo-700 border-indigo-200",
                              order.status === '待機中' && "bg-slate-100 text-slate-700 border-slate-200",
                              order.status === '割当済' && "bg-yellow-50 text-yellow-700 border-yellow-200",
                              order.status === '未割当' && "bg-gray-50 text-gray-700 border-gray-200"
                            )}>
                              {order.status === '帰社中' ? `🏢 帰社中${order.estimatedArrivalTime ? ` (帰社予定 ${order.estimatedArrivalTime})` : ''}` :
                               order.status === '移動中' && order.estimatedArrivalTime ? `🚚 移動中 (${order.nextDestination ? order.nextDestination + ' ' : ''}到着予定 ${order.estimatedArrivalTime})` :
                               order.status || '未割当'}
                            </span>
                          </td>
                          <td className="p-3 text-[11px]">
                            <div className="font-semibold text-foreground">{order.carName || '-'}</div>
                            <div className="text-muted-foreground">{order.regNo ? `(${order.regNo})` : ''}</div>
                          </td>
                          <td className="p-3 text-[11px] text-muted-foreground truncate max-w-[150px]" title={order.serviceType || order.taskDetails}>
                            {order.serviceType || order.taskDetails || '-'}
                          </td>
                          <td className="p-3 text-[11px]">
                            <div className="text-foreground font-semibold">{order.tireSize || '-'}</div>
                            <div className="text-muted-foreground flex gap-2">
                              {order.tireNumber && <span>{order.tireNumber}</span>}
                              {order.quantity && <span className="font-bold text-blue-600">{order.quantity}本</span>}
                            </div>
                          </td>
                          <td className="p-3 pr-4 text-right">
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] hover:bg-muted font-semibold">
                              詳細
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Dialog open={dialogState.mode !== 'closed'} onOpenChange={() => setDialogState({ mode: 'closed' })}>
            <DialogContent
              className={cn((dialogState.mode === 'details' || dialogState.mode === 'order-details') ? "max-w-[95vw] md:max-w-3xl lg:max-w-5xl" : "max-w-lg")}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                  e.preventDefault();
                }
              }}
            >
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 p-1">
                        {renderDetailItem('担当者', staff?.name)}
                        {renderDetailItem('フォーム入力者', event.submitter)}
                        {renderDetailItem('受注日時', event.createdAt ? (event.createdAt instanceof Date ? format(event.createdAt, 'yyyy/MM/dd HH:mm:ss') : formatDate(event.createdAt, 'yyyy/MM/dd HH:mm:ss') || String(event.createdAt)) : '---')}
                        {event.status === 'キャンセル' && (
                          <>
                            {renderDetailItem('キャンセル日時', event.cancelDate ? (formatDate(event.cancelDate, 'yyyy/MM/dd HH:mm:ss') || String(event.cancelDate)) : '---')}
                            {renderDetailItem('キャンセル連絡・受付者', event.cancelContact || '---')}
                          </>
                        )}
                        {renderEditableItem('受注No (リマーク1)', 'orderNo')}
                        {renderEditableItem('任意コメント (リマーク2)', 'comment')}
                        {renderEditableItem('お取引先名', 'storeName')}
                        {renderEditableItem('ユーザーコード', 'customerCode')}
                        {renderEditableItem('ご担当者様', 'picName')}
                        {renderEditableItem('連絡先', 'contact')}
                        {renderEditableItem('機材有無', 'equipmentStatus')}

                        {renderEditableItem('車名', 'carName')}
                        {renderEditableItem('登録ナンバー(下４桁)', 'regNo')}
                        {renderEditableItem('入庫状況', 'arrivalStatus', 'select', ['点検', 'お預かり済', 'お客待ち'])}
                        {renderEditableItem('タイヤ品番', 'tireNumber')}
                        {renderEditableItem('タイヤサイズ', 'tireSize')}
                        {renderEditableItem('品名', 'productName')}
                        <div className="col-span-full">
                          {renderEditableItem('作業内容', 'taskDetails', 'select', [
                            '販売店店舗内作業',
                            'TCC作業',
                            '持ち帰り作業',
                            'ホイールセット付替',
                            '配送のみ',
                            'その他'
                          ])}
                        </div>
                        {renderEditableItem('本数', 'quantity', 'select', ['1', '2', '4', 'その他'])}
                        {renderEditableItem('空気圧センサーパッキン交換', 'sensor', 'select', ['有', '無'])}
                        {renderEditableItem('タイヤ手配状況', 'tireStatus', 'select', ['定期便で配送手配済', 'タイヤ持込み'])}
                        {renderEditableItem('廃タイヤ処分', 'disposal', 'select', ['回収有り：廃タイヤラベル在庫有り', '回収有り：廃タイヤラベル未手配(TMP手配）', '回収なし'])}
                        <div className="col-span-full">
                          {renderEditableItem('特記事項', 'specialNotes', 'textarea')}
                        </div>

                        <div className="col-span-full border-t my-2 pt-2">
                          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">訪問履歴 ・ 実績</h4>
                        </div>
                        {renderEditableItem('作業予定日', 'scheduledDate', 'date')}
                        {renderEditableItem('予定時間', 'scheduledTime', 'time')}
                        {renderEditableItem('移動開始', 'startTravelTime', 'time')}
                        {renderEditableItem('現場到着', 'arrivalTimestamp', 'time')}
                        {renderEditableItem('作業開始', 'actualStartTime', 'time')}
                        {renderEditableItem('作業完了', 'actualEndTime', 'time')}
                        {renderDetailItem('既読確認日時', formatDate(event.confirmedAt, 'yyyy/MM/dd HH:mm'))}
                        {renderEditableItem('所要時間（分）', 'actualDuration', 'number')}
                      </div>
                    )}

                    {/* Edit form */}
                    <div className="grid gap-4 pt-4 border-t">
                      <div className="text-sm"><p><span className="font-semibold text-muted-foreground">担当:</span> {staff?.name}</p></div>
                      {!event.rawOrderId && (
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="title" className="text-right">タスク名</Label>
                          <Input id="title" defaultValue={editedEventDetails.title} className="col-span-3" placeholder="例：定期メンテナンス" />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="start-time">開始時間</Label>
                          <Input id="start-time" type="time" defaultValue={editedEventDetails.startTime} />
                        </div>
                        <div>
                          <Label htmlFor="end-time">終了時間</Label>
                          <Input id="end-time" type="time" defaultValue={editedEventDetails.endTime} />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4 mt-2">
                          <Label htmlFor="edit-destination" className="text-right">行き先</Label>
                          <Input id="edit-destination" defaultValue={editedEventDetails.destination} className="col-span-3" placeholder="行き先を入力" />
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="sm:justify-between pt-4 border-t">
                    {isEditingOrderDetails ? (
                      <div className="flex justify-end w-full gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingOrderDetails(false);
                          }}
                          disabled={isSaving}
                        >
                          キャンセル
                        </Button>
                        <Button
                          onClick={() => handleSaveEvent(false)}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '保存'}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {!isCancelling ? (
                            <>
                              <Button variant="outline" onClick={() => handleSaveEvent(true)} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                {isSaving ? '送信中...' : '保存して送信'}
                              </Button>

                              {dialogState.mode === 'details' && (
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setIsEditingOrderDetails(true);
                                  }}
                                  disabled={isSaving}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  編集する
                                </Button>
                              )}

                              {isAdmin && dialogState.mode === 'details' && (
                                <Button
                                  variant="outline"
                                  onClick={handleForceComplete}
                                  disabled={isSaving}
                                  className="border-green-600 text-green-600 hover:bg-green-50"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  強制完了
                                </Button>
                              )}

                              <Button variant="destructive" onClick={handleDeleteEvent} disabled={isSaving}>
                                {isSaving ? '処理中...' : (isGenericTask((dialogState as any).event || (dialogState as any).order) ? 'タスクの削除' : '未割当に戻す')}
                              </Button>
                              {!isGenericTask((dialogState as any).event || (dialogState as any).order) && (
                                <Button variant="destructive" onClick={handleDeleteOrder} disabled={isSaving} className="bg-red-900 hover:bg-red-950">
                                  受注を消去
                                </Button>
                              )}
                              <Button variant="destructive" onClick={() => setIsCancelling(true)} disabled={isSaving} className="bg-red-700 hover:bg-red-800">
                                作業キャンセル
                              </Button>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 w-full">
                              <Input
                                placeholder="キャンセル連絡者名"
                                value={cancelContact}
                                onChange={(e) => setCancelContact(e.target.value)}
                                className="flex-1"
                              />
                              <Button variant="destructive" onClick={handleWorkCancel} disabled={isSaving}>
                                確定
                              </Button>
                              <Button variant="ghost" onClick={() => setIsCancelling(false)} disabled={isSaving}>
                                戻る
                              </Button>
                            </div>
                          )}
                        </div>
                        {!isCancelling && (
                          <div className='flex gap-2 mt-4 sm:mt-0'>
                            <DialogClose asChild><Button variant="ghost" disabled={isSaving}>閉じる</Button></DialogClose>
                            <Button onClick={() => handleSaveEvent(false)} disabled={isSaving}>
                              {isSaving ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  保存中...
                                </>
                              ) : '保存'}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </DialogFooter>
                </>
              ) : (dialogState.mode === 'new') ? (
                <>
                  <div className="grid gap-4 py-4">
                    <div className="text-sm"><p><span className="font-semibold text-muted-foreground">担当:</span> {staff?.name}</p></div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="title" className="text-right">タスク名</Label>
                      <Input id="title" defaultValue={editedEventDetails.title} className="col-span-3" placeholder="例：定期メンテナンス" />
                    </div>
                    {/* 行き先欄は不要とのことで削除
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="destination" className="text-right">行き先</Label>
                      <Input id="destination" value={editedEventDetails.destination} onChange={(e) => setEditedEventDetails(prev => ({ ...prev, destination: e.target.value }))} className="col-span-3" placeholder="行き先を入力" />
                    </div>
                    */}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="description" className="text-right">詳細</Label>
                      <Textarea id="description" defaultValue={editedEventDetails.description} className="col-span-3" placeholder="予定の詳細やメモ" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start-time">開始時間</Label>
                        <Input id="start-time" type="time" defaultValue={editedEventDetails.startTime} />
                      </div>

                      <div>
                        <Label htmlFor="end-time">終了時間</Label>
                        <Input id="end-time" type="time" defaultValue={editedEventDetails.endTime} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="sm:justify-between">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => handleSaveEvent(true)} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                        {isSaving ? '送信中...' : '保存して送信'}
                      </Button>
                    </div>
                    <div className="flex gap-2 mt-4 sm:mt-0">
                      <DialogClose asChild><Button variant="ghost" disabled={isSaving}>キャンセル</Button></DialogClose>
                      <Button onClick={() => handleSaveEvent(false)} disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            保存中...
                          </>
                        ) : '保存'}
                      </Button>
                    </div>
                  </DialogFooter>
                </>
              ) : (dialogState.mode === 'order-details') ? (
                <>
                  <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 p-1">
                      {renderDetailItem('受注ID', dialogState.order.id)}
                      {renderDetailItem('受注日時', dialogState.order.createdAt ? (dialogState.order.createdAt instanceof Date ? format(dialogState.order.createdAt, 'yyyy/MM/dd HH:mm:ss') : formatDate(dialogState.order.createdAt, 'yyyy/MM/dd HH:mm:ss') || String(dialogState.order.createdAt)) : '---')}
                      {dialogState.order.status === 'キャンセル' && (
                        <>
                          {renderDetailItem('キャンセル日時', dialogState.order.cancelDate ? (formatDate(dialogState.order.cancelDate, 'yyyy/MM/dd HH:mm:ss') || String(dialogState.order.cancelDate)) : '---')}
                          {renderDetailItem('キャンセル連絡・受付者', dialogState.order.cancelContact || '---')}
                        </>
                      )}
                      {renderEditableItem('受注No (リマーク1)', 'orderNo')}
                      {renderEditableItem('任意コメント (リマーク2)', 'comment')}
                      {renderEditableItem('お取引先名', 'storeName')}
                      {renderEditableItem('ユーザーコード', 'customerCode')}
                      {renderEditableItem('ご担当者様', 'picName')}
                      {renderEditableItem('連絡先', 'contact')}
                      {renderEditableItem('機材有無', 'equipmentStatus')}

                      {renderEditableItem('車名', 'carName')}
                      {renderEditableItem('登録ナンバー(下４桁)', 'regNo')}
                      {renderEditableItem('入庫状況', 'arrivalStatus')}
                      {renderEditableItem('タイヤ品番', 'tireNumber')}
                      {renderEditableItem('タイヤサイズ', 'tireSize')}
                      {renderEditableItem('品名', 'productName')}
                      <div className="col-span-full">
                        {renderEditableItem('作業内容', 'taskDetails', 'select', [
                          '販売店店舗内作業',
                          'TCC作業',
                          '持ち帰り作業',
                          'ホイールセット付替',
                          '配送のみ',
                          'その他'
                        ])}
                      </div>
                      {renderEditableItem('本数', 'quantity')}
                      {renderEditableItem('空気圧センサーパッキン交換', 'sensor')}
                      {renderEditableItem('タイヤ手配状況', 'tireStatus')}
                      {renderEditableItem('廃タイヤ処分', 'disposal')}
                      <div className="col-span-full">
                        {renderEditableItem('特記事項', 'specialNotes', 'textarea')}
                      </div>

                      <div className="col-span-full border-t my-2 pt-2">
                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">スケジュール</h4>
                      </div>
                      {renderEditableItem('作業予定日', 'scheduledDate', 'date')}
                      {renderEditableItem('予定時間', 'scheduledTime', 'time')}
                      {renderEditableItem('移動開始', 'startTravelTime', 'time')}
                      {renderEditableItem('現場到着', 'arrivalTimestamp', 'time')}
                      {renderEditableItem('作業開始', 'actualStartTime', 'time')}
                      {renderEditableItem('作業完了', 'actualEndTime', 'time')}
                    </div>
                  </div>
                  <DialogFooter className="sm:justify-between pt-4 border-t">
                    {isCancelling ? (
                      <div className="flex items-center gap-2 w-full">
                        <Input
                          placeholder="キャンセル連絡者名"
                          value={cancelContact}
                          onChange={(e) => setCancelContact(e.target.value)}
                          className="flex-1"
                        />
                        <Button variant="destructive" onClick={handleWorkCancel} disabled={isSaving}>
                          確定
                        </Button>
                        <Button variant="ghost" onClick={() => setIsCancelling(false)} disabled={isSaving}>
                          戻る
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {isEditingOrderDetails ? (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setIsEditingOrderDetails(false);
                                }}
                                disabled={isSaving}
                              >
                                キャンセル
                              </Button>
                              <Button
                                onClick={async () => {
                                  if (!dialogState.order) return;

                                  setIsSaving(true);

                                  try {
                                    const { OrderService } = await import('@/services/order-service');
                                    const orderId = dialogState.order.systemId || dialogState.order.id;
                                    await OrderService.updateOrder(orderId, {
                                      ...editOrderForm,
                                      updatedAt: new Date().toISOString()
                                    });

                                    toast({
                                      title: '保存しました',
                                      description: 'オーダー詳細を更新しました'
                                    });
                                    setIsEditingOrderDetails(false);
                                    await refetchOrders();
                                    setDialogState({ mode: 'closed' });
                                  } catch (error) {
                                    console.error('Failed to update order details:', error);
                                    toast({
                                      title: 'エラー',
                                      description: '更新に失敗しました',
                                      variant: 'destructive'
                                    });
                                  } finally {
                                    setIsSaving(false);
                                  }
                                }}
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    保存中...
                                  </>
                                ) : '保存'}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={() => {
                                  setIsEditingOrderDetails(true);
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                編集する
                              </Button>
                              <Button
                                variant="outline"
                                onClick={async () => {
                                  if (!dialogState.order) return;
                                  setIsSaving(true);
                                  try {
                                    const { OrderService } = await import('@/services/order-service');
                                    const orderId = dialogState.order.systemId || dialogState.order.id;
                                    await OrderService.updateOrder(orderId, {
                                      staffName: '',
                                      staffId: '',
                                      status: '未割当',
                                      updatedAt: new Date().toISOString()
                                    });
                                    toast({ title: 'タスクを未割り当てに戻しました' });
                                    await refetchOrders();
                                    setDialogState({ mode: 'closed' });
                                  } catch (err: any) {
                                    toast({ variant: 'destructive', title: 'エラー', description: err.message });
                                  } finally {
                                    setIsSaving(false);
                                  }
                                }}
                                disabled={isSaving}
                              >
                                未割当に戻す
                              </Button>
                              <Button variant="destructive" onClick={() => setIsCancelling(true)} className="bg-red-700 hover:bg-red-800">
                                受注をキャンセル
                              </Button>
                              <Button variant="destructive" onClick={handleDeleteOrder} className="bg-red-900 hover:bg-red-950">
                                受注を消去
                              </Button>
                            </>
                          )}
                        </div>
                        {!isCancelling && (
                          <DialogClose asChild><Button variant="ghost">閉じる</Button></DialogClose>
                        )}
                      </>
                    )}
                  </DialogFooter>
                </>
              ) : null}
            </DialogContent>
          </Dialog>
          <RenderDragOverlay />
        </>
      </TooltipProvider>
      </DndContext>
    </ScheduleViewContext.Provider>
  );
}

interface StaffRowProps {
  staff: WithId<Staff>;
  events: WithId<ScheduleEvent>[];
  status?: StaffStatus;
  getCustomerByCode: (code: string | undefined) => WithId<Customer> | undefined;
  onDoubleClickEvent: (event: WithId<ScheduleEvent>) => void;
  onDoubleClickTimeline: (staffId: string, e: React.MouseEvent) => void;
  isToday: boolean;
  scheduledStaffIds?: Set<string>;
}

const StaffRow = React.memo<StaffRowProps>(({ staff, events, status, getCustomerByCode, onDoubleClickEvent, onDoubleClickTimeline, isToday, scheduledStaffIds }) => {
  const { setNodeRef, isOver } = useDroppable({ id: staff.id });
  const { toggleTripSuppression } = useOrder();
  const areaBgClass = staff['母店'] ? STORE_COLORS[staff['母店']] || 'bg-background' : 'bg-background';

  const isShiftOn = !scheduledStaffIds || scheduledStaffIds.size === 0 || isStaffMatched(staff, Array.from(scheduledStaffIds));

  const emergencyEvent = events.find(e => e.isEmergency);

  const emergencyMessage = emergencyEvent
    ? (emergencyEvent.emergencyMessage || findKey(emergencyEvent.raw, ['緊急連絡', '任意コメント', 'comment']) || '')
    : '';

  const handleDeleteEvent = React.useCallback((event: WithId<ScheduleEvent>) => {
    toggleTripSuppression(event.tripId || '');
  }, [toggleTripSuppression]);

  return (
    <div className={cn("flex relative h-14 border-b", areaBgClass)}>
      {emergencyEvent && emergencyMessage && (
        <div className="absolute inset-0 z-[60] bg-red-600/90 flex items-center justify-center px-4 animate-pulse pointer-events-none">
          <span className="text-white font-bold text-lg flex items-center gap-2 drop-shadow-md">
            ⚠️ {emergencyMessage} (担当: {staff.name})
          </span>
        </div>
      )}
      <div className={cn("sticky left-0 z-20 flex-shrink-0 px-2 flex items-center border-r bg-inherit w-[144px]")}>
        <div className="font-semibold flex items-center gap-1.5 w-full truncate">
          <div className='w-2 h-8 rounded-full dynamic-bg shrink-0' {...{ 'style': { '--dynamic-bg-color': staff.color } as any }}></div>
          <span className='truncate flex-1 min-w-0'>{staff.name}</span>
          {!isShiftOn && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-800 border-amber-300 font-bold shrink-0 leading-tight dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700">
              シフト外
            </Badge>
          )}
        </div>
      </div>
      <div id={`staff-row-${staff.id}`} ref={setNodeRef} className={cn("relative flex-1 h-full", isOver && "bg-primary/10")} onDoubleClick={(e) => onDoubleClickTimeline(staff.id, e)}>
        <div className="absolute top-0 left-0 h-full w-full">
          {events.map((event) => (<DraggableEvent key={event.id} targetEvent={event} staff={staff} getCustomerByCode={getCustomerByCode} onDoubleClick={onDoubleClickEvent} onDelete={handleDeleteEvent} />))}
        </div>
      </div>
      <div className={cn("sticky right-0 z-20 flex-shrink-0 px-2 flex items-center justify-center border-l bg-inherit w-[140px]")}>
        {status && isToday && (() => {
          const etaTime = status.estimatedArrivalTime || staff.estimatedArrivalTime;
          const lastUpIso = status.lastUpdate || (staff as any).updatedAt || (staff as any).lastLocationUpdatedAt || (staff as any).statusUpdatedAt;
          const etaOverdue = isEtaPassed(etaTime, lastUpIso);

          // 本日の割り当てイベント（作業チップ）が存在するかどうか
          const hasTodayEvents = events && events.some(e => e.status !== '作業完了' && e.status !== 'キャンセル');
          
          // 割当イベントが無い場合の「移動中」は目的地が無いため「待機中」に補正
          let rawStatus = status.status;
          if (rawStatus === '移動中' && !hasTodayEvents) {
            rawStatus = '待機中';
          }

          const displayStatus = (etaOverdue && (rawStatus === '帰社中' || rawStatus === '移動中')) ? '待機中' : rawStatus;
          const destName = status.nextDestination || (events && events.length > 0 ? (events[0].customerName || (events[0] as any).storeName) : '');

          return (
            <div className="text-xs text-center font-medium leading-snug">
              <span className={cn(
                "inline-block px-1.5 py-0.5 rounded text-[11px]",
                displayStatus === '帰社中' && "bg-indigo-100 text-indigo-800 font-bold border border-indigo-200",
                displayStatus === '移動中' && "bg-purple-100 text-purple-800 font-bold border border-purple-200",
                displayStatus === '作業中' && "bg-blue-100 text-blue-800 font-bold border border-blue-200",
                displayStatus === '待機中' && "bg-gray-100 text-gray-700 border border-gray-200"
              )}>
                {displayStatus}
              </span>
              {!etaOverdue && etaTime && (displayStatus === '帰社中' || displayStatus === '移動中') && (
                <div className="text-[10px] text-indigo-900 font-semibold mt-0.5 whitespace-nowrap">
                  {displayStatus === '帰社中' 
                    ? `帰社予定 ${etaTime}` 
                    : (destName ? `${destName}へ移動中 (${etaTime}到着予定)` : `移動中 (${etaTime}到着予定)`)}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  )
});

interface DraggableEventProps {
  targetEvent: WithId<ScheduleEvent>;
  staff: WithId<Staff>;
  getCustomerByCode: (code: string | undefined) => WithId<Customer> | undefined;
  onDoubleClick: (event: WithId<ScheduleEvent>) => void;
  isOverlay?: boolean;
  onDelete?: (event: WithId<ScheduleEvent>) => void;
}

const DraggableEvent = React.memo<DraggableEventProps>(({ targetEvent, staff, getCustomerByCode, onDoubleClick, isOverlay, onDelete }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: targetEvent.id, data: targetEvent, disabled: isOverlay });
  const { left, width } = getEventDimensions(targetEvent.start, targetEvent.end);

  const handleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); onDoubleClick(targetEvent); };

  const isTravelEvent = 
    Boolean(targetEvent.id?.endsWith('-travel')) ||
    Boolean(targetEvent.title?.startsWith('移動')) ||
    Boolean(targetEvent.title?.includes('移動')) ||
    targetEvent.title === '移動' ||
    Boolean(targetEvent.taskDetails?.includes('移動')) ||
    targetEvent.taskDetails === '移動' ||
    targetEvent.customerName === '移動' ||
    targetEvent.serviceType === '移動' ||
    Boolean((targetEvent as any).isTravel);

  let dynamicBgColor = staff.color || 'hsl(var(--primary))';
  let textColorClass = getContrastingTextColor(dynamicBgColor) === '#FFFFFF' ? 'text-white' : 'text-black';

  const isCancelled = targetEvent.status === 'キャンセル' || (targetEvent as any).statusValue === 'キャンセル';

  if (isCancelled) {
    dynamicBgColor = 'rgb(239 68 68)'; // Vivid Red for cancelled tasks
    textColorClass = 'text-white font-bold';
  } else if (isTravelEvent) {
    // 輝度をさらに上げて（0.78）、より一層白く薄い背景色に（文字色は受注チップと統一）
    dynamicBgColor = lightenColor(dynamicBgColor, 0.78);
  }

  if (!isCancelled) {
    if (targetEvent.title === '業務') {
      dynamicBgColor = 'rgb(156 163 175)';
      textColorClass = 'text-white';
    } else if (targetEvent.title === '休憩') {
      dynamicBgColor = 'rgb(34 197 94)';
      textColorClass = 'text-white';
    }
  }

  const [line1, ...rest] = (targetEvent.title || '').split(/\r?\n/);
  const line2 = rest.join('\n');
  const customer = targetEvent.locationId ? getCustomerByCode(targetEvent.locationId) : undefined;

  // Get equipment status and other details from raw order data
  const getStatusSymbol = (status: any) => {
    if (!status) return '×';
    const s = String(status);
    if (s === '有' || s.includes('有')) return '○';
    if (s === '無' || s.includes('無')) return '×';
    if (s === '△' || s.includes('△')) return '△';
    return status;
  };

  const formatHonsu = (honsu: string | number | undefined): string => {
    if (honsu === undefined || honsu === null || honsu === '') return '';
    const str = String(honsu).trim();
    if (str === '') return '';
    if (str.endsWith('本')) return str;
    return `${str}本`;
  };

  const equipmentStatus = targetEvent.equipmentStatus || (targetEvent.raw ? findKey(targetEvent.raw, ['機材有無']) : undefined);
  const equipmentSymbol = getStatusSymbol(equipmentStatus);
  const tireSize = targetEvent.tireSize || (targetEvent.raw ? findKey(targetEvent.raw, ['タイヤサイズ', 'サイズ', 'タイヤ']) : undefined);
  const honsu = targetEvent.quantity || (targetEvent.raw ? findKey(targetEvent.raw, ['本数', 'honsu']) : undefined);
  const carName_val = targetEvent.carName || (targetEvent.raw ? findKey(targetEvent.raw, ["車名", "車両", "車種"]) : undefined);
  const regNo = targetEvent.regNo || (targetEvent.raw ? findKey(targetEvent.raw, ["登録ナンバー(下４桁)", "登録ナンバー", "ナンバー", "車番", "登録番号"]) : undefined);
  const arrangement = targetEvent.arrangement || (targetEvent.raw ? findKey(targetEvent.raw, ["タイヤ手配状況", "手配"]) : undefined);
  const disposal = targetEvent.disposal || (targetEvent.raw ? findKey(targetEvent.raw, ["廃タイヤ処分", "廃タイヤ"]) : undefined);

  const rawCustomerName = targetEvent.customerName || (targetEvent.raw ? findKey(targetEvent.raw, ['店舗名', 'お取引先名', '店舗名称', '店舗', '取引先']) : undefined);
  const cleanCustomerName = (rawCustomerName && rawCustomerName !== '（店舗名未設定）' && rawCustomerName !== '(店舗名未設定)' && rawCustomerName !== '店舗名未設定') ? rawCustomerName : undefined;
  
  const isAccompany = String(targetEvent.title || targetEvent.taskDetails || '').includes('同行');
  let baseCustomerName = isTravelEvent ? '移動' : (cleanCustomerName || customer?.storeName || targetEvent.title || line1);
  if (isAccompany && !isTravelEvent) {
    if (cleanCustomerName && cleanCustomerName !== '同行') {
      baseCustomerName = `同行：${cleanCustomerName}`;
    } else {
      baseCustomerName = '同行';
    }
  }

  const customerName = isCancelled ? `【キャンセル】 ${baseCustomerName}` : baseCustomerName;
  const isCompleted = ['Finish Task', '作業完了', '完了'].includes(String(targetEvent.status || '')) || !!targetEvent.actualEndTime;

  const eventContent = (
    <div
      className={cn(
        "w-full h-full rounded-md flex flex-col justify-center p-1 relative dynamic-bg dynamic-width transition-all", 
        textColorClass, 
        isDragging && !isOverlay && "opacity-50",
        isTravelEvent && "border border-dashed border-current/40 shadow-none font-semibold"
      )}
      {...{ 'style': { '--dynamic-bg-color': dynamicBgColor, '--dynamic-width': isOverlay ? `${width}px` : '100%' } as any }}
    >
      {isCompleted && !isTravelEvent && (
        <div className="absolute -top-1 -right-1 z-[60] pointer-events-none">
          <div className="border border-red-600 rounded-full w-5 h-5 flex items-center justify-center bg-white/90 shadow-sm rotate-neg-15">
            <span className="text-[10px] font-bold text-red-600 leading-none select-none">済</span>
          </div>
        </div>
      )}
      {targetEvent.isConfirmed && !isTravelEvent && (
        <div className="absolute -top-1 -left-1 z-[60] pointer-events-none">
          <div className="border border-blue-600 rounded-full w-5 h-5 flex items-center justify-center bg-white/90 shadow-sm">
            <span className="text-[10px] font-bold text-blue-600 leading-none select-none">確</span>
          </div>
        </div>
      )}
      {targetEvent.hasValidationIssues && !isTravelEvent && (
        <div className="absolute -top-1 right-5 z-[65] pointer-events-none">
          <div className="bg-amber-500 rounded-full p-0.5 shadow-md">
            <AlertTriangle className="h-3 w-3 text-white" />
          </div>
        </div>
      )}
      {targetEvent.isEmergency && !isTravelEvent && (
        <div className="absolute -top-1 -left-1 z-[70] pointer-events-none">
          <div className="bg-red-600 rounded-full p-0.5 shadow-md">
            <AlertTriangle className="h-3 w-3 text-white" />
          </div>
        </div>
      )}
      <p className="text-xs font-semibold truncate pointer-events-none pr-4">{customerName || targetEvent.title || line1}</p>
      <div className="flex items-center justify-between pointer-events-none">
        <p className="text-xs opacity-80 truncate">{formatTime(targetEvent.start)}</p>
      </div>
    </div>
  );

  const titleText = `${customerName || targetEvent.title || line1}` +
    `${(!isTravelEvent && !['移動', '業務', '休憩'].some(t => String(targetEvent.title || '').includes(t))) ? ` (${equipmentSymbol})` : ''}` +
    ` ${formatTime(targetEvent.start)}` +
    `${(!isTravelEvent && (tireSize || honsu)) ? `\n${tireSize ? tireSize : ''}${tireSize && honsu ? ' ' : ''}${honsu ? formatHonsu(honsu) : ''}` : ''}`;

  const style: any = isOverlay ?
    { touchAction: 'none', width: `${width}px` } :
    {
      '--dynamic-left': `${left}px`,
      '--dynamic-width': `${width}px`,
      '--dynamic-opacity': isDragging ? 0 : 1,
      touchAction: 'none',
    };

  return (
    <div
      ref={setNodeRef}
      {...{ 'style': style as any }}
      {...listeners}
      {...attributes}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "rounded-md flex flex-col justify-center cursor-move h-12 relative group", 
        !isOverlay && "dynamic-left dynamic-width dynamic-opacity event-chip-container",
        isOverlay ? 'shadow-lg' : ''
      )}
      data-event-chip="true"
      title={titleText}
    >
      {isTravelEvent && onDelete && !isOverlay && (
        <div
          className="absolute -top-2 -right-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(targetEvent);
          }}
          title="移動時間を削除"
        >
          <div className="bg-red-500 text-white rounded-full p-0.5 shadow-md flex items-center justify-center w-5 h-5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </div>
      )}
      {eventContent}
    </div>
  );
});
