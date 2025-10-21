import { staffStatusData, staffData } from '@/lib/data';
import type { StaffStatus, Staff } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

const getStaff = (id: string): Staff | undefined => staffData.find(s => s.id === id);

const statusColors: Record<StaffStatus['status'], string> = {
  'Idle': 'bg-gray-400',
  'En Route': 'bg-yellow-500',
  'On Site': 'bg-blue-500',
  'Working': 'bg-green-500',
  'Departing': 'bg-orange-500',
};

export function StatusUpdates() {
  const statuses: StaffStatus[] = staffStatusData;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Status</CardTitle>
        <CardDescription>Live updates on staff activity.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {statuses.map((status, index) => {
            const staff = getStaff(status.staffId);
            if (!staff) return null;

            return (
              <div key={staff.id}>
                <div className="flex items-start gap-4">
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={staff.avatarUrl} alt={staff.name} data-ai-hint="person" />
                    <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold">{staff.name}</p>
                      <Badge variant="outline" className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", statusColors[status.status])}></span>
                        {status.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{status.lastAction}</p>
                    {status.distanceFromSite && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Distance: {status.distanceFromSite}
                      </p>
                    )}
                  </div>
                </div>
                {index < statuses.length - 1 && <Separator className="mt-4" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
