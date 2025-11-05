# WorkWise Project Snapshot

This file contains a snapshot of the key files in the WorkWise project. You can use this as a reference or a backup of the current state.

---

## Google Apps Script (GAS)

```javascript
// ↓↓↓↓【要設定】↓↓↓↓
// スプレッドシートのID（URLの .../d/【この部分】/edit...）を貼り付けてください
const SPREADSHEET_ID = "1Q3i81tz-j8GahLBRtdMJfnUjsx_VmM8fN7gn--j85JU"; 
// データを読み書きするシート名を正確に入力してください
const SHEET_NAME = "受注管理"; 
// ↓↓↓↓【設定はここまで】↓↓↓↓

/**
 * GET リクエストを処理し、スプレッドシートのデータを JSON で返します
 */
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`シート '${SHEET_NAME}' が見つかりません。`);
    
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
        obj[header] = (row[index] instanceof Date) ? row[index].toISOString() : row[index];
      });
      obj["Order_URL"] = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}&range=A${rowIndex + 2}`;
      return obj;
    });

    return ContentService.createTextOutput(JSON.stringify({ data: data })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
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
    
    if (params.operation) { // 'create', 'update', 'delete' calendar events
      return handleCalendarEvent(params);
    } else if (params.eventTitle) { // Update sheet from app
      return updateSheetWithOrderInfo(params);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "必要なパラメータ (operation または eventTitle) がありません"
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
      actionTimestamp, scheduledTime, taskCalendarEventId, travelCalendarEventId 
  } = params;

  try {
    console.log("Updating sheet with:", JSON.stringify(params));
    
    const match = eventTitle.match(/\(ID:\s*([\w-]+)\)/);
    if (!match || !match[1] || match[1] === 'N/A') {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "汎用タスクまたはIDなしタスクのためシート更新はスキップされました。" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const orderId = match[1];
    console.log("Extracted order ID:", orderId);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`シート「${SHEET_NAME}」が見つかりません。`);

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find the row for the given orderId
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
    
    // Update columns based on provided params
    const updateColumn = (colName, value) => {
      const colIdx = headers.indexOf(colName);
      if (colIdx !== -1 && value !== undefined && value !== null) {
        sheet.getRange(rowNum, colIdx + 1).setValue(value);
        console.log(`Updated column '${colName}' with value: ${value}`);
      }
    };

    if(staffName !== undefined) updateColumn("担当", staffName);
    if(statusValue !== undefined) updateColumn("受注ステータス", statusValue);
    if(timestamp) updateColumn("最終更新日時", new Date(timestamp));
    if(latitude !== undefined && longitude !== undefined) updateColumn("最終位置情報（緯度,経度）", `${latitude}, ${longitude}`);
    if(scheduledTime) updateColumn("チップ配置作業予定", new Date(scheduledTime));
    if(taskCalendarEventId) updateColumn("taskCalendarEventId", taskCalendarEventId);
    if(travelCalendarEventId) updateColumn("travelCalendarEventId", travelCalendarEventId);
    
    if (actionType && actionTimestamp) {
        const dateValue = new Date(actionTimestamp);
        const actionColMap = {
            'Start Travel': "移動開始",
            'Arrive': "現場到着",
            'Begin Task': "作業開始",
            'Finish Task': "作業終了"
        };
        if(actionColMap[actionType]) {
            updateColumn(actionColMap[actionType], dateValue);
        }
    }
     // Also update calendar if scheduledTime and calendar IDs are present
    if (scheduledTime && (taskCalendarEventId || travelCalendarEventId)) {
      console.log("Updating linked calendar events for time change...");
      const staffCalId = sheet.getRange(rowNum, headers.indexOf("calendarId") + 1).getValue();
      if(staffCalId) {
        const calendar = CalendarApp.getCalendarById(staffCalId);
        if(calendar) {
           const taskStart = new Date(scheduledTime);
           const workDuration = sheet.getRange(rowNum, headers.indexOf("作業時間（分）") + 1).getValue() || 60;
           const taskEnd = new Date(taskStart.getTime() + workDuration * 60000);
           const travelStart = new Date(taskStart.getTime() - 30 * 60000);
           
           if(taskCalendarEventId) {
             try {
                const event = calendar.getEventById(taskCalendarEventId);
                event.setTime(taskStart, taskEnd);
                console.log(`Updated task event ${taskCalendarEventId} time.`);
             } catch(e) { console.error(`Failed to update task event ${taskCalendarEventId}: ${e.message}`);}
           }
           if(travelCalendarEventId) {
             try {
                const event = calendar.getEventById(travelCalendarEventId);
                event.setTime(travelStart, taskStart);
                console.log(`Updated travel event ${travelCalendarEventId} time.`);
             } catch(e) { console.error(`Failed to update travel event ${travelCalendarEventId}: ${e.message}`);}
           }
        }
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


/**
 * カレンダーイベントを作成・更新・削除する
 */
function handleCalendarEvent(params) {
  try {
    console.log("handleCalendarEvent called with:", JSON.stringify(params));
    
    const { operation, calendarId, eventId, title, description, startTime, endTime } = params;
    
    if (!operation || !calendarId) {
      throw new Error("必須パラメータ 'operation' または 'calendarId' がありません");
    }
    
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) throw new Error(`カレンダーID「${calendarId}」が見つからないか、アクセス権がありません。`);

    let result = {};
    
    switch (operation) {
      case 'create':
        if (!title || !startTime || !endTime) throw new Error("予定の作成には title, startTime, endTime が必要です。");
        const newEvent = calendar.createEvent(title, new Date(startTime), new Date(endTime), { description: description || '' });
        result = { status: "success", message: "カレンダーに予定を作成しました。", eventId: newEvent.getId() };
        break;
        
      case 'update':
        if (!eventId) throw new Error("予定の更新には eventId が必要です。");
        const eventToUpdate = calendar.getEventById(eventId);
        if (!eventToUpdate) throw new Error(`イベントID「${eventId}」が見つかりません。`);
        if (title) eventToUpdate.setTitle(title);
        if (startTime && endTime) eventToUpdate.setTime(new Date(startTime), new Date(endTime));
        if (description !== undefined) eventToUpdate.setDescription(description || "");
        result = { status: "success", message: "カレンダーの予定を更新しました。", eventId: eventId };
        break;
        
      case 'delete':
        if (!eventId) throw new Error("予定の削除には eventId が必要です。");
        const eventToDelete = calendar.getEventById(eventId);
        if (!eventToDelete) throw new Error(`イベントID「${eventId}」が見つかりません。`);
        eventToDelete.deleteEvent();
        result = { status: "success", message: "カレンダーから予定を削除しました。" };
        break;
        
      default:
        throw new Error(`不明な操作です: ${operation}`);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error("Error in handleCalendarEvent:", error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
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
    taskCalendarEventId?: string | null;
    travelCalendarEventId?: string | null;
}): Promise<GasResponse> {
    return callGasApi(args);
}

export async function handleCalendarEvent(args: {
    gasUrl: string;
    operation: 'create' | 'update' | 'delete';
    calendarId: string;
    eventId?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
}): Promise<GasResponse> {
    return callGasApi({ ...args });
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
import { updateSheetStatus, handleCalendarEvent } from '@/app/actions/gas-actions';
import { ORDER_GAS_URL } from '@/lib/settings';

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
  
  const [unassignedOrders, setUnassignedOrders] = React.useState<WithId<Order>[]>([]);
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  React.useEffect(() => {
    if (!rawOrdersData) return;
    
    const newUnassignedOrders = rawOrdersData.filter(order => {
        const staffName = findKey(order, ['担当']);
        const scheduledTime = findKey(order, ['チップ配置作業予定']);
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
      const staff = getStaffById(eventToUnassign.staffId);
      if (!staff || !staff.calendarId) {
          toast({ variant: 'destructive', title: 'エラー', description: '担当スタッフにカレンダーIDが設定されていません。' });
          return;
      }

      try {
        await updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            eventTitle: `(ID: ${eventToUnassign.rawOrderId})`,
            staffName: "",
            statusValue: "未割当",
            scheduledTime: "",
            timestamp: new Date().toISOString(),
        });
        
        const eventsToDelete = scheduleEvents.filter(e => e.tripId === eventToUnassign.tripId);
        for (const event of eventsToDelete) {
            if (event.calendarEventId) {
                await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'delete', calendarId: staff.calendarId, eventId: event.calendarEventId });
            }
        }
          
        await refetchOrders();
        toast({ title: 'タスクを未割り当てに戻しました' });
      } catch(e: any) {
          console.error("Unassignment failed:", e);
          toast({ variant: 'destructive', title: '更新エラー', description: `シートまたはカレンダーの更新に失敗しました: ${e.message}` });
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
           const staff = getStaffById(item.staffId);
           if(item.calendarEventId && staff?.calendarId) {
              await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'delete', calendarId: staff.calendarId, eventId: item.calendarEventId });
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
        
        try {
            const newStart = getNewStartFromDrop();
            const isStaffChange = draggedEvent.staffId !== newStaffId;
            
            // Trip-based event (from sheet)
            if (draggedEvent.tripId) {
                const originalTripEvents = scheduleEvents.filter(e => e.tripId === draggedEvent.tripId);
                const originalTask = originalTripEvents.find(e => e.id.endsWith('-task'))!;
                const originalTravel = originalTripEvents.find(e => e.id.endsWith('-travel'));
                
                const taskDuration = differenceInMinutes(parseISO(originalTask.end as string), parseISO(originalTask.start as string));
                let travelDuration = TRAVEL_TIME_MINUTES;
                if (originalTravel) {
                  travelDuration = differenceInMinutes(parseISO(originalTravel.end as string), parseISO(originalTravel.start as string));
                }

                let newTaskStart = newStart;
                if (draggedEvent.id.endsWith('-travel')) {
                    newTaskStart = addMinutes(newStart, travelDuration);
                }
                
                await updateSheetStatus({
                    gasUrl: ORDER_GAS_URL,
                    eventTitle: `(ID: ${originalTask.rawOrderId})`,
                    scheduledTime: newTaskStart.toISOString(),
                    staffName: newStaff.name,
                    taskCalendarEventId: originalTask.calendarEventId,
                    travelCalendarEventId: originalTravel?.calendarEventId,
                });
                
                if (isStaffChange) {
                     if(oldStaff.calendarId && originalTask.calendarEventId) await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'delete', calendarId: oldStaff.calendarId, eventId: originalTask.calendarEventId });
                     if(oldStaff.calendarId && originalTravel?.calendarEventId) await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'delete', calendarId: oldStaff.calendarId, eventId: originalTravel.calendarEventId });
                }

                await refetchOrders();
            } else { // Generic event without tripId
                const duration = differenceInMinutes(parseISO(draggedEvent.end as string), parseISO(draggedEvent.start as string));
                const newEnd = addMinutes(newStart, duration);
                
                if (isStaffChange) {
                  if (oldStaff.calendarId && draggedEvent.calendarEventId) {
                    await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'delete', calendarId: oldStaff.calendarId, eventId: draggedEvent.calendarEventId });
                  }
                  if (newStaff.calendarId) {
                    const createResult = await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'create', calendarId: newStaff.calendarId, title: draggedEvent.title, description: draggedEvent.description, startTime: newStart.toISOString(), endTime: newEnd.toISOString() });
                    setScheduleEvents(prev => prev.map(e => e.id === draggedEvent.id ? {...e, staffId: newStaffId, start: newStart.toISOString(), end: newEnd.toISOString(), calendarEventId: createResult.eventId } : e));
                  }
                } else { // Just time change for generic event
                   if (newStaff.calendarId && draggedEvent.calendarEventId) {
                       await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'update', calendarId: newStaff.calendarId, eventId: draggedEvent.calendarEventId, startTime: newStart.toISOString(), endTime: newEnd.toISOString()});
                       setScheduleEvents(prev => prev.map(e => e.id === draggedEvent.id ? {...e, start: newStart.toISOString(), end: newEnd.toISOString()} : e));
                   }
                }
            }
            toast({ title: "スケジュールを更新しました" });
        } catch(e: any) {
            toast({ variant: 'destructive', title: '更新エラー', description: `移動に失敗しました: ${e.message}` });
        }
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

        try {
            if (isGeneric) {
                const newEventEnd = addMinutes(taskStart, order.estimatedDuration);
                const result = await handleCalendarEvent({ 
                    gasUrl: ORDER_GAS_URL,
                    operation: 'create', 
                    calendarId: staff.calendarId, 
                    title: order.taskDetails, 
                    startTime: taskStart.toISOString(), 
                    endTime: newEventEnd.toISOString() 
                });

                if (result.status === 'error') throw new Error(result.message);

                const newEvent: WithId<ScheduleEvent> = {
                    id: `event-${Date.now()}`,
                    title: order.taskDetails,
                    description: '',
                    staffId: newStaffId,
                    locationId: '',
                    start: taskStart.toISOString(),
                    end: newEventEnd.toISOString(),
                    calendarEventId: result.eventId
                 };
                 setScheduleEvents(prev => [...prev, newEvent]);

            } else {
              const taskEnd = addMinutes(taskStart, order.estimatedDuration);
              const travelStart = subMinutes(taskStart, TRAVEL_TIME_MINUTES);
              
              const travelTitle = `移動: ${customer?.storeName || order.taskDetails.split('\n')[0]}`;
              const travelResult = await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'create', calendarId: staff.calendarId, title: travelTitle, startTime: travelStart.toISOString(), endTime: taskStart.toISOString() });
              
              const taskTitle = order.taskDetails;
              const taskDescription = `顧客: ${customer?.storeName || 'N/A'}\n住所: ${customer?.address || 'N/A'}`;
              const taskResult = await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'create', calendarId: staff.calendarId, title: taskTitle, startTime: taskStart.toISOString(), endTime: taskEnd.toISOString(), description: taskDescription });

              if (taskResult.status === 'error' || travelResult.status === 'error') {
                  throw new Error(taskResult.message || travelResult.message);
              }

              await updateSheetStatus({
                  gasUrl: ORDER_GAS_URL,
                  eventTitle: `(ID: ${order.rawOrderId})`,
                  staffName: staff.name,
                  statusValue: '作業待ち',
                  scheduledTime: taskStart.toISOString(),
                  timestamp: new Date().toISOString(),
                  taskCalendarEventId: taskResult.eventId,
                  travelCalendarEventId: travelResult.eventId,
              });
              
              toast({ title: `${staff.name}に${customer?.storeName || 'タスク'}の作業を割り当てました` });
              await refetchOrders();
            }
        } catch (e: any) {
             toast({ variant: 'destructive', title: '割当エラー', description: `タスクの割り当てに失敗しました: ${e.message}` });
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
            if (!staff || !staff.calendarId) throw new Error("担当スタッフにカレンダーIDが設定されていません。");

            const result = await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'create', calendarId: staff.calendarId, title, description, startTime: newStart.toISOString(), endTime: newEnd.toISOString() });
            
             const newEvent: WithId<ScheduleEvent> = {
                id: `event-${Date.now()}`,
                title, description,
                staffId: dialogState.staffId,
                locationId: '',
                start: newStart.toISOString(),
                end: newEnd.toISOString(),
                calendarEventId: result.eventId,
            };
            setScheduleEvents(prev => [...prev, newEvent]);

        } else if (dialogState.mode === 'edit') {
            const staff = getStaffById(dialogState.event.staffId);
            if (!staff || !staff.calendarId) throw new Error("担当スタッフにカレンダーIDが設定されていません。");
            
            if (dialogState.event.rawOrderId) { // Sheet-based event
                await updateSheetStatus({
                    gasUrl: ORDER_GAS_URL,
                    eventTitle: `(ID: ${dialogState.event.rawOrderId})`,
                    scheduledTime: newStart.toISOString(),
                    timestamp: new Date().toISOString(),
                    taskCalendarEventId: dialogState.event.calendarEventId
                });
                await refetchOrders();

            } else if(dialogState.event.calendarEventId) { // Generic event
                await handleCalendarEvent({ gasUrl: ORDER_GAS_URL, operation: 'update', calendarId: staff.calendarId, eventId: dialogState.event.calendarEventId, title, description, startTime: newStart.toISOString(), endTime: newEnd.toISOString() });
                setScheduleEvents(prev => prev.map(e => e.id === dialogState.event.id ? { ...e, title, description, start: newStart.toISOString(), end: newEnd.toISOString() } : e));
            }
        }
        setDialogState({ mode: 'closed' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: '保存エラー', description: `カレンダーの更新に失敗しました: ${e.message}` });
    }
  };

  const handleDeleteEvent = async () => {
    if (dialogState.mode !== 'edit') return;
    const eventToDelete = dialogState.event;
    
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

  const dailySchedule = React.useMemo(() => {
      if (!scheduleEvents) return [];
      return scheduleEvents.filter(event => {
          const eventDate = typeof event.start === 'string' ? parseISO(event.start) : event.start;
          return isValid(eventDate) && isEqual(startOfDay(eventDate), startOfDay(currentDate));
      });
  }, [scheduleEvents, currentDate]);

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
      <div className={cn("sticky left-0 z-10 flex-shrink-0 pr-2 flex items-center", areaBgClass)} style={{ width: `${STAFF_COL_WIDTH}px` }}>
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
