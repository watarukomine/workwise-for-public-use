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
import { cn, findKey, formatTime, mapRawToOrder, getContrastingTextColor, darkenColor, lightenColor, formatDate } from '../../lib/utils';
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
import { updateSheetStatus, sendIcsEmail, createTask, updateOrderDateTime } from '../../app/actions/gas-actions';
import { ORDER_GAS_URL } from '../../lib/settings';
import { Mail, Pencil, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
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

const isGenericTask = (order: any) => {
  if (!order) return false;
  const id = order.id || '';
  const title = order.title || order.taskDetails || '';
  return id.startsWith('task-') || id.startsWith('generic-') ||
    ['休憩', '移動', '業務', '研修', '同行', '商談'].includes(title) ||
    !order.customerCode;
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
        {!['移動', '業務', '休憩', '研修', '同行', '商談'].some(t => String(line1 || '').includes(t)) && <span className="ml-1">({equipmentSymbol})</span>}
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
    // eslint-disable-next-line react-dom/no-unsafe-inline-style
    <div style={style} className={cn("group h-full min-h-[2.5rem] rounded-md px-1.5 py-1 flex flex-col justify-center cursor-move bg-primary text-primary-foreground text-[10px] leading-tight relative", className)}>
      {/* Validation Warning Badge */}
      {order.hasValidationIssues && (
        <div className="absolute -top-1 -right-1 z-10 bg-yellow-500 rounded-full p-0.5 shadow-md" title={order.validationWarnings?.join(', ')}>
          <AlertTriangle className="h-3 w-3 text-white" />
        </div>
      )}

      <div className="flex justify-between items-center w-full overflow-hidden">
        <span className="font-bold truncate mr-1 flex-1">
          {order.customerName || (order as any).title || line1 || <span className="text-xs font-normal opacity-70">ID:{order.rawOrderId || order.id}</span>}
          {!['移動', '業務', '休憩', '研修', '同行', '商談'].some(t => String(line1 || '').includes(t)) &&
            (order.customerName || (order as any).title) && `(${equipmentSymbol})`}
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
    // eslint-disable-next-line react-dom/no-unsafe-inline-style
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
  destination?: string;
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
                  className={order.status === 'キャンセル' ? 'bg-red-100 dark:bg-red-900/30 border-red-500/50' : ''}
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
    // eslint-disable-next-line react-dom/no-unsafe-inline-style
    <div
      className="absolute top-0 h-full w-0.5 bg-red-500 pointer-events-none"
      style={{ left: `${leftPosition}px` }}
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


import { useSelectedStaff } from '@/contexts/selected-staff-context';

// ... (existing imports)

export function ScheduleView({
  staffData,
  currentDate,
  statuses,
}: ScheduleViewProps) {

  const { customers: allCustomers } = useCustomer();
  const { allStaff } = useSelectedStaff(); // Get full list
  const { toast } = useToast();
  const { orders, refetchOrders, unassignedOrders, setUnassignedOrders, scheduleEvents, setScheduleEvents, saveLocalEvent, deleteLocalEvent, toggleTripSuppression } = useOrder();

  const [isClient, setIsClient] = React.useState(false);
  const [dialogState, setDialogState] = React.useState<DialogState>({ mode: 'closed' });

  const [editedEventDetails, setEditedEventDetails] = React.useState<EditedEventDetails>({ title: '', description: '', startTime: '', endTime: '', destination: '' });
  const [active, setActive] = React.useState<Active | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Order date/time editing state
  const [isEditingOrderSchedule, setIsEditingOrderSchedule] = React.useState(false);
  const [editedOrderDate, setEditedOrderDate] = React.useState('');
  const [editedOrderTime, setEditedOrderTime] = React.useState('');

  const getCustomerByCode = (code: string | undefined): WithId<Customer> | undefined => allCustomers?.find(c => c.userCode === code);
  // Use allStaff instead of filtered staffData for lookup
  const getStaffById = (id: string | undefined): WithId<Staff> | undefined => allStaff?.find(s => s.id === id);

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
    return scheduleEvents.filter(event => {
      const eventDate = typeof event.start === 'string' ? parseISO(event.start) : event.start;
      return isValid(eventDate) && isEqual(startOfDay(eventDate), startOfDay(currentDate));
    });
  }, [scheduleEvents, currentDate]);

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

  const handleClearEmergency = async (event: { rawOrderId: string, message: string, staffName: string, systemId: string, raw?: any }) => {
    try {
      if (!event.rawOrderId && !event.systemId) {
        toast({ variant: 'destructive', title: "エラー", description: "イベントIDが見つかりません" });
        return;
      }

      const currentComment = event.raw ? (findKey(event.raw, ['緊急連絡']) || '') : '';
      const newComment = String(currentComment).replace(/【緊急】/g, '').trim();

      // Optimistic update
      const fullEvent = scheduleEvents.find(e => e.id === event.systemId);

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

      await updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        eventTitle: `(ID: ${event.rawOrderId})`,
        staffName: event.staffName,
        statusValue: recoveryStatus, // Restore status
        comment: newComment,
        emergencyFlag: false,
        adminReply: '',
        systemId: event.systemId
      });

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

      const result = await updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        eventTitle: `(ID: ${rawOrderId})`,
        staffName: staffName,
        adminReply: finalReply,
        emergencyFlag: true, // Keep it active
        systemId: (targetEmergencyEvent as any).systemId
      });
      console.log("Send Reply Result:", result);

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

      const result = await updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        systemId: event.id,
        statusValue: event.status,
        emergencyFlag: isEmergency,
      });

      if (result.status === 'success') {
        toast({
          title: isEmergency ? '緊急ステータスに設定しました' : '緊急ステータスを解除しました',
        });
        deleteLocalEvent(event.id);
        await refetchOrders();
      } else {
        throw new Error(result.message);
      }
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

    // Optimistic Update: Save as unassigned locally to prevent reverting
    saveLocalEvent({ ...eventToUnassign, staffId: '', start: '', end: '' });

    // If it's part of a trip, suppress the travel event so it doesn't linger
    if (eventToUnassign.tripId) {
      toggleTripSuppression(eventToUnassign.tripId);
    }

    // We don't need manual setScheduleEvents/setUnassignedOrders here because 
    // saveLocalEvent updates the context, which triggers the effect that 
    // recalculates and pushes the new state (including the unassigned list).

    try {
      await updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        eventTitle: `(ID: ${eventToUnassign.rawOrderId})`,
        staffName: "",
        statusValue: "未割当",
        scheduledTime: "",
        timestamp: new Date().toISOString(),
        systemId: orderToUnassign.id
      });

      await refetchOrders();
      toast({ title: 'タスクを未割り当てに戻しました', duration: 3000 });
    } catch (e: any) {
      console.error("Unassignment failed:", e);
      toast({ variant: 'destructive', title: '更新エラー', description: `シートの更新に失敗しました: ${e.message}` });
      // Revert is harder with saveLocalEvent principle, but hopefully rarely needed.
      // To revert, we would deleteLocalEvent(eventToUnassign.id) and untoggle.
      deleteLocalEvent(eventToUnassign.id);
      if (eventToUnassign.tripId) toggleTripSuppression(eventToUnassign.tripId);
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
          try {
            await updateSheetStatus({
              gasUrl: ORDER_GAS_URL,
              eventTitle: `(ID: ${scheduleItem.rawOrderId})`,
              staffName: "",
              statusValue: "キャンセル",
              timestamp: new Date().toISOString(),
              systemId: scheduleItem.id
            });
            await refetchOrders();
          } catch (e) {
            console.error("Failed to cancel generic task:", e);
          }
        }
        deleteLocalEvent(item.id);
        toast({ title: '汎用タスクを削除しました', duration: 3000 });
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
            toast({ title: "スケジュールを更新しました", duration: 3000 });
          } else if (draggedEvent.id.startsWith('task-') || draggedEvent.id.startsWith('generic-')) {
            // Generic Task persistence (Fix for Reversion Bug)
            const duration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
            const taskEnd = addMinutes(newStart, duration);

            const updatedEvent = {
              ...draggedEvent,
              staffId: newStaffId,
              start: newStart.toISOString(),
              end: taskEnd.toISOString()
            };
            // Optimistic Update
            saveLocalEvent(updatedEvent);

            // Backend Update
            await updateSheetStatus({
              gasUrl: ORDER_GAS_URL,
              eventTitle: draggedEvent.title,
              staffName: newStaff.name,
              statusValue: undefined, // Status usually doesn't change for generic tasks on move
              scheduledDate: format(newStart, 'yyyy/MM/dd'),
              scheduledTime: format(newStart, 'yyyy/MM/dd HH:mm:ss'),
              scheduledEndTime: format(taskEnd, 'yyyy/MM/dd HH:mm:ss'),
              estimatedDuration: duration,
              "チップ配置作業予定": format(newStart, 'yyyy/MM/dd HH:mm:ss'),
              "チップ配置作業完了予定": format(taskEnd, 'yyyy/MM/dd HH:mm:ss'),
              "作業予定日": format(newStart, 'yyyy/MM/dd'),
              systemId: draggedEvent.id
            });
            toast({ title: "タスク時間を更新しました", duration: 3000 });
            await refetchOrders();
          } else if (draggedEvent.rawOrderId) {
            let taskStart = newStart;
            let taskDuration = 60;
            let travelDuration = TRAVEL_TIME_MINUTES;

            // Recalculate trip event timings
            if (draggedEvent.tripId) {
              const tripEvents = previousSchedule.filter(e => e.tripId === draggedEvent.tripId);
              const taskEvent = tripEvents.find(e => e.id.endsWith('-task')) || draggedEvent;
              const travelEvent = tripEvents.find(e => e.id.endsWith('-travel'));

              if (taskEvent) {
                taskDuration = differenceInMinutes(parseISO(taskEvent.end as string), parseISO(taskEvent.start as string));
              }

              if (travelEvent) {
                travelDuration = differenceInMinutes(parseISO(travelEvent.end as string), parseISO(travelEvent.start as string));
              }

              // Adjust start time if we dragged the travel event
              if (draggedEvent.id.endsWith('-travel')) {
                taskStart = addMinutes(newStart, travelDuration);
              }

              const taskEnd = addMinutes(taskStart, taskDuration);
              const travelStart = subMinutes(taskStart, travelDuration);

              // 1. Optimistic Save of TASK Event
              // Even if we dragged the travel event, we must update the task event locally
              if (taskEvent) {
                const optimisticTask = {
                  ...taskEvent,
                  staffId: newStaffId,
                  start: taskStart.toISOString(),
                  end: taskEnd.toISOString()
                };
                saveLocalEvent(optimisticTask);
              }

              // 2. Optimistic Save of TRAVEL Event (if exists)
              if (travelEvent) {
                const optimisticTravel = {
                  ...travelEvent,
                  staffId: newStaffId,
                  start: travelStart.toISOString(),
                  end: taskStart.toISOString()
                };
                saveLocalEvent(optimisticTravel);
              }

            } else {
              // Standalone event (unlikely given logic but fallback)
              taskDuration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
              const taskEnd = addMinutes(taskStart, taskDuration);
              const optimisticEvent = {
                ...draggedEvent,
                staffId: newStaffId,
                start: newStart.toISOString(),
                end: taskEnd.toISOString()
              };
              saveLocalEvent(optimisticEvent);
            }

            // Backend Sync (Trigger updateSheetStatus)
            const taskEnd = addMinutes(taskStart, taskDuration);

            await updateSheetStatus({
              gasUrl: ORDER_GAS_URL,
              eventTitle: `(ID: ${draggedEvent.rawOrderId})`,
              staffName: newStaff.name,
              statusValue: (draggedEvent.staffId !== newStaffId) ? '割当済' : undefined,
              scheduledDate: format(taskStart, 'yyyy/MM/dd'),
              scheduledTime: format(taskStart, 'yyyy/MM/dd HH:mm:ss'),
              scheduledEndTime: format(taskEnd, 'yyyy/MM/dd HH:mm:ss'),
              estimatedDuration: taskDuration,
              "チップ配置作業予定": format(taskStart, 'yyyy/MM/dd HH:mm:ss'),
              "チップ配置作業完了予定": format(taskEnd, 'yyyy/MM/dd HH:mm:ss'),
              "作業予定日": format(taskStart, 'yyyy/MM/dd'),
              "作業時間（分）": taskDuration,
              systemId: mapRawToOrder(draggedEvent.raw).id
            });
            toast({ title: "スケジュールを更新しました", duration: 3000 });
            // await new Promise(resolve => setTimeout(resolve, 2000)); // Removed artificial delay
            await refetchOrders();
          }
        } catch (e: any) {
          toast({ variant: 'destructive', title: '更新エラー', description: `スケジュールの更新に失敗しました: ${e.message}` });
          setScheduleEvents(previousSchedule);
        }
      })();

    } else if ('estimatedDuration' in item) { // --- Creating a new event ---
      const order = item as WithId<Order>;
      const staff = getStaffById(newStaffId);
      if (!staff) return;

      const isGeneric = order.id.startsWith('generic-');
      // Treat as Accompany if ID says so OR title contains "同行"
      const isGenericAccompany = order.id === 'generic-accompany' || order.taskDetails.includes('同行');
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
            title: '移動: 同行',
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
        const tripId = `trip-${order.rawOrderId}`;
        const customer = getCustomerByCode(order.customerCode);
        const travelEvent: WithId<ScheduleEvent> = {
          ...order,
          id: `${tripId}-travel`, tripId,
          title: `移動: ${customer?.storeName || order.taskDetails.split('\n')[0]}`,
          staffId: newStaffId, locationId: customer?.userCode || '',
          start: subMinutes(taskStart, TRAVEL_TIME_MINUTES).toISOString(), end: taskStart.toISOString(),
          rawOrderId: order.rawOrderId, raw: order.raw,
        };
        const taskEvent: WithId<ScheduleEvent> = {
          ...order,
          id: `${tripId}-task`, tripId,
          title: order.taskDetails,
          staffId: newStaffId, locationId: customer?.userCode || '',
          start: taskStart.toISOString(), end: addMinutes(taskStart, order.estimatedDuration).toISOString(),
          rawOrderId: order.rawOrderId, raw: order.raw,
        };
        newEvents = [travelEvent, taskEvent];

        // CRITICAL FIX: Persist both Task and Travel events to local context state immediately
        // This prevents them from being wiped out by the next OrderContext refresh
        saveLocalEvent(travelEvent);
        saveLocalEvent(taskEvent);

        setScheduleEvents(prev => [...prev.filter(e => e.rawOrderId !== order.rawOrderId), ...newEvents]);
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
              const res = await createTask({
                gasUrl: ORDER_GAS_URL,
                staffName: staff.name,
                taskName: ev.title,
                startTime: ev.start as string,
                endTime: ev.end as string,
                estimatedDuration: differenceInMinutes(parseISO(ev.end as string), parseISO(ev.start as string))
              });

              if (res.eventId) {
                const realId = res.eventId;
                const derivedTripId = `trip-${realId}`;
                const frontendTaskId = `${derivedTripId}-task`;
                const frontendTravelId = `${derivedTripId}-travel`;

                if (isGenericAccompany) {
                  // Update IDs for BOTH events (Task and Travel) via tripId association
                  // We need to find the OLD IDs.
                  // ev.tripId should be `trip-event-...`
                  const oldTripId = ev.tripId;
                  if (oldTripId) {
                    // Update Local Persistence
                    // 1. Delete Old Events
                    const eventsToRemove = newEvents.filter(e => e.tripId === oldTripId);
                    eventsToRemove.forEach(e => deleteLocalEvent(e.id));

                    // 2. Create New Events with Real IDs
                    const travelEv = newEvents.find(e => e.id.endsWith('-travel') && e.tripId === oldTripId);
                    const taskEv = newEvents.find(e => e.id.endsWith('-task') && e.tripId === oldTripId);

                    if (travelEv) {
                      const newTravel = { ...travelEv, id: frontendTravelId, tripId: derivedTripId };
                      saveLocalEvent(newTravel);
                    }
                    if (taskEv) {
                      const newTask = { ...taskEv, id: frontendTaskId, tripId: derivedTripId };
                      saveLocalEvent(newTask);
                    }

                    // Update State
                    setScheduleEvents(prev => prev.map(e => {
                      if (e.tripId === oldTripId) {
                        if (e.id.endsWith('-task')) return { ...e, id: frontendTaskId, tripId: derivedTripId };
                        if (e.id.endsWith('-travel')) return { ...e, id: frontendTravelId, tripId: derivedTripId };
                      }
                      return e;
                    }));
                  }
                } else {
                  // Normal Generic Task (Single)
                  const derivedTripId = `trip-${realId}`;
                  const frontendId = `${derivedTripId}-task`;

                  updatedEvents[i] = {
                    ...ev,
                    id: frontendId,
                    tripId: derivedTripId
                  };
                  deleteLocalEvent(ev.id);
                  saveLocalEvent(updatedEvents[i]);
                  setScheduleEvents(prev => prev.map(e => e.id === ev.id ? updatedEvents[i] : e));
                }
              }
            }
            toast({ title: "アクションログを保存しました" });
            // await new Promise(resolve => setTimeout(resolve, 1500));
            // await refetchOrders(); // No longer strictly needed if state is updated correctly, but good for sync
          } else {
            // Updating Real Order
            const taskEvent = newEvents.find(e => e.id.endsWith('-task'));
            if (taskEvent) {
              await updateSheetStatus({
                gasUrl: ORDER_GAS_URL,
                eventTitle: `(ID: ${order.rawOrderId})`,
                staffName: staff.name,
                statusValue: '割当済',
                scheduledDate: format(parseISO(taskEvent.start as string), 'yyyy/MM/dd'),
                scheduledTime: format(parseISO(taskEvent.start as string), 'yyyy/MM/dd HH:mm:ss'),
                scheduledEndTime: format(parseISO(taskEvent.end as string), 'yyyy/MM/dd HH:mm:ss'),
                estimatedDuration: order.estimatedDuration,
                "チップ配置作業予定": format(parseISO(taskEvent.start as string), 'yyyy/MM/dd HH:mm:ss'),
                "チップ配置作業完了予定": format(parseISO(taskEvent.end as string), 'yyyy/MM/dd HH:mm:ss'),
                "作業予定日": format(parseISO(taskEvent.start as string), 'yyyy/MM/dd'),
                "作業時間（分）": order.estimatedDuration,
                timestamp: new Date().toISOString()
              });
              await refetchOrders();
              toast({ title: "タスクを割り当てました。" });
            }
          }
        } catch (e: any) {
          toast({ variant: 'destructive', title: '割当エラー', description: `タスクの割り当てに失敗しました: ${e.message}` });
          setScheduleEvents(previousSchedule);
          setUnassignedOrders(previousUnassigned);
        }
      })();
    }
  };

  const handleDoubleClickEvent = (event: WithId<ScheduleEvent>) => {
    // Extract destination from description if present [行き先: xxx]
    const destMatch = event.description?.match(/\[行き先: (.*?)\]/);
    const destination = destMatch ? destMatch[1] : '';
    const cleanDescription = event.description?.replace(/\[行き先: .*?\]/, '').trim() || '';

    setEditedEventDetails({
      title: event.title || '',
      description: cleanDescription,
      startTime: formatTime(event.start),
      endTime: formatTime(event.end),
      destination: destination
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

  const [cancelContact, setCancelContact] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const handleWorkCancel = async () => {
    if (!cancelContact.trim()) {
      toast({ variant: 'destructive', title: 'エラー', description: 'キャンセル連絡者名を入力してください。' });
      return;
    }
    setIsSaving(true);
    try {
      const staff = dialogState.mode === 'new' ? getStaffById(dialogState.staffId) : undefined;
      // For work cancel, we primarily need the order ID.
      let orderId: string | undefined;
      if (dialogState.mode === 'details' || dialogState.mode === 'edit') {
        orderId = dialogState.event?.rawOrderId;
      }

      if (orderId) {
        await updateSheetStatus({
          gasUrl: ORDER_GAS_URL,
          eventTitle: `(ID: ${orderId})`,
          staffName: '', // Unassign
          statusValue: 'キャンセル',
          cancelDate: new Date().toISOString(),
          cancelContact: cancelContact,
          timestamp: new Date().toISOString()
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

  const handleSaveEvent = async (shouldSendEmail: boolean = false) => {
    if (dialogState.mode === 'closed') return;
    setIsSaving(true);

    try {
      const newStart = timeStringToDate(editedEventDetails.startTime, currentDate);
      const newEnd = timeStringToDate(editedEventDetails.endTime, currentDate);

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

        const res = await createTask({
          gasUrl: ORDER_GAS_URL,
          staffName: staff.name,
          taskName: editedEventDetails.title,
          description: editedEventDetails.description,
          startTime: newStart.toISOString(),
          endTime: finalEnd.toISOString(),
          estimatedDuration: durationMinutes
        });

        if (res.eventId) {
          const derivedTripId = `trip-${res.eventId}`;
          const frontendId = `${derivedTripId}-task`;
          const newEvent: WithId<ScheduleEvent> = {
            id: frontendId,
            title: editedEventDetails.title,
            start: newStart.toISOString(),
            end: finalEnd.toISOString(),
            staffId: staff.id,
            locationId: '',
            customerCode: '',
            customerName: '',
            address: '',
            taskDetails: editedEventDetails.description || editedEventDetails.title,
            serviceType: '',
            status: '未割当',
            scheduledDate: format(newStart, 'yyyy/MM/dd'),
            estimatedDuration: durationMinutes,
            value: 0,
            staffName: staff.name,
            equipmentStatus: '',
            tripId: derivedTripId,
            raw: {}
          };
          saveLocalEvent(newEvent);
          setScheduleEvents(prev => [...prev, newEvent]);
        }
        toast({ title: '予定を保存しました' });

      } else if (dialogState.mode === 'edit' || dialogState.mode === 'details') {
        // --- Mode 2: Edit/Details ---
        const eventToUpdate = dialogState.event;
        const { title, description } = editedEventDetails;

        // Sheet-based event (Order OR Generic Task)
        if (eventToUpdate.rawOrderId || (eventToUpdate.id && eventToUpdate.id.startsWith('task-'))) {
          // Optimistic UI Update first
          const updatedEvent: WithId<ScheduleEvent> = {
            ...eventToUpdate,
            start: newStart.toISOString(),
            end: finalEnd.toISOString(),
            scheduledDate: format(newStart, 'yyyy/MM/dd'),
            title: title || eventToUpdate.title,
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

          const sheetResult = await updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            eventTitle: `(ID: ${eventToUpdate.rawOrderId || eventToUpdate.id})`,
            systemId: eventToUpdate.systemId,
            scheduledDate: format(newStart, 'yyyy/MM/dd'),
            scheduledTime: format(newStart, 'yyyy/MM/dd HH:mm:ss'),
            scheduledEndTime: format(finalEnd, 'yyyy/MM/dd HH:mm:ss'),
            estimatedDuration: durationMinutes,
            timestamp: new Date().toISOString(),
            "チップ配置作業予定": format(newStart, 'yyyy/MM/dd HH:mm:ss'),
            "チップ配置作業完了予定": format(finalEnd, 'yyyy/MM/dd HH:mm:ss'),
            "作業予定日": format(newStart, 'yyyy/MM/dd'),
            "作業時間（分）": durationMinutes,
            staffName: staff?.name,
            shouldSendEmail: !!emailParams,
            emailParams: emailParams
          });

          if (sheetResult.status === 'error') throw new Error(sheetResult.message);

          toast({
            title: '保存完了',
            description: sheetResult.message
          });

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
          await updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            eventTitle: companionTravel.title,
            staffName: staffName,
            statusValue: "キャンセル",
            timestamp: new Date().toISOString(),
            systemId: companionTravel.id,
            scheduledTime: companionTravel.start instanceof Date ? companionTravel.start.toISOString() : companionTravel.start,
            actionType: 'cancel'
          });
        }
      }

      // Update Backend for Generic Task (Cancel status)
      // Even if rawOrderId is missing, we send systemId (gen-HASH) and other details for content-based lookup in GAS
      // CRITICAL: Strip "trip-" and "-task" prefixes if present to get the real GAS System ID
      let cleanSystemId = eventToDelete.id;
      if (cleanSystemId.startsWith('trip-task-') && cleanSystemId.endsWith('-task')) {
        cleanSystemId = cleanSystemId.replace('trip-', '').replace('-task', '');
      }

      await updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        eventTitle: eventToDelete.title || `(ID: ${eventToDelete.rawOrderId || 'N/A'})`,
        staffName: staffName, // Needed for fallback search
        statusValue: "キャンセル",
        timestamp: new Date().toISOString(),
        systemId: cleanSystemId, // Pass CLEAN stable ID
        scheduledTime: eventToDelete.start instanceof Date ? eventToDelete.start.toISOString() : eventToDelete.start, // Pass Start Time for fallback search
        actionType: 'cancel' // Optional context
      });

      toast({ title: '汎用タスクを削除しました', duration: 3000 });
    } else {
      // Optimistic Unassign
      saveLocalEvent({ ...eventToDelete, staffId: '', start: '', end: '' });

      // Also unassign companion travel event
      if (eventToDelete.tripId) {
        toggleTripSuppression(eventToDelete.tripId);

        const companionTravel = scheduleEvents.find(e => e.tripId === eventToDelete.tripId && e.id.endsWith('-travel') && e.id !== eventToDelete.id);
        if (companionTravel) {
          // For travel events, we can either delete them localy or set them to unassigned.
          // Since travel is auto-generated by OrderContext based on the task,
          // setting the TASK to unassigned (above) will eventually cause OrderContext
          // to stop generating the travel event for this staff.
          // However, to be instant, we should hide/reset it.
          // Setting staffId to '' effectively hides it from the staff row.
          saveLocalEvent({ ...companionTravel, staffId: '', start: '', end: '' });
        }
      }
      toast({ title: 'タスクを未割り当てに戻しました', duration: 3000 });
    }

    try {
      if (isGeneric) {
        if (eventToDelete.rawOrderId) {
          await updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            eventTitle: `(ID: ${eventToDelete.rawOrderId})`,
            staffName: "",
            statusValue: "キャンセル",
            timestamp: new Date().toISOString(),
            systemId: eventToDelete.id
          });
        }
      } else {
        const orderToUnassign = mapRawToOrder(eventToDelete.raw);
        await updateSheetStatus({
          gasUrl: ORDER_GAS_URL,
          eventTitle: `(ID: ${eventToDelete.rawOrderId})`,
          staffName: "",
          statusValue: "未割当",
          scheduledTime: "",
          timestamp: new Date().toISOString(),
          systemId: orderToUnassign.id
        });
      }

      await refetchOrders();

    } catch (e: any) {
      console.error("Delete failed:", e);
      toast({ variant: 'destructive', title: '更新エラー', description: `削除に失敗しました: ${e.message}`, duration: 5000 });
      // Revert logic (optional, but good practice)
      deleteLocalEvent(eventToDelete.id);
      if (eventToDelete.tripId) toggleTripSuppression(eventToDelete.tripId);
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
          {/* eslint-disable-next-line react-dom/no-unsafe-inline-style */}
          <div className="space-y-1" style={{ maxWidth: `${TOTAL_TIMELINE_WIDTH + 2}px` }}>
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
                <ScrollArea className="w-full border rounded-md h-[calc(100vh-200px)]">
                  {/* eslint-disable-next-line react-dom/no-unsafe-inline-style */}
                  <div className="relative" style={{ width: `${TOTAL_TIMELINE_WIDTH}px` }}>

                    {/* Header Row - Now inside ScrollArea for perfect alignment */}
                    <div className="sticky top-0 z-40 flex h-[34px] border-b bg-background/95 backdrop-blur-sm">
                      <div className="sticky left-0 z-50 flex-shrink-0 font-semibold p-2 border-r bg-background w-[144px]">スタッフ</div>
                      <div className="relative flex-1 h-full">
                        {Array.from({ length: timelineTotalHours + 1 }).map((_, i) => (
                          // eslint-disable-next-line react-dom/no-unsafe-inline-style
                          <div key={i} className="absolute h-full border-l" style={{ left: `${i * 60 * PIXELS_PER_MINUTE}px` }}>
                            <span className="absolute top-1 -translate-x-1/2 text-xs text-muted-foreground">{timelineStartHour + i}:00</span>
                          </div>
                        ))}
                      </div>
                      <div className="sticky right-0 z-50 flex-shrink-0 font-semibold p-2 border-l bg-background w-[120px]">ステータス</div>
                    </div>

                    <div className="relative space-y-2 pb-2">
                      {isToday(currentDate) && (
                        // eslint-disable-next-line react-dom/no-unsafe-inline-style
                        <div className="absolute top-0 h-full pointer-events-none z-[15]" style={{ left: `${STAFF_COL_WIDTH}px`, width: `${timelineTotalHours * 60 * PIXELS_PER_MINUTE}px` }}>
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
                        {renderDetailItem('フォーム入力者', event.submitter)}
                        {renderDetailItem('お取引先名', findKey(event.raw, ['お取引先名', '店舗']))}
                        {renderDetailItem('機材有無', findKey(event.raw, ['機材有無']))}
                        {isEditingOrderSchedule ? (
                          <>
                            <div className="sm:col-span-2">
                              <Label htmlFor="edit-assigned-date" className="text-sm font-medium">作業予定日</Label>
                              <Input
                                id="edit-assigned-date"
                                type="date"
                                value={editedOrderDate}
                                onChange={(e) => setEditedOrderDate(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <Label htmlFor="edit-assigned-time" className="text-sm font-medium">予定時間</Label>
                              <Input
                                id="edit-assigned-time"
                                type="time"
                                value={editedOrderTime}
                                onChange={(e) => setEditedOrderTime(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            {renderDetailItem('作業予定日', formatDate(findKey(event.raw, ['作業予定日']), 'MM/dd'))}
                            {renderDetailItem('予定時間', formatTime(findKey(event.raw, ['予定時間', 'チップ配置作業予定'])))}
                          </>
                        )}
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
                        {renderDetailItem('特記事項', findKey(event.raw, ['特記事項', 'specialNotes']))}
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



                      {/* 行き先欄は不要とのことで削除
                      <div className="grid grid-cols-4 items-center gap-4 mt-2">
                        <Label htmlFor="edit-destination" className="text-right">行き先</Label>
                        <Input id="edit-destination" value={editedEventDetails.destination} onChange={(e) => setEditedEventDetails(prev => ({ ...prev, destination: e.target.value }))} className="col-span-3" placeholder="行き先を入力" />
                      </div>
                      */}
                    </div>
                  </div>

                  <DialogFooter className="sm:justify-between pt-4 border-t">
                    {isEditingOrderSchedule ? (
                      <div className="flex justify-end w-full gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingOrderSchedule(false);
                            setEditedOrderDate('');
                            setEditedOrderTime('');
                          }}
                          disabled={isSaving}
                        >
                          キャンセル
                        </Button>
                        <Button
                          onClick={async () => {
                            // Get Order ID safely
                            const rawValues = (event as any).raw || {};
                            const orderId = findKey(rawValues, ['受注ID', 'SystemID', 'id']) || event.id;

                            if (!orderId) {
                              toast({ title: 'エラー', description: '受注IDが見つかりません', variant: 'destructive' });
                              return;
                            }

                            // Validation
                            if (!editedOrderDate || !editedOrderTime) {
                              toast({ title: 'エラー', description: '日付と時間を入力してください', variant: 'destructive' });
                              return;
                            }

                            setIsSaving(true);

                            try {
                              const result = await updateOrderDateTime({
                                gasUrl: ORDER_GAS_URL,
                                orderId: orderId,
                                scheduledDate: editedOrderDate,
                                scheduledTime: editedOrderTime,
                              });

                              if (result.status === 'success') {
                                toast({ title: '保存しました', description: '日付・時間を更新しました' });
                                setIsEditingOrderSchedule(false);
                                setEditedOrderDate('');
                                setEditedOrderTime('');
                                await refetchOrders();
                                setDialogState({ mode: 'closed' });
                              } else {
                                toast({ title: 'エラー', description: result.message || '更新に失敗しました', variant: 'destructive' });
                              }
                            } catch (error) {
                              console.error('Failed to update order schedule:', error);
                              toast({ title: 'エラー', description: '更新に失敗しました', variant: 'destructive' });
                            } finally {
                              setIsSaving(false);
                            }
                          }}
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
                                    const rawDate = findKey(event.raw, ['作業予定日']);
                                    const rawTime = findKey(event.raw, ['予定時間', 'チップ配置作業予定']);

                                    // Init Date
                                    if (rawDate) {
                                      try {
                                        const d = new Date(rawDate);
                                        if (!isNaN(d.getTime())) setEditedOrderDate(format(d, 'yyyy-MM-dd'));
                                        else setEditedOrderDate(String(rawDate));
                                      } catch (e) { setEditedOrderDate(''); }
                                    }

                                    // Init Time
                                    if (rawTime) {
                                      setEditedOrderTime(formatTime(rawTime));
                                    }

                                    setIsEditingOrderSchedule(true);
                                  }}
                                  disabled={isSaving}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  日時変更
                                </Button>
                              )}

                              <Button variant="destructive" onClick={handleDeleteEvent} disabled={isSaving}>
                                {isSaving ? '処理中...' : (isGenericTask((dialogState as any).event || (dialogState as any).order) ? 'タスクの削除' : '未割当に戻す')}
                              </Button>
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
                      <Input id="title" value={editedEventDetails.title} onChange={(e) => setEditedEventDetails(prev => ({ ...prev, title: e.target.value }))} className="col-span-3" placeholder="例：定期メンテナンス" />
                    </div>
                    {/* 行き先欄は不要とのことで削除
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="destination" className="text-right">行き先</Label>
                      <Input id="destination" value={editedEventDetails.destination} onChange={(e) => setEditedEventDetails(prev => ({ ...prev, destination: e.target.value }))} className="col-span-3" placeholder="行き先を入力" />
                    </div>
                    */}
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
                  <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 p-1">
                      {renderDetailItem('受注ID', dialogState.order.id)}
                      {renderDetailItem('お取引先名', findKey(dialogState.order.raw, ['お取引先名', '店舗']))}
                      {renderDetailItem('機材有無', findKey(dialogState.order.raw, ['機材有無']))}

                      {/* Editable date/time fields */}
                      {isEditingOrderSchedule ? (
                        <>
                          <div className="sm:col-span-2">
                            <Label htmlFor="edit-order-date" className="text-sm font-medium">作業予定日</Label>
                            <Input
                              id="edit-order-date"
                              type="date"
                              value={editedOrderDate}
                              onChange={(e) => setEditedOrderDate(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label htmlFor="edit-order-time" className="text-sm font-medium">予定時間</Label>
                            <Input
                              id="edit-order-time"
                              type="time"
                              value={editedOrderTime}
                              onChange={(e) => setEditedOrderTime(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          {renderDetailItem('作業予定日', formatDate(findKey(dialogState.order.raw, ['作業予定日']), 'MM/dd'))}
                          {renderDetailItem('予定時間', formatTime(findKey(dialogState.order.raw, ['予定時間', 'チップ配置作業予定'])))}
                        </>
                      )}

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
                      {renderDetailItem('特記事項', findKey(dialogState.order.raw, ['特記事項', 'specialNotes']))}
                    </div>
                  </div>
                  <DialogFooter className="sm:justify-between">
                    <div className="flex gap-2">
                      {isEditingOrderSchedule ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditingOrderSchedule(false);
                              setEditedOrderDate('');
                              setEditedOrderTime('');
                            }}
                            disabled={isSaving}
                          >
                            キャンセル
                          </Button>
                          <Button
                            onClick={async () => {
                              if (!dialogState.order) return;

                              // Validation
                              if (!editedOrderDate || !editedOrderTime) {
                                toast({
                                  title: 'エラー',
                                  description: '日付と時間を入力してください',
                                  variant: 'destructive'
                                });
                                return;
                              }

                              setIsSaving(true);

                              try {
                                const result = await updateOrderDateTime({
                                  gasUrl: ORDER_GAS_URL,
                                  orderId: dialogState.order.id,
                                  scheduledDate: editedOrderDate,
                                  scheduledTime: editedOrderTime,
                                });

                                if (result.status === 'success') {
                                  toast({
                                    title: '保存しました',
                                    description: '日付・時間を更新しました'
                                  });
                                  setIsEditingOrderSchedule(false);
                                  setEditedOrderDate('');
                                  setEditedOrderTime('');
                                  // Refresh orders to show updated data
                                  await refetchOrders();
                                  setDialogState({ mode: 'closed' });
                                } else {
                                  toast({
                                    title: 'エラー',
                                    description: result.message || '更新に失敗しました',
                                    variant: 'destructive'
                                  });
                                }
                              } catch (error) {
                                console.error('Failed to update order schedule:', error);
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
                        <Button
                          onClick={() => {
                            const rawDate = findKey(dialogState.order.raw, ['作業予定日']);
                            const rawTime = findKey(dialogState.order.raw, ['予定時間', 'チップ配置作業予定']);

                            // Initialize date
                            if (rawDate) {
                              try {
                                const d = new Date(rawDate);
                                if (!isNaN(d.getTime())) {
                                  setEditedOrderDate(format(d, 'yyyy-MM-dd'));
                                } else {
                                  setEditedOrderDate(String(rawDate));
                                }
                              } catch (e) {
                                setEditedOrderDate('');
                              }
                            }

                            // Initialize time
                            if (rawTime) {
                              const tStr = formatTime(rawTime);
                              setEditedOrderTime(tStr);
                            }

                            setIsEditingOrderSchedule(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          編集
                        </Button>
                      )}
                    </div>
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
  const { toggleTripSuppression } = useOrder();
  const areaBgClass = staff['母店'] ? STORE_COLORS[staff['母店']] || 'bg-background' : 'bg-background';

  const emergencyEvent = events.find(e => e.isEmergency);

  const emergencyMessage = emergencyEvent
    ? (emergencyEvent.emergencyMessage || findKey(emergencyEvent.raw, ['緊急連絡', '任意コメント', 'comment']) || '')
    : '';

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
        <div className="font-semibold flex items-center gap-2 w-full truncate">
          {/* eslint-disable-next-line react-dom/no-unsafe-inline-style */}
          <div className='w-2 h-8 rounded-full' style={{ backgroundColor: staff.color }}></div>
          <span className='truncate flex-1'>{staff.name}</span>
        </div>
      </div>
      <div id={`staff-row-${staff.id}`} ref={setNodeRef} className={cn("relative flex-1 h-full", isOver && "bg-primary/10")} onDoubleClick={(e) => onDoubleClickTimeline(staff.id, e)}>
        <div className="absolute top-0 left-0 h-full w-full">
          {events.map((event) => (<DraggableEvent key={event.id} event={event} staff={staff} getCustomerByCode={getCustomerByCode} onDoubleClick={() => onDoubleClickEvent(event)} onDelete={() => toggleTripSuppression(event.tripId || '')} />))}
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
  onDelete?: () => void;
}

const DraggableEvent: React.FC<DraggableEventProps> = ({ event, staff, getCustomerByCode, onDoubleClick, isOverlay, onDelete }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: event.id, data: event });
  const { left, width } = getEventDimensions(event.start, event.end);

  // eslint-disable-next-line react-dom/no-unsafe-inline-style
  const style: React.CSSProperties = isOverlay ?
    {} :
    {
      left: `${left}px`,
      width: `${width}px`,
      opacity: isDragging ? 0 : 1,
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 10,
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

  const equipmentStatus = event.raw ? findKey(event.raw, ['機材有無']) : undefined;
  const equipmentSymbol = getStatusSymbol(equipmentStatus);
  const tireSize = event.raw ? findKey(event.raw, ['タイヤサイズ', 'サイズ', 'タイヤ']) : undefined;
  const honsu = event.raw ? findKey(event.raw, ['本数', 'honsu']) : undefined;
  const customerName = event.customerName || event.raw ? findKey(event.raw, ['店舗名', 'お取引先名', '店舗', '取引先']) : (customer?.storeName || event.title || line1);
  const isCompleted = ['Finish Task', '作業完了', '完了'].includes(String(event.status || ''));

  const eventContent = (
    // eslint-disable-next-line
    <div
      className={cn("w-full h-full rounded-md flex flex-col justify-center p-1 relative", textColorClass, isDragging && !isOverlay && "opacity-50")}
      style={{ ...divStyle, width: isOverlay ? `${width}px` : '100%' }}
    >
      {isCompleted && !isTravelEvent && (
        <div className="absolute -top-1 -right-1 z-10 pointer-events-none">
          <div className="border border-red-600 rounded-full w-5 h-5 flex items-center justify-center bg-white/90 shadow-sm" style={{ transform: 'rotate(-15deg)' }}>
            <span className="text-[10px] font-bold text-red-600 leading-none select-none">済</span>
          </div>
        </div>
      )}
      {event.isEmergency && !isTravelEvent && (
        <div className="absolute -top-1 -left-1 z-20 pointer-events-none">
          <div className="bg-red-600 rounded-full p-0.5 shadow-md">
            <AlertTriangle className="h-3 w-3 text-white" />
          </div>
        </div>
      )}
      <p className="text-xs font-semibold truncate pointer-events-none pr-4">{customerName || event.title || line1}</p>
      <p className="text-xs opacity-80 truncate pointer-events-none">{formatTime(event.start)}</p>
    </div>
  );

  const tooltipContent = (
    <div className="space-y-1">
      <p className="font-bold">
        {customerName || event.title || line1}
        {(!isTravelEvent && !['移動', '業務', '休憩'].some(t => String(event.title || '').includes(t))) && <span className="ml-1">({equipmentSymbol})</span>}
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
    // eslint-disable-next-line
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={handleDoubleClick}
      className={cn("rounded-md flex flex-col justify-center cursor-move h-12 relative group", isOverlay ? 'shadow-lg' : '')}
      data-event-chip="true"
    >
      {isTravelEvent && onDelete && !isOverlay && (
        <div
          className="absolute -top-2 -right-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
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
      <Tooltip>
        <TooltipTrigger asChild>
          {eventContent}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="z-[1000]">{tooltipContent}</TooltipContent>
      </Tooltip>
    </div>
  );
};
