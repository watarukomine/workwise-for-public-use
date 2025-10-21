import { customerData } from "@/lib/data";
import { CustomerTable } from "@/components/customers/customer-table";

export default function CustomersPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customer Directory</h1>
        <p className="text-muted-foreground">
          Manage and search your list of customers.
        </p>
      </div>
      <CustomerTable customers={customerData} />
    </div>
  );
}
