
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
import type { ScheduleEvent, Staff, Customer, Order } from '@/lib/types';
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
import { addMinutes, differenceInMinutes, format, parse, parseISO, subMinutes } from 'date-fns';
import { staffData, customerData as staticCustomerData, scheduleData as staticScheduleData, orderData as staticOrderData } from '@/lib/data';
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


const PIXELS_PER_MINUTE = 2;
const timelineStartHour = 8;
const timelineEndHour = 19;
const timelineTotalHours = timelineEndHour - timelineStartHour;
const TRAVEL_TIME_MINUTES = 30;

// --- Helper Functions ---
const formatTime = (date: Date | string) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm');
};

const minutesToPixels = (minutes: number) => minutes * PIXELS_PER_MINUTE;

const pixelsToMinutes = (pixels: number) => Math.round(pixels / PIXELS_PER_MINUTE / 15) * 15;

const getEventDimensions = (eventStart: Date | string, eventEnd: Date | string) => {
  const start = eventStart instanceof Date ? eventStart : parseISO(eventStart);
  const end = eventEnd instanceof Date ? eventEnd : parseISO(eventEnd);
  
  const startOfDay = new Date(start);
  startOfDay.setHours(timelineStartHour, 0, 0, 0);

  const leftInMinutes = differenceInMinutes(start, startOfDay);
  const widthInMinutes = differenceInMinutes(end, start);

  return {
    left: minutesToPixels(leftInMinutes),
    width: minutesToPixels(widthInMinutes),
  };
};

// --- Draggable Task Components ---

interface DraggableOrderProps {
  order: Order;
  customer?: Customer;
  className?: string;
}

const DraggableOrder: React.FC<DraggableOrderProps> = ({ order, customer, className }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: order.id,
      data: order,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
    width: `${(order.estimatedDuration || 60) * PIXELS_PER_MINUTE}px`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      <div
        className={cn("h-12 rounded-md px-2 flex flex-col justify-center cursor-move bg-primary text-primary-foreground", className)}
      >
        <p className="text-xs font-semibold truncate pointer-events-none">
          {order.taskDetails}
        </p>
        <p className="text-xs opacity-80 truncate pointer-events-none">
          @{customer?.storeName || order.customerCode}
        </p>
      </div>
    </div>
  );
};

type DialogState = 
  | { mode: 'closed' }
  | { mode: 'edit'; event: ScheduleEvent }
  | { mode: 'new'; staffId: string; start: Date };

type EditedEventDetails = {
    title: string;
    startTime: string;
    endTime: string;
};

// --- Main Component ---

