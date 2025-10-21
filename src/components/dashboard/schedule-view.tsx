import { scheduleData, staffData, customerData } from '@/lib/data';
import type { ScheduleEvent, Staff, Customer } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const getStaff = (id: string): Staff | undefined => staffData.find(s => s.id === id);
const getCustomer = (id: string): Customer | undefined => customerData.find(c => c.id === id);

export function ScheduleView() {
  const events: ScheduleEvent[] = scheduleData;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work Assignments</CardTitle>
        <CardDescription>All jobs scheduled for today.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Assigned Staff</TableHead>
              <TableHead>Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const staff = getStaff(event.staffId);
              const customer = getCustomer(event.customerId);

              if (!staff || !customer) return null;

              return (
                <TableRow key={event.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {formatTime(event.start)} - {formatTime(event.end)}
                  </TableCell>
                  <TableCell>{event.title}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={staff.avatarUrl} alt={staff.name} data-ai-hint="person" />
                        <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{staff.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{customer.name}</span>
                      <span className="text-muted-foreground text-sm">{customer.address}</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
