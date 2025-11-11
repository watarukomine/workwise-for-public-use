'use client';
import type { StaffStatus, Staff, WithId } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const statusColors: Record<StaffStatus['status'], string> = {
  '待機中': 'bg-gray-400',
  '移動中': 'bg-yellow-500',
  '作業待ち': 'bg-blue-500',
  '作業中': 'bg-green-500',
  '作業完了': 'bg-purple-500',
  '未割当': 'bg-red-500',
};

const statusJapanese: Record<StaffStatus['status'], string> = {
  '待機中': '待機中',
  '移動中': '移動中',
  '作業待ち': '作業待ち',
  '作業中': '作業中',
  '作業完了': '作業完了',
  '未割当': '未割当',
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
                  <div className="flex items-start gap-4">
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
                       {status.message && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {status.message}
                          </AlertDescription>
                        </Alert>
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
