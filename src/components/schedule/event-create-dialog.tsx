
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { ScheduleEvent } from '@/lib/types';

interface EventCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialEvent: ScheduleEvent | null;
  onEventCreated: (newEvent: ScheduleEvent) => Promise<ScheduleEvent>;
  onEventUpdated: (updatedEvent: ScheduleEvent) => Promise<void>;
}

export function EventCreateDialog({
  isOpen,
  onClose,
  initialEvent,
  onEventCreated,
  onEventUpdated,
}: EventCreateDialogProps) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isEditMode = initialEvent && !initialEvent.id.startsWith('temp-');

  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title || '');
      // Format date for datetime-local input
      const formatForInput = (date: Date | string) => {
        const d = new Date(date);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      };
      setStart(formatForInput(initialEvent.start));
      setEnd(formatForInput(initialEvent.end));
      setDescription(initialEvent.description || '');
    } else {
      // Reset form for new event
      setTitle('');
      setStart('');
      setEnd('');
      setDescription('');
    }
  }, [initialEvent]);

  const handleSubmit = async () => {
    if (!title || !start || !end) {
      toast({
        title: "入力エラー",
        description: "タイトル、開始日時、終了日時をすべて入力してください。",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const eventData = {
      ...initialEvent,
      id: initialEvent?.id || `manual-${Date.now()}`,
      title,
      start: new Date(start),
      end: new Date(end),
      description,
    };

    try {
      if (isEditMode) {
        await onEventUpdated(eventData as ScheduleEvent);
        toast({ title: "イベントを更新しました" });
      } else {
        await onEventCreated(eventData as ScheduleEvent);
        toast({ title: "イベントを作成しました" });
      }
      onClose();
    } catch (error: any) {
      console.error("Failed to save event:", error);
      toast({
        title: "保存エラー",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'イベントの編集' : '新規イベントの作成'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">タイトル</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start">開始日時</Label>
              <Input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">終了日時</Label>
              <Input id="end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">詳細</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isSubmitting}>キャンセル</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
