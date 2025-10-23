'use client';
import type { StaffStatus, Staff, WithId } from '@/lib/types';
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
import React from 'react';

const statusColors: Record<StaffStatus['status'], string> = {
  'Idle': 'bg-gray-400',
  'En Route': 'bg-yellow-500',
  'On Site': 'bg-blue-500',
  'Working': 'bg-green-500',
  'Departing': 'bg-orange-500',
};

const statusJapanese: Record<StaffStatus['status'], string> = {
  'Idle': '待機中',
  'En Route': '移動中',
  'On Site': '現場到着',
  'Working': '作業中',
  'Departing': '出発',
}

interface StatusUpdatesProps {
    staffData: WithId<Staff>[];
    statuses: StaffStatus[];
}

export function StatusUpdates({ staffData, statuses }: StatusUpdatesProps) {
  
  const getStatus = (staffId: string): StaffStatus | undefined => {
    return statuses?.find(s => s.staffId === staffId);
  };
  
  const isLoading = !statuses || !staffData;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ステータス</CardTitle>
        <CardDescription>スタッフのリアルタイム活動状況</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            <p>Loading statuses...</p>
          ) : staffData && staffData.length > 0 ? (
            staffData.map((staff, index) => {
              const status = getStatus(staff.id);
              if (!status) return null;

              return (
                <div key={staff.id}>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 border">
                      <AvatarImage src={staff.avatarUrl} alt={staff.name} data-ai-hint="person" />
                      <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold">{staff.name}</p>
                        <Badge variant="outline" className="flex items-center gap-2 text-xs">
                          <span className={cn("h-2 w-2 rounded-full", statusColors[status.status])} />
                          {statusJapanese[status.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{status.lastAction}</p>
                      {status.distanceFromSite && (
                        <p className="text-xs text-muted-foreground">
                          現場から: {status.distanceFromSite}
                        </p>
                      )}
                    </div>
                  </div>
                  {index < staffData.length - 1 && <Separator className="mt-4" />}
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground text-center py-4">表示するスタッフが選択されていません。</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
