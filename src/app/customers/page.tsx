
'use client';

import { CustomerTable } from '@/components/customers/customer-table';
import { customerData } from '@/lib/data';
import type { Customer } from '@/lib/types';
import React from 'react';

export default function CustomersPage() {
  const [customers] = React.useState<Customer[]>(customerData);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customer Directory</h1>
        <p className="text-muted-foreground">
          Manage and search your list of customers.
        </p>
      </div>
      <CustomerTable customers={customers} isLoading={false} />
    </div>
  );
}
