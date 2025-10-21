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
import { useCollection, useMemoFirebase } from '@/firebase';
import type { ScheduleEvent, Staff, Customer } from '@/lib/types';
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
import { collection, doc, getFirestore, updateDoc } from 'firebase/firestore';
import { addMinutes, differenceInMinutes, format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

const hours = Array.from({ length: 11 }, (_, i) => 8 + i); // 8:00 to 18:00
const PIXELS_PER_MINUTE = 2;
const timelineStartHour = 8;
const timelineEndHour = 18;

// --- Helper Functions ---

const formatTime = (date: Date) => {
  return format(date, 'HH:mm');
};

const minutesToPixels = (minutes: number) => minutes * PIXELS_PER_MINUTE;

const pixelsToMinutes = (pixels: number) => pixels / PIXELS_PER_MINUTE;

const getEventDimensions = (event: ScheduleEvent) => {
  const start = parseISO(event.start);
  const end = parseISO(event.end);
  const startOfDay = new Date(start);
  startOfDay.setHours(timelineStartHour, 0, 0, 0);

  const left = differenceInMinutes(start, startOfDay);
  const width = differenceInMinutes(end, start);

  return {
    left: minutesToPixels(left),
    width: minutesToPixels(width),
  };
};

// --- Main Component ---

export function ScheduleView() {
  const firestore = getFirestore();

  const staffCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'staff') : null),
    [firestore]
  );
  const { data: staffData, isLoading: isLoadingStaff } = useCollection<Staff>(staffCollection);

  const customersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customerData, isLoading: isLoadingCustomers } = useCollection<Customer>(customersCollection);

  const workSchedulesCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'workSchedules') : null),
    [firestore]
  );
  const { data: scheduleData, isLoading: isLoadingSchedules } = useCollection<ScheduleEvent>(workSchedulesCollection);
  
  const getCustomer = (id: string | undefined): Customer | undefined => customerData?.find(c => c.id === id);

  const [activeEvent, setActiveEvent] = React.useState<ScheduleEvent | null>(null);
  const [currentOverStaffId, setCurrentOverStaffId] = React.useState<UniqueIdentifier | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveEvent(event.active.data.current as ScheduleEvent);
  };

  const handleDragOver = (event: DragOverEvent) => {
     const { over } = event;
     setCurrentOverStaffId(over ? over.id : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta, over } = event;
    const eventToUpdate = active.data.current as ScheduleEvent;
    
    if (!eventToUpdate) return;
    
    const newStaffId = over?.id as string | undefined;
    const dragMinutes = pixelsToMinutes(delta.x);
    
    const newStart = addMinutes(parseISO(eventToUpdate.start), dragMinutes);
    const newEnd = addMinutes(parseISO(eventToUpdate.end), dragMinutes);
    
    const finalStaffId = newStaffId || eventToUpdate.staffId;

    const updatedData: Partial<ScheduleEvent> = {
      staffId: finalStaffId,
      start: newStart.toISOString(),
      end: newEnd.toISOString(),
    };

    try {
        if (!firestore) throw new Error("Firestore not initialized");
        const eventRef = doc(firestore, 'workSchedules', eventToUpdate.id);
        
        await updateDoc(eventRef, updatedData).catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: eventRef.path,
            operation: 'update',
            requestResourceData: updatedData,
          });
          errorEmitter.emit('permission-error', permissionError);
          throw permissionError;
        });

    } catch (error) {
        console.error("Failed to update event:", error);
    } finally {
        setActiveEvent(null);
        setCurrentOverStaffId(null);
    }
  };


  const isLoading = isLoadingStaff || isLoadingCustomers || isLoadingSchedules;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid items-center" style={{ gridTemplateColumns: '8rem 1fr' }}>
              <div className="flex items-center gap-2 pr-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
      <Card>
        <CardHeader>
          <CardTitle>本日のスケジュール</CardTitle>
          <CardDescription>各スタッフのタイムライン形式のスケジュールです。ドラッグ＆ドロップで予定を編集できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 select-none">
          <div className="grid" style={{ gridTemplateColumns: '8rem 1fr' }}>
            <div />
            <div className="relative grid grid-cols-11 border-l border-border text-xs text-muted-foreground">
              {hours.map((hour) => (
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
                  getCustomer={getCustomer}
                  isOver={currentOverStaffId === staff.id}
                />
              ))}
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </DndContext>
  );
}


// --- Sub-components ---

interface StaffRowProps {
  staff: Staff;
  events: ScheduleEvent[];
  getCustomer: (id: string | undefined) => Customer | undefined;
  isOver: boolean;
}

const StaffRow: React.FC<StaffRowProps> = ({ staff, events, getCustomer, isOver }) => {
  const { setNodeRef } = useDroppable({ id: staff.id });

  return (
     <div ref={setNodeRef} className="grid items-center transition-colors duration-200" style={{ gridTemplateColumns: '8rem 1fr', backgroundColor: isOver ? 'hsl(var(--accent))' : 'transparent' }}>
      <div className="flex items-center gap-2 pr-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={staff.avatarUrl} alt={staff.name} />
          <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium truncate">{staff.name}</span>
      </div>
      <div className="relative h-12 bg-muted/50 rounded-md border-l border-border">
        <div className="absolute inset-0 grid grid-cols-11">
          {hours.slice(0, -1).map((_, i) => (
            <div key={i} className="border-r border-border/80 h-full"></div>
          ))}
        </div>
        <div className="absolute inset-0 h-full p-1">
          {events.map((event) => (
            <DraggableEvent key={event.id} event={event} staff={staff} getCustomer={getCustomer} />
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
}

const DraggableEvent: React.FC<DraggableEventProps> = ({ event, staff, getCustomer }) => {
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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          className="absolute h-10 rounded-md px-2 flex items-center cursor-move"
          style={{
            ...style,
            backgroundColor: staff.color,
            color: 'white',
          }}
        >
          <p className="text-xs font-semibold truncate pointer-events-none">
            {event.title || '未定のタスク'} @ {customer?.店舗 || '未定'}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-bold">{event.title || '未定のタask'}</p>
        <p>顧客: {customer?.店舗}</p>
        <p>時間: {formatTime(parseISO(event.start))} - {formatTime(parseISO(event.end))}</p>
        <p>担当: {staff.name}</p>
      </TooltipContent>
    </Tooltip>
  );
};
