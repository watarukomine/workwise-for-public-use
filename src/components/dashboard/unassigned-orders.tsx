'use client';
import * as React from 'react';
import { useCollection, useMemoFirebase } from '@/firebase';
import type { Order, Customer } from '@/lib/types';
import { collection, getFirestore } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DraggableOrderProps {
  order: Order;
  customer?: Customer;
}

const DraggableOrder: React.FC<DraggableOrderProps> = ({ order, customer }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: order.id,
      data: order,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
    width: '120px', // 1 hour on the timeline (60 mins * 2px/min)
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="touch-none"
    >
      <div
        className="h-12 rounded-md px-2 flex flex-col justify-center cursor-move bg-primary text-primary-foreground"
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

export function UnassignedOrders() {
  const firestore = getFirestore();

  const ordersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'orders') : null),
    [firestore]
  );
  const { data: ordersData, isLoading: isLoadingOrders } =
    useCollection<Order>(ordersCollection);

  const customersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customersData, isLoading: isLoadingCustomers } =
    useCollection<Customer>(customersCollection);

  const getCustomerByCode = (code: string) => {
    return customersData?.find((c) => c.userCode === code);
  };

  const isLoading = isLoadingOrders || isLoadingCustomers;

  return (
    <Card>
      <CardHeader>
        <CardTitle>未割り当ての受注</CardTitle>
        <CardDescription>
          受注をタイムラインにドラッグして割り当てます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="pr-4">
            {isLoading ? (
              <div className="flex gap-2">
                <Skeleton className="h-12 w-[120px]" />
                <Skeleton className="h-12 w-[120px]" />
                <Skeleton className="h-12 w-[120px]" />
              </div>
            ) : ordersData && ordersData.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {ordersData.map((order) => (
                  <DraggableOrder
                    key={order.id}
                    order={order}
                    customer={getCustomerByCode(order.customerCode)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-center text-muted-foreground">
                <p>未割り当ての受注はありません。</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
