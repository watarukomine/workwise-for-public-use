'use client';

import { useCollection, useMemoFirebase, useUser } from '@/firebase';
import { CustomerTable } from '@/components/customers/customer-table';
import type { Customer } from '@/lib/types';
import { collection, getFirestore } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function CustomersPage() {
  const firestore = getFirestore();
  const { user, isLoading: isUserLoading } = useUser();

  const customersCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'customers') : null),
    [firestore, user]
  );
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersCollection);

  const isLoading = isUserLoading || isLoadingCustomers;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customer Directory</h1>
        <p className="text-muted-foreground">
          Manage and search your list of customers.
        </p>
      </div>
      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : (
        <CustomerTable customers={customers || []} />
      )}
    </div>
  );
}
