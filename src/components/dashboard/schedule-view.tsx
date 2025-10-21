import { scheduleData, staffData, customerData } from '@/lib/data';
import type { ScheduleEvent, Staff, Customer } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const getStaff = (id: string): Staff | undefined => staffData.find(s => s.id === id);
const getCustomer = (id: string): Customer | undefined => customerData.find(c => c.id === id);

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('ja-JP', { hour: 'numeric', minute: '2-digit' });
};

const hours = Array.from({ length: 11 }, (_, i) => 8 + i); // 8:00 to 18:00

export function ScheduleView() {
  const events: ScheduleEvent[] = scheduleData;
  const timelineStartHour = 8;
  const timelineEndHour = 18;
  const totalHours = timelineEndHour - timelineStartHour;

  const calculateEventStyle = (event: ScheduleEvent) => {
    const start = event.start;
    const end = event.end;
    
    const startMinutes = (start.getHours() - timelineStartHour) * 60 + start.getMinutes();
    const endMinutes = (end.getHours() - timelineStartHour) * 60 + end.getMinutes();

    const totalMinutes = totalHours * 60;

    const left = (startMinutes / totalMinutes) * 100;
    const width = ((endMinutes - startMinutes) / totalMinutes) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - Math.max(0, left), width)}%`,
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>本日のスケジュール</CardTitle>
        <CardDescription>各スタッフのタイムライン形式のスケジュールです。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid" style={{ gridTemplateColumns: '8rem 1fr' }}>
          {/* Timeline Header */}
          <div />
          <div className="relative grid grid-cols-11 border-l border-border text-xs text-muted-foreground">
            {hours.map((hour) => (
              <div key={hour} className="text-center border-r border-border py-1">
                {hour}:00
              </div>
            ))}
          </div>
        </div>

        {/* Staff Rows */}
        <div className="space-y-2">
          <TooltipProvider>
            {staffData.map((staff) => {
              const staffEvents = events.filter(e => e.staffId === staff.id);
              return (
                <div key={staff.id} className="grid items-center" style={{ gridTemplateColumns: '8rem 1fr' }}>
                  <div className="flex items-center gap-2 pr-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={staff.avatarUrl} alt={staff.name} />
                      <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{staff.name}</span>
                  </div>
                  <div className="relative h-10 bg-muted/50 rounded-md border-l border-border">
                    {/* Grid lines */}
                    <div className="absolute inset-0 grid grid-cols-11">
                      {hours.slice(0, -1).map((_, i) => (
                        <div key={i} className="border-r border-border/80 h-full"></div>
                      ))}
                    </div>
                     {/* Events */}
                    <div className="absolute inset-0 h-full p-1">
                      {staffEvents.map((event) => {
                        const customer = getCustomer(event.customerId);
                        return (
                          <Tooltip key={event.id}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute h-8 rounded-md px-2 flex items-center"
                                style={{
                                  ...calculateEventStyle(event),
                                  backgroundColor: staff.color,
                                  color: 'white',
                                }}
                              >
                                <p className="text-xs font-semibold truncate">
                                  {event.title || '未定のタスク'} @ {customer?.name}
                                </p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-bold">{event.title || '未定のタスク'}</p>
                              <p>顧客: {customer?.name}</p>
                              <p>時間: {formatTime(event.start)} - {formatTime(event.end)}</p>
                              <p>担当: {staff.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
