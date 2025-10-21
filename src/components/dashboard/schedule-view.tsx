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
} from "@/components/ui/tooltip"

const getCustomer = (id: string): Customer | undefined => customerData.find(c => c.id === id);

// Timeline settings
const timelineStartHour = 8;
const timelineEndHour = 18;
const totalHours = timelineEndHour - timelineStartHour;

// Function to calculate event position and width
const calculateEventStyle = (event: ScheduleEvent) => {
  const start = event.start;
  const end = event.end;
  
  const startOffset = (start.getHours() - timelineStartHour + start.getMinutes() / 60) / totalHours * 100;
  const endOffset = (end.getHours() - timelineStartHour + end.getMinutes() / 60) / totalHours * 100;
  
  const width = endOffset - startOffset;

  return {
    left: `${startOffset}%`,
    width: `${width}%`,
  };
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
}

export function ScheduleView() {
  const eventsByStaff: Record<string, ScheduleEvent[]> = scheduleData.reduce((acc, event) => {
    if (!acc[event.staffId]) {
      acc[event.staffId] = [];
    }
    acc[event.staffId].push(event);
    return acc;
  }, {} as Record<string, ScheduleEvent[]>);

  const timeLabels = Array.from({ length: totalHours + 1 }, (_, i) => timelineStartHour + i);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work Assignments</CardTitle>
        <CardDescription>Timeline view of all jobs scheduled for today.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <TooltipProvider>
          <div className="relative" style={{ minWidth: `${totalHours * 80}px` }}>
            {/* Timeline Header */}
            <div className="relative flex border-b pb-2">
              <div className="w-40 shrink-0"></div> {/* Staff name column width */}
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${totalHours}, 1fr)` }}>
                {timeLabels.slice(0, -1).map(hour => (
                  <div key={hour} className="text-center text-xs text-muted-foreground">
                    {hour}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Grid Lines */}
            <div className="absolute top-0 left-0 right-0 bottom-0 flex">
               <div className="w-40 shrink-0"></div>
               <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${totalHours}, 1fr)` }}>
                {timeLabels.slice(0, -1).map(hour => (
                  <div key={`grid-${hour}`} className="h-full border-r"></div>
                ))}
               </div>
            </div>
            
            {/* Staff Rows */}
            <div className="relative space-y-2 pt-2">
              {staffData.map(staff => (
                <div key={staff.id} className="flex items-center min-h-[4rem]">
                  {/* Staff Info */}
                  <div className="w-40 shrink-0 pr-4 flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={staff.avatarUrl} alt={staff.name} data-ai-hint="person" />
                      <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{staff.name}</span>
                  </div>
                  
                  {/* Staff Schedule Timeline */}
                  <div className="flex-1 h-12 relative">
                    {(eventsByStaff[staff.id] || []).map(event => {
                      const customer = getCustomer(event.customerId);
                      if (!customer) return null;
                      
                      const style = calculateEventStyle(event);

                      return (
                        <Tooltip key={event.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute h-10 top-1/2 -translate-y-1/2 rounded-lg p-2 flex flex-col justify-center cursor-pointer"
                              style={{ ...style, backgroundColor: staff.color, color: 'white' }}
                            >
                              <p className="text-xs font-semibold truncate">{event.title}</p>
                              <p className="text-xs truncate opacity-80">{customer.name}</p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-bold">{event.title}</p>
                            <p><span className="font-semibold">Staff:</span> {staff.name}</p>
                            <p><span className="font-semibold">Customer:</span> {customer.name}</p>
                            <p><span className="font-semibold">Time:</span> {formatTime(event.start)} - {formatTime(event.end)}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