export function ScheduleView() {
  const [isClient, setIsClient] = React.useState(false);
  const [customerData] = React.useState<Customer[]>(staticCustomerData);
  const [scheduleData, setScheduleData] = React.useState<ScheduleEvent[]>(staticScheduleData);
  const [unassignedOrders, setUnassignedOrders] = React.useState<Order[]>(staticOrderData);
  
  const [dialogState, setDialogState] = React.useState<DialogState>({ mode: 'closed' });
  
  const [editedEventDetails, setEditedEventDetails] = React.useState<EditedEventDetails>({
    title: '',
    startTime: '',
    endTime: '',
  });


  const genericTasks: Order[] = [
      { id: 'generic-travel', customerCode: '', taskDetails: '移動', estimatedDuration: 30 },
      { id: 'generic-work', customerCode: '', taskDetails: '業務', estimatedDuration: 60 },
  ];

  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  const getCustomerByCode = (code: string | undefined): Customer | undefined => customerData?.find(c => c.userCode === code);
  const getCustomerById = (id: string | undefined): Customer | undefined => customerData?.find(c => c.id === id);

  const [activeItem, setActiveItem] = React.useState<ScheduleEvent | Order | null>(null);
  const [currentOverStaffId, setCurrentOverStaffId] = React.useState<UniqueIdentifier | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current as ScheduleEvent | Order;
    setActiveItem(item);
  };

  const handleDragOver = (event: DragOverEvent) => {
     const { over } = event;
     setCurrentOverStaffId(over ? over.id : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta, over } = event;
    const item = active.data.current as ScheduleEvent | Order;
    
    if (!item) return;
    
    const newStaffId = over?.id as string | undefined;

    // --- Logic for moving existing events ---
    if ('staffId' in item && 'start' in item) {
      const eventToUpdate = item;
      const dragMinutes = pixelsToMinutes(delta.x);
      
      const originalStart = eventToUpdate.start instanceof Date ? eventToUpdate.start : parseISO(eventToUpdate.start);
      const originalEnd = eventToUpdate.end instanceof Date ? eventToUpdate.end : parseISO(eventToUpdate.end);

      const newStart = addMinutes(originalStart, dragMinutes);
      const newEnd = addMinutes(originalEnd, dragMinutes);
      
      const finalStaffId = newStaffId || eventToUpdate.staffId;

      const updatedEvent: ScheduleEvent = {
        ...eventToUpdate,
        staffId: finalStaffId,
        start: newStart,
        end: newEnd,
      };

      setScheduleData(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
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

        if (isGeneric) {
             const newStart = addMinutes(startOfDay, dropMinutes);
             const newEnd = addMinutes(newStart, order.estimatedDuration);
             const newEvent: ScheduleEvent = {
                id: `event-${Date.now()}`,
                title: order.id === 'generic-travel' ? `移動: ` : order.taskDetails,
                staffId: newStaffId,
                locationId: '',
                start: newStart,
                end: newEnd,
             };
             setScheduleData(prev => [...prev, newEvent]);
        } else {
            // This is a customer order, so add travel time
            const taskStart = addMinutes(startOfDay, dropMinutes);
            const taskEnd = addMinutes(taskStart, order.estimatedDuration);
            const travelStart = subMinutes(taskStart, TRAVEL_TIME_MINUTES);
            const customer = getCustomerByCode(order.customerCode);
            const tripId = `trip-${Date.now()}`;

            const travelEvent: ScheduleEvent = {
                id: `event-${Date.now()}-travel`,
                tripId: tripId,
                title: `移動: ${customer?.storeName || order.customerCode}`,
                staffId: newStaffId,
                locationId: customer?.id || '',
                start: travelStart,
                end: taskStart,
            };

            const taskEvent: ScheduleEvent = {
                id: `event-${Date.now()}-task`,
                tripId: tripId,
                orderId: order.id,
                title: order.taskDetails,
                staffId: newStaffId,
                locationId: customer?.id || '',
                start: taskStart,
                end: taskEnd,
            };

            setScheduleData(prev => [...prev, travelEvent, taskEvent]);
            setUnassignedOrders(prev => prev.filter(o => o.id !== order.id));
        }
    }

    setActiveItem(null);
    setCurrentOverStaffId(null);
  };

  const handleDoubleClickEvent = (event: ScheduleEvent) => {
    setEditedEventDetails({
        title: event.title || '',
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

    setEditedEventDetails({ title: '', startTime: formatTime(newStart), endTime: formatTime(addMinutes(newStart, 60)) });
    setDialogState({ mode: 'new', staffId, start: newStart });
  };
  
  const handleSaveEvent = () => {
    if (dialogState.mode === 'closed') return;
    
    const today = new Date();
    const parseTime = (timeStr: string) => {
        return parse(timeStr, 'HH:mm', today);
    };

    if (dialogState.mode === 'new') {
        const newEvent: ScheduleEvent = {
            id: `event-${Date.now()}`,
            title: editedEventDetails.title,
            staffId: dialogState.staffId,
            locationId: '',
            start: parseTime(editedEventDetails.startTime),
            end: parseTime(editedEventDetails.endTime),
        };
        setScheduleData(prev => [...prev, newEvent]);
    } else if (dialogState.mode === 'edit') {
        const updatedEvent: ScheduleEvent = {
            ...dialogState.event,
            title: editedEventDetails.title,
            start: parseTime(editedEventDetails.startTime),
            end: parseTime(editedEventDetails.endTime),
        };
        setScheduleData(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    }
    setDialogState({ mode: 'closed' });
  };


  const handleDeleteEvent = () => {
    if (dialogState.mode !== 'edit') return;
    const eventToDelete = dialogState.event;

    // If the event is part of a trip, delete both travel and task
    if (eventToDelete.tripId) {
        setScheduleData(prev => prev.filter(e => e.tripId !== eventToDelete.tripId));
    } else {
        setScheduleData(prev => prev.filter(e => e.id !== eventToDelete.id));
    }

    // If the deleted event was from an order, add it back to unassigned orders
    const orderId = eventToDelete.orderId || (scheduleData.find(e => e.tripId === eventToDelete.tripId && e.orderId))?.orderId;
    if (orderId) {
        const originalOrder = staticOrderData.find(o => o.id === orderId);
        if (originalOrder && !unassignedOrders.find(o => o.id === originalOrder.id)) {
            setUnassignedOrders(prev => [...prev, originalOrder]);
        }
    }
    setDialogState({ mode: 'closed' });
  };
  
  const getDialogDetails = () => {
    if (dialogState.mode === 'edit') {
      const { event } = dialogState;
      const staff = staffData.find(s => s.id === event.staffId);
      const customer = getCustomerById(event.locationId);
      return { event, staff, customer, title: '予定の編集' };
    }
    if (dialogState.mode === 'new') {
      const staff = staffData.find(s => s.id === dialogState.staffId);
      return { staff, start: dialogState.start, title: '新規予定の作成' };
    }
    return { title: '' };
  };

  const { event, staff, customer, start, title } = getDialogDetails();


  const content = (
    <>
      <Card className="h-full">
        <CardHeader>
          <CardTitle>本日のスケジュール</CardTitle>
          <CardDescription>タスクを下のタイムラインにドラッグして割り当てます。空白部分をダブルクリックして新規作成もできます。</CardDescription>
          <div className="pt-4">
               <CardTitle className="text-lg mb-2">ドラッグ可能なタスク</CardTitle>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="pr-4">
                  <div className="flex flex-wrap gap-2">
                    {genericTasks.map((task) => (
                       <DraggableOrder
                          key={task.id}
                          order={task}
                          className={task.id === 'generic-travel' ? 'bg-yellow-500 text-black' : 'bg-gray-400 text-white'}
                        />
                    ))}
                    {unassignedOrders.map((order) => (
                      <DraggableOrder
                        key={order.id}
                        order={order}
                        customer={getCustomerByCode(order.customerCode)}
                      />
                    ))}
                    {unassignedOrders.length === 0 && genericTasks.length === 0 && (
                      <div className="flex items-center justify-center h-24 text-center text-muted-foreground">
                          <p>利用可能なタスクはありません。</p>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 select-none h-[calc(100%-14rem)] overflow-y-auto pr-6">
          <div className="grid sticky top-0 bg-card py-2" style={{ gridTemplateColumns: '8rem 1fr' }}>
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
            <TooltipProvider>
              {(staffData || []).map((staff) => (
                <StaffRow
                  key={staff.id}
                  staff={staff}
                  events={(scheduleData || []).filter(e => e.staffId === staff.id)}
                  getCustomer={getCustomerById}
                  isOver={currentOverStaffId === staff.id}
                  onDoubleClickEvent={handleDoubleClickEvent}
                  onDoubleClickTimeline={handleDoubleClickTimeline}
                />
              ))}
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
      
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
    </>
  );

  if (!isClient) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>本日のスケジュール</CardTitle>
          <CardDescription>各スタッフのタイムライン形式のスケジュールです。ドラッグ＆ドロップで予定を編集できます。</CardDescription>
        </CardHeader>
        <CardContent>
           {/* Skeleton loader can be placed here */}
        </CardContent>
      </Card>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
      {content}
    </DndContext>
  );
}


// --- Sub-components ---

interface StaffRowProps {
  staff: Staff;
  events: ScheduleEvent[];
  getCustomer: (id: string | undefined) => Customer | undefined;
  isOver: boolean;
  onDoubleClickEvent: (event: ScheduleEvent) => void;
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
  event: ScheduleEvent;
  staff: Staff;
  getCustomer: (id: string | undefined) => Customer | undefined;
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

  const isTravelEvent = event.title?.startsWith('移動:');
  
  let backgroundColor = staff.color;
  let color = 'white';

  if (isTravelEvent) {
    const hslMatch = staff.color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslMatch) {
      const [_, h] = hslMatch;
      backgroundColor = `hsl(${h}, 20%, 50%)`;
      color = 'white';
    } else {
      backgroundColor = 'hsl(210, 14%, 88%)'; // Muted color fallback
      color = 'hsl(var(--foreground))';
    }
  }


  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onDoubleClick={handleDoubleClick}
          className="absolute h-12 rounded-md px-2 flex items-center cursor-move"
          style={{
            ...style,
            backgroundColor,
            color,
          }}
        >
          <p className="text-xs font-semibold truncate pointer-events-none">
            {event.title || '未定のタスク'} {customer ? `@ ${customer.storeName}` : ''}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-bold">{event.title || '未定のタスク'}</p>
        <p>顧客: {customer?.storeName || '未定'}</p>
        <p>時間: {formatTime(event.start)} - {formatTime(event.end)}</p>
        <p>担当: {staff.name}</p>
      </TooltipContent>
    </Tooltip>
  );
};

    
    