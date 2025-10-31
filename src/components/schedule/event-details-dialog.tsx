
'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { ScheduleEvent } from '@/lib/types';
import { format } from "date-fns";

interface EventDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: ScheduleEvent;
  onAssign: (event: ScheduleEvent) => void;
  onEdit: (event: ScheduleEvent) => void;
  onDelete: (eventId: string) => Promise<void>;
}

export function EventDetailsDialog({
  isOpen,
  onClose,
  event,
  onAssign,
  onEdit,
  onDelete
}: EventDetailsDialogProps) {
  
  const handleDelete = async () => {
    await onDelete(event.id);
    onClose();
  };

  const formatDateTime = (date: Date | string) => {
    try {
      return format(new Date(date), 'yyyy/MM/dd HH:mm');
    } catch {
      return "無効な日時";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            {formatDateTime(event.start)} - {formatDateTime(event.end)}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <h4 className="font-semibold">詳細</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {event.description || "詳細情報はありません。"}
          </p>
        </div>
        <DialogFooter className="justify-between sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">削除</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  この操作は元に戻せません。イベント「{event.title}」を完全に削除します。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>削除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex gap-2">
             <Button variant="outline" onClick={() => onEdit(event)}>編集</Button>
             <Button onClick={() => onAssign(event)}>担当者/ステータス変更</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
