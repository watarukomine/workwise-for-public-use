
'use client';
import * as React from 'react';
import type { Order, Customer } from '@/lib/types';
import { orderData, customerData } from '@/lib/data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

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
    width: `${order.estimatedDuration * PIXELS_PER_MINUTE}px`,
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

const PIXELS_PER_MINUTE = 2;

const genericTasks: Order[] = [
    { id: 'generic-travel', customerCode: '', taskDetails: '移動', estimatedDuration: 60 },
    { id: 'generic-work', customerCode: '', taskDetails: '業務', estimatedDuration: 60 },
];

export function UnassignedOrders() {
  const orders: Order[] = orderData;
  const customers: Customer[] = customerData;

  const getCustomerByCode = (code: string) => {
    return customers?.find((c) => c.userCode === code);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ドラッグ可能なタスク</CardTitle>
        <CardDescription>
          タスクを下のタイムラインにドラッグして割り当てます。
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              {orders.map((order) => (
                <DraggableOrder
                  key={order.id}
                  order={order}
                  customer={getCustomerByCode(order.customerCode)}
                />
              ))}
              {orders.length === 0 && genericTasks.length === 0 && (
                <div className="flex items-center justify-center h-24 text-center text-muted-foreground">
                    <p>利用可能なタスクはありません。</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
