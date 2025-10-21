import { StaffTable } from "@/components/staff/staff-table";

export default function StaffPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Staff Roster</h1>
        <p className="text-muted-foreground">
          View and manage your team members.
        </p>
      </div>
      <StaffTable />
    </div>
  );
}
