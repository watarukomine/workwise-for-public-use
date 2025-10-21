
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
import { addMinutes, differenceInMinutes, format, parseISO } from 'date-fns';
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

// --- Helper Functions ---
const formatTime = (date: Date | string) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm');
};

const minutesToPixels = (minutes: number) => minutes * PIXELS_PER_MINUTE;

const pixelsToMinutes = (pixels: number) => Math.round(pixels / PIXELS_PER_MINUTE / 15) * 15;

const getEventDimensions = (event: ScheduleEvent) => {
  const start = event.start instanceof Date ? event.start : parseISO(event.start);
  const end = event.end instanceof Date ? event.end : parseISO(event.end);
  const startOfDay = new Date(start);
  startOfDay.setHours(timelineStartHour, 0, 0, 0);

  const left = differenceInMinutes(start, startOfDay);
  const width = differenceInMinutes(end, start);

  return {
    left: minutesToPixels(left),
    width: minutesToPixels(width),
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

// --- Main Component ---

export function ScheduleView() {
  const [isClient, setIsClient] = React.useState(false);
  const [customerData] = React.useState<Customer[]>(staticCustomerData);
  const [scheduleData, setScheduleData] = React.useState<ScheduleEvent[]>(staticScheduleData);
  const [unassignedOrders, setUnassignedOrders] = React.useState<Order[]>(staticOrderData);
  
  const [dialogState, setDialogState] = React.useState<DialogState>({ mode: 'closed' });
  const [newEventTitle, setNewEventTitle] = React.useState('');


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

        const newStart = addMinutes(startOfDay, dropMinutes);
        const newEnd = addMinutes(newStart, order.estimatedDuration);
        const customer = getCustomerByCode(order.customerCode);
        const isGeneric = order.id.startsWith('generic-');

        const newEvent: ScheduleEvent = {
            id: `event-${Date.now()}`,
            orderId: isGeneric ? undefined : order.id,
            title: order.taskDetails,
            staffId: newStaffId,
            locationId: customer?.id || '',
            start: newStart,
            end: newEnd,
        };

        setScheduleData(prev => [...prev, newEvent]);

        if (!isGeneric) {
          setUnassignedOrders(prev => prev.filter(o => o.id !== order.id));
        }
    }

    setActiveItem(null);
    setCurrentOverStaffId(null);
  };

  const handleDoubleClickEvent = (event: ScheduleEvent) => {
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

    setNewEventTitle('');
    setDialogState({ mode: 'new', staffId, start: newStart });
  };
  
  const handleSaveNewEvent = () => {
    if (dialogState.mode !== 'new' || !newEventTitle) return;
    
    const newEvent: ScheduleEvent = {
      id: `event-${Date.now()}`,
      title: newEventTitle,
      staffId: dialogState.staffId,
      locationId: '',
      start: dialogState.start,
      end: addMinutes(dialogState.start, 60), // Default to 60 mins
    };

    setScheduleData(prev => [...prev, newEvent]);
    setDialogState({ mode: 'closed' });
  };

  const handleDeleteEvent = () => {
    if (dialogState.mode !== 'edit') return;
    const eventToDelete = dialogState.event;

    setScheduleData(prev => prev.filter(e => e.id !== eventToDelete.id));

    if (eventToDelete.orderId) {
        const originalOrder = staticOrderData.find(o => o.id === eventToDelete.orderId);
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
      return { event, staff, customer };
    }
    if (dialogState.mode === 'new') {
      const staff = staffData.find(s => s.id === dialogState.staffId);
      return { staff, start: dialogState.start };
    }
    return {};
  };

  const { event, staff, customer, start } = getDialogDetails();


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
          <div className="grid sticky top-0 bg-card py-2 z-10" style={{ gridTemplateColumns: '8rem 1fr' }}>
            <div />
            <div className="relative grid border-l border-border text-xs text-muted-foreground" style={{ gridTemplateColumns: `repeat(${timelineTotalHours}, 1fr)` }}>
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
            <DialogTitle>{dialogState.mode === 'edit' ? '予定の編集' : '新規予定の作成'}</DialogTitle>
             <DialogDescription>
                {dialogState.mode === 'edit' ? 'この予定を削除しますか？' : '新しい予定の詳細を入力してください。'}
            </DialogDescription>
          </DialogHeader>

          {dialogState.mode === 'edit' && event && (
            <div className="text-sm space-y-2">
              <p><span className="font-semibold">タスク:</span> {event.title}</p>
              <p><span className="font-semibold">顧客:</span> {customer?.storeName || 'N/A'}</p>
              <p><span className="font-semibold">時間:</span> {formatTime(event.start)} - {formatTime(event.end)}</p>
              <p><span className="font-semibold">担当:</span> {staff?.name || 'N/A'}</p>
            </div>
          )}
          
          {dialogState.mode === 'new' && (
            <div className="space-y-4 py-4">
                <div className="text-sm space-y-2">
                    <p><span className="font-semibold">担当:</span> {staff?.name}</p>
                    <p><span className="font-semibold">開始時間:</span> {start ? formatTime(start) : 'N/A'}</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="event-title">タスク名</Label>
                    <Input 
                        id="event-title" 
                        value={newEventTitle} 
                        onChange={(e) => setNewEventTitle(e.target.value)} 
                        placeholder="例：定期メンテナンス"
                    />
                </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline">キャンセル</Button>
            </DialogClose>
            {dialogState.mode === 'edit' && (
                <Button variant="destructive" onClick={handleDeleteEvent}>削除</Button>
            )}
             {dialogState.mode === 'new' && (
                <Button onClick={handleSaveNewEvent} disabled={!newEventTitle}>保存</Button>
            )}
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
        <div className="absolute inset-0 grid" style={{gridTemplateColumns: `repeat(${timelineTotalHours * 2}, 1fr)`}}>
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
  const { left, width } = getEventDimensions(event);

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
            backgroundColor: staff.color,
            color: 'white',
          }}
        >
          <p className="text-xs font-semibold truncate pointer-events-none">
            {event.title || '未定のタスク'} @ {customer?.storeName || '未定'}
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

