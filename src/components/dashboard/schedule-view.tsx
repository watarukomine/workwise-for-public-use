import { scheduleData, staffData, customerData } from '@/lib/data';
import type { ScheduleEvent, Staff, Customer } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const getStaff = (id: string): Staff | undefined => staffData.find(s => s.id === id);
const getCustomer = (id: string): Customer | undefined => customerData.find(c => c.id === id);

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('ja-JP', { hour: 'numeric', minute: '2-digit' });
}

export function ScheduleView() {
  const events: ScheduleEvent[] = scheduleData;

  return (
    <Card>
      <CardHeader>
        <CardTitle>本日のスケジュール</CardTitle>
        <CardDescription>本日予定されている全ての作業一覧です。</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>時間</TableHead>
              <TableHead>タスク</TableHead>
              <TableHead>担当スタッフ</TableHead>
              <TableHead>場所</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const staff = getStaff(event.staffId);
              const customer = getCustomer(event.customerId);

              return (
                <TableRow key={event.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {formatTime(event.start)} - {formatTime(event.end)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{event.title || '未定のタスク'}</span>
                      <span className="text-sm text-muted-foreground">{event.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {staff ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={staff.avatarUrl} alt={staff.name} data-ai-hint="person" />
                          <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{staff.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">未割り当て</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {customer ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{customer.name}</span>
                        <span className="text-muted-foreground text-sm">{customer.address}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">未定</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {events.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  本日の予定はありません。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
