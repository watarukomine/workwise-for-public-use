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
import { useCollection, useMemoFirebase, useUser } from '@/firebase';
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
import { collection, doc, getFirestore, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { addMinutes, differenceInMinutes, format, parseISO } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { staffData } from '@/lib/data';

const hours = Array.from({ length: 11 }, (_, i) => 8 + i); // 8:00 to 18:00
const timeSlots = Array.from({ length: 21 }, (_, i) => 8 + i * 0.5); // 8:00 to 18:00, 30min increments

const PIXELS_PER_MINUTE = 2;
const timelineStartHour = 8;

// --- Helper Functions ---

const formatTime = (date: Date) => {
  return format(date, 'HH:mm');
};

const minutesToPixels = (minutes: number) => minutes * PIXELS_PER_MINUTE;

const pixelsToMinutes = (pixels: number) => Math.round(pixels / PIXELS_PER_MINUTE / 15) * 15;

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
  const { user, isLoading: isUserLoading } = useUser();

  const customersCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'customers') : null),
    [firestore, user]
  );
  const { data: customerData, isLoading: isLoadingCustomers } = useCollection<Customer>(customersCollection);

  const workSchedulesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'workSchedules') : null),
    [firestore, user]
  );
  const { data: scheduleData, isLoading: isLoadingSchedules } = useCollection<ScheduleEvent>(workSchedulesCollection);
  
  const getCustomerByCode = (code: string | undefined): Customer | undefined => customerData?.find(c => c.userCode === code);
  const getCustomerById = (id: string | undefined): Customer | undefined => customerData?.find(c => c.id === id);

  const [activeItem, setActiveItem] = React.useState<ScheduleEvent | Order | null>(null);
  const [currentOverStaffId, setCurrentOverStaffId] = React.useState<UniqueIdentifier | null>(null);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current as ScheduleEvent | Order;
    setActiveItem(item);
    
    // Check if the dragged item is a new Order from the unassigned list
    if (item && 'estimatedDuration' in item) {
       const node = event.active.node.parent?.children[0]?.node.current;
      if (node) {
        const rect = node.getBoundingClientRect();
        // Capture the offset from the cursor to the left edge of the item
        const offsetX = event.activatorEvent.clientX - rect.left;
        setDragOffset({ x: offsetX, y: 0 });
      }
    } else {
      // It's an existing ScheduleEvent, no offset needed
      setDragOffset({ x: 0, y: 0 });
    }
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
          
          updateDoc(eventRef, updatedData).catch((serverError) => {
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
      }
    }
    // --- Logic for adding new orders as events ---
    else if ('estimatedDuration' in item && newStaffId && over?.rect) {
        const order = item;
        const timelineRect = over.rect;
        // Adjust drop position by the initial cursor offset within the dragged item
        const dropX = event.activatorEvent.clientX - timelineRect.left - dragOffset.x;
        
        const dropMinutes = pixelsToMinutes(dropX);

        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(timelineStartHour, 0, 0, 0);

        const newStart = addMinutes(startOfDay, dropMinutes);
        const newEnd = addMinutes(newStart, order.estimatedDuration);
        const customer = getCustomerByCode(order.customerCode);

        if (!customer) {
            console.error("Could not find customer for order", order);
            return;
        }

        const newEvent: Omit<ScheduleEvent, 'id'> = {
            title: order.taskDetails,
            staffId: newStaffId,
            locationId: customer.id,
            start: newStart.toISOString(),
            end: newEnd.toISOString(),
        };

        try {
            if (!firestore) throw new Error("Firestore not initialized");
            const schedulesRef = collection(firestore, 'workSchedules');
            const orderRef = doc(firestore, 'orders', order.id);

            // This should be a transaction in a real app,
            // but for simplicity, we'll do it sequentially.
            addDoc(schedulesRef, newEvent).catch(e => {
                const permissionError = new FirestorePermissionError({ path: schedulesRef.path, operation: 'create', requestResourceData: newEvent });
                errorEmitter.emit('permission-error', permissionError);
                throw permissionError;
            });

            deleteDoc(orderRef).catch(e => {
                const permissionError = new FirestorePermissionError({ path: orderRef.path, operation: 'delete' });
                errorEmitter.emit('permission-error', permissionError);
                throw permissionError;
            });

        } catch (error) {
            console.error("Failed to create event from order:", error);
        }
    }

    setActiveItem(null);
    setCurrentOverStaffId(null);
  };

  const isLoading = isUserLoading || isLoadingCustomers || isLoadingSchedules;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
      <Card className="h-full">
        <CardHeader>
          <CardTitle>本日のスケジュール</CardTitle>
          <CardDescription>各スタッフのタイムライン形式のスケジュールです。ドラッグ＆ドロップで予定を編集できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 select-none h-[calc(100%-4rem)] overflow-y-auto pr-6">
          {isLoading ? (
             Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="grid items-center" style={{ gridTemplateColumns: '8rem 1fr' }}>
                <div className="flex items-center gap-2 pr-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-12 w-full" />
              </div>
            ))
          ) : (
            <>
              <div className="grid sticky top-0 bg-card z-10 py-2" style={{ gridTemplateColumns: '8rem 1fr' }}>
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
                      getCustomer={getCustomerById}
                      isOver={currentOverStaffId === staff.id}
                    />
                  ))}
                </TooltipProvider>
              </div>
            </>
          )}
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
     <div ref={setNodeRef} className="grid items-center transition-colors duration-200 rounded-md" style={{ gridTemplateColumns: '8rem 1fr', backgroundColor: isOver ? 'hsl(var(--accent))' : 'transparent' }}>
      <div className="flex items-center gap-2 pr-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={staff.avatarUrl} alt={staff.name} />
          <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium truncate">{staff.name}</span>
      </div>
      <div className="relative h-14 bg-muted/50 rounded-md border-l border-border">
        <div className="absolute inset-0 grid grid-cols-22">
          {timeSlots.slice(0, -1).map((_, i) => (
            <div key={i} className={`h-full ${i % 2 === 0 ? 'border-r border-border/80' : 'border-r border-dashed border-border/40'}`}></div>
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
        <p>時間: {formatTime(parseISO(event.start))} - {formatTime(parseISO(event.end))}</p>
        <p>担当: {staff.name}</p>
      </TooltipContent>
    </Tooltip>
  );
};
