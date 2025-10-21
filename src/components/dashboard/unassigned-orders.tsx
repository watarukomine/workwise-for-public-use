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
import { GripVertical } from 'lucide-react';
import { CSS } from '@dnd-kit/utilities';


interface DraggableOrderProps {
    order: Order;
    customer?: Customer;
}

const DraggableOrder: React.FC<DraggableOrderProps> = ({ order, customer }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: order.id,
        data: order,
    });
    
    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 100 : 1,
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="touch-none">
            <Card className="mb-2 bg-white dark:bg-card">
                <CardContent className="p-3">
                    <div className="flex items-start">
                        <div {...listeners} {...attributes} className="cursor-grab p-2 -ml-2 mt-1">
                           <GripVertical className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold">{order.taskDetails}</p>
                            <p className="text-sm text-muted-foreground">
                                {customer?.storeName || order.customerCode}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                作業時間(目安): {order.estimatedDuration}分
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};


export function UnassignedOrders() {
  const firestore = getFirestore();

  const ordersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'orders') : null),
    [firestore]
  );
  const { data: ordersData, isLoading: isLoadingOrders } = useCollection<Order>(ordersCollection);

  const customersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customersData, isLoading: isLoadingCustomers } = useCollection<Customer>(customersCollection);

  const getCustomerByCode = (code: string) => {
    return customersData?.find(c => c.userCode === code);
  };
  
  const isLoading = isLoadingOrders || isLoadingCustomers;

  return (
    <Card>
      <CardHeader>
        <CardTitle>未割り当ての受注</CardTitle>
        <CardDescription>受注をタイムラインにドラッグして割り当てます。</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="pr-4">
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            ) : ordersData && ordersData.length > 0 ? (
                ordersData.map(order => (
                    <DraggableOrder 
                        key={order.id} 
                        order={order}
                        customer={getCustomerByCode(order.customerCode)}
                    />
                ))
            ) : (
              <div className="flex items-center justify-center h-48 text-center text-muted-foreground">
                <p>未割り当ての受注はありません。</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
